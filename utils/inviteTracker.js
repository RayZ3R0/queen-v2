import { EventEmitter } from "node:events";
import { Collection, GuildFeature, PermissionFlagsBits } from "discord.js";
import InviteData from "../schema/inviteData.js"; // Mongoose invite data model

/**
 * InviteTracker - tracks and compares invites for your bot.
 *
 * Options:
 *   fetchGuilds: boolean (default: true) – whether to initially fetch all guild invites
 *   fetchVanity: boolean (default: true) – whether to track vanity invite data
 *   exemptGuild: function(guild) => boolean – a function to filter out guilds not to track
 *   activeGuilds: string[] – an array of guild IDs to limit tracking
 */
class InviteTracker extends EventEmitter {
  /**
   * @param {import("discord.js").Client} client
   * @param {object} options
   */
  constructor(client, options = {}) {
    super();
    this.client = client;
    this.options = { fetchGuilds: true, fetchVanity: true, ...options };

    // Collections mapping guild ID to a Collection of simplified invites.
    this.invitesCache = new Collection();
    // For storing vanity invite data per guild.
    this.vanityCache = new Collection();
    this.cacheFetched = false;

    // If we are to fetch invites on startup...
    if (this.options.fetchGuilds) {
      if (client.isReady()) {
        this.fetchAllGuildInvites().then(() => {
          this.cacheFetched = true;
          this.emit("cacheFetched");
        });
      } else {
        client.once("ready", async () => {
          await this.fetchAllGuildInvites();
          this.cacheFetched = true;
          this.emit("cacheFetched");
        });
      }
    }

    // Bind event listeners.
    client.on("guildMemberAdd", (member) => this.handleGuildMemberAdd(member));
    client.on("inviteCreate", (invite) => this.handleInviteCreate(invite));
    client.on("inviteDelete", (invite) => this.handleInviteDelete(invite));
  }

  /**
   * Returns the guilds that should be tracked.
   * @returns {Collection<string, import("discord.js").Guild>}
   */
  get trackedGuilds() {
    let guilds = this.client.guilds.cache;
    if (this.options.exemptGuild) {
      guilds = guilds.filter((g) => !this.options.exemptGuild(g));
    }
    if (this.options.activeGuilds) {
      guilds = guilds.filter((g) => this.options.activeGuilds.includes(g.id));
    }
    return guilds;
  }

  /**
   * Fetch invites for every tracked guild.
   */
  async fetchAllGuildInvites() {
    const promises = [];
    for (const guild of this.trackedGuilds.values()) {
      promises.push(this.fetchGuildInvites(guild));
    }
    await Promise.all(promises);
  }

  /**
   * Fetch invites for a single guild and store them in the invitesCache.
   * @param {import("discord.js").Guild} guild
   */
  async fetchGuildInvites(guild) {
    try {
      if (guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
        const invites = await guild.invites.fetch();
        // Store a simplified version of each invite.
        const invitesData = new Collection(
          invites.map((invite) => [
            invite.code,
            {
              code: invite.code,
              uses: invite.uses,
              maxUses: invite.maxUses,
              inviter: invite.inviter ? invite.inviter.id : null,
              createdTimestamp: invite.createdTimestamp,
              url: invite.url,
              maxAge: invite.maxAge,
            },
          ])
        );
        this.invitesCache.set(guild.id, invitesData);

        // Update vanity data if available.
        if (
          guild.features.includes(GuildFeature.VanityURL) &&
          this.options.fetchVanity
        ) {
          try {
            const vanityData = await guild.fetchVanityData();
            this.vanityCache.set(guild.id, vanityData);
          } catch (error) {
            // Ignore vanity fetch errors.
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching invites for guild ${guild.id}:`, error);
    }
  }

  /**
   * Compare cached invites with current invites to determine which invite was used.
   * @param {Collection<string, any>} cachedInvites
   * @param {Collection<string, any>} currentInvites
   * @returns {Array} Array of invites that show increased use.
   */
  compareInviteUsage(cachedInvites, currentInvites) {
    const usedInvites = [];
    currentInvites.forEach((current) => {
      const cached = cachedInvites.get(current.code);
      if (cached && current.uses > cached.uses) {
        usedInvites.push(current);
      }
    });
    // If no invite appears to have increased uses, check for invites that were removed.
    if (usedInvites.length === 0 && cachedInvites.size > 0) {
      cachedInvites.forEach((cached) => {
        if (
          !currentInvites.has(cached.code) &&
          cached.maxUses > 0 &&
          cached.uses === cached.maxUses - 1
        ) {
          usedInvites.push(cached);
        }
      });
    }
    return usedInvites;
  }

  /**
   * Handle invite creation: update cache accordingly.
   * @param {import("discord.js").Invite} invite
   */
  async handleInviteCreate(invite) {
    if (!invite.guild) return;
    await this.fetchGuildInvites(invite.guild);
    this.emit("inviteCreated", invite);
  }

  /**
   * Handle invite deletion: mark it and remove from cache.
   * @param {import("discord.js").Invite} invite
   */
  async handleInviteDelete(invite) {
    if (!invite.guild) return;
    const guildInvites = this.invitesCache.get(invite.guild.id);
    if (guildInvites && guildInvites.has(invite.code)) {
      const cachedInvite = guildInvites.get(invite.code);
      cachedInvite.deletedTimestamp = Date.now();
      guildInvites.delete(invite.code);
      this.invitesCache.set(invite.guild.id, guildInvites);
    }
    this.emit("inviteDeleted", invite);
  }

  /**
   * Handle a new guild member joining.
   * Determines which invite was used, updates persistent tracking, and emits an event.
   * @param {import("discord.js").GuildMember} member
   */
  async handleGuildMemberAdd(member) {
    if (member.partial) return;
    const guild = member.guild;
    if (!this.trackedGuilds.has(guild.id)) return;

    let currentInvites;
    try {
      currentInvites = await guild.invites.fetch();
    } catch (error) {
      currentInvites = new Collection();
    }
    // Simplify current invites.
    const currentData = new Collection();
    currentInvites.forEach((invite) => {
      currentData.set(invite.code, {
        code: invite.code,
        uses: invite.uses,
        maxUses: invite.maxUses,
        inviter: invite.inviter ? invite.inviter.id : null,
        createdTimestamp: invite.createdTimestamp,
        url: invite.url,
        maxAge: invite.maxAge,
      });
    });
    const cachedInvites = this.invitesCache.get(guild.id) || new Collection();

    // Update stored cache with the latest invites.
    this.invitesCache.set(guild.id, currentData);

    // Compare cached vs. current invites.
    const usedInvites = this.compareInviteUsage(cachedInvites, currentData);
    const inviteUsed = usedInvites[0] || null;
    let type = "unknown";
    if (!inviteUsed && guild.features.includes(GuildFeature.VanityURL)) {
      try {
        const vanityData = await guild.fetchVanityData();
        const cachedVanity = this.vanityCache.get(guild.id);
        if (cachedVanity && vanityData.uses > cachedVanity.uses) {
          type = "vanity";
          this.vanityCache.set(guild.id, vanityData);
        } else {
          this.vanityCache.set(guild.id, vanityData);
        }
      } catch (error) {
        // Ignore vanity fetch errors.
      }
    } else if (inviteUsed) {
      type = "normal";
    }
    // Update the database with invite tracking data.
    await this.updateInviteDatabase(member, type, inviteUsed);
    // Emit an event with the member, type ("vanity", "normal", or "unknown"), and invite details if available.
    this.emit("guildMemberAdd", member, type, inviteUsed);
  }

  /**
   * Update the persistent invite tracking in the database.
   * @param {import("discord.js").GuildMember} member The new member.
   * @param {string} type Either "normal", "vanity", or "unknown".
   * @param {object|null} inviteUsed The invite used (if any).
   */
  async updateInviteDatabase(member, type, inviteUsed) {
    try {
      const guildId = member.guild.id;
      if (type === "normal" && inviteUsed) {
        const inviterId = inviteUsed.inviter;
        if (!inviterId) return;
        await InviteData.findOneAndUpdate(
          { guildId, inviterId },
          {
            $inc: { invites: 1 },
            $push: {
              invitedMembers: { memberId: member.id, joinedAt: new Date() },
            },
          },
          { upsert: true, new: true }
        );
      } else if (type === "vanity") {
        const inviterId = "vanity";
        await InviteData.findOneAndUpdate(
          { guildId, inviterId },
          {
            $inc: { invites: 1 },
            $push: {
              invitedMembers: { memberId: member.id, joinedAt: new Date() },
            },
          },
          { upsert: true, new: true }
        );
      }
    } catch (error) {
      console.error("Error updating invite database:", error);
    }
  }
}

/**
 * Initialize the invite tracker.
 * @param {import("discord.js").Client} client
 * @param {object} options
 * @returns {InviteTracker}
 */
export const initInviteTracker = (client, options = {}) =>
  new InviteTracker(client, options);

export { InviteTracker };
