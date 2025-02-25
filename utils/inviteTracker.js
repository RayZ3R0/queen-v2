import { EventEmitter } from "node:events";
import { Collection, GuildFeature, PermissionFlagsBits } from "discord.js";
import InviteData from "../schema/inviteData.js"; // Your Mongoose model

class InviteTracker extends EventEmitter {
  constructor(client, options = {}) {
    super();
    this.client = client;
    this.options = { fetchGuilds: true, fetchVanity: true, ...options };
    this.invitesCache = new Collection();
    this.vanityCache = new Collection();
    this.cacheFetched = false;

    if (this.options.fetchGuilds) {
      if (client.isReady()) {
        this.fetchAllGuildInvites().then(() => {
          this.cacheFetched = true;
          console.log("[InviteTracker] Cache fetched on startup.");
          this.emit("cacheFetched");
        });
      } else {
        client.once("ready", async () => {
          await this.fetchAllGuildInvites();
          this.cacheFetched = true;
          console.log("[InviteTracker] Cache fetched on ready.");
          this.emit("cacheFetched");
        });
      }
    }

    client.on("guildMemberAdd", (member) => this.handleGuildMemberAdd(member));
    client.on("inviteCreate", (invite) => this.handleInviteCreate(invite));
    client.on("inviteDelete", (invite) => this.handleInviteDelete(invite));
  }

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

  async fetchAllGuildInvites() {
    const promises = [];
    for (const guild of this.trackedGuilds.values()) {
      promises.push(this.fetchGuildInvites(guild));
    }
    await Promise.all(promises);
  }

  async fetchGuildInvites(guild) {
    try {
      if (guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
        const invites = await guild.invites.fetch();
        const simpleInvites = new Collection(
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
        console.log(
          `[InviteTracker] Fetched ${simpleInvites.size} invites for guild ${guild.id}`
        );
        this.invitesCache.set(guild.id, simpleInvites);

        if (
          guild.features.includes(GuildFeature.VanityURL) &&
          this.options.fetchVanity
        ) {
          try {
            const vanityData = await guild.fetchVanityData();
            this.vanityCache.set(guild.id, vanityData);
            console.log(
              `[InviteTracker] Fetched vanity data for guild ${guild.id}`
            );
          } catch (vanityError) {
            // Ignore vanity errors.
          }
        }
      }
    } catch (error) {
      console.error(
        `[InviteTracker] Error fetching invites for guild ${guild.id}:`,
        error
      );
    }
  }

  compareInviteUsage(cachedInvites, currentInvites) {
    const usedInvites = [];
    currentInvites.forEach((current) => {
      const cached = cachedInvites.get(current.code);
      if (cached && current.uses > cached.uses) {
        usedInvites.push(current);
      }
    });
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
        console.log(
          `[InviteTracker] Updated DB for normal invite by ${inviterId}`
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
        console.log("[InviteTracker] Updated DB for vanity invite");
      }
    } catch (error) {
      console.error("[InviteTracker] Error updating invite database:", error);
    }
  }

  async handleGuildMemberAdd(member) {
    if (member.partial) return;
    const guild = member.guild;
    if (!this.trackedGuilds.has(guild.id)) return;

    let currentInvites;
    try {
      currentInvites = await guild.invites.fetch();
    } catch (fetchError) {
      currentInvites = new Collection();
    }
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
    this.invitesCache.set(guild.id, currentData);

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
      } catch (vanityError) {
        // Ignore vanity errors.
      }
    } else if (inviteUsed) {
      type = "normal";
    }
    await this.updateInviteDatabase(member, type, inviteUsed);
    console.log(
      `[InviteTracker] Member ${member.id} joined using type ${type} invite.`
    );
    this.emit("guildMemberAdd", member, type, inviteUsed);
  }

  async handleInviteCreate(invite) {
    if (!invite.guild) return;
    await this.fetchGuildInvites(invite.guild);
    console.log(
      `[InviteTracker] Invite created: ${invite.code} in guild ${invite.guild.id}`
    );
    this.emit("inviteCreated", invite);
  }

  async handleInviteDelete(invite) {
    if (!invite.guild) return;
    const guildInvites = this.invitesCache.get(invite.guild.id);
    if (guildInvites && guildInvites.has(invite.code)) {
      const cachedInvite = guildInvites.get(invite.code);
      cachedInvite.deletedTimestamp = Date.now();
      guildInvites.delete(invite.code);
      this.invitesCache.set(invite.guild.id, guildInvites);
    }
    console.log(
      `[InviteTracker] Invite deleted: ${invite.code} in guild ${invite.guild.id}`
    );
    this.emit("inviteDeleted", invite);
  }
}

export const initInviteTracker = (client, options = {}) =>
  new InviteTracker(client, options);
export { InviteTracker };
