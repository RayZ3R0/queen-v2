import { Collection, Client, Invite, Guild, GuildMember } from "discord.js";
import {
  InviteModel,
  InviteUsageModel,
  InviterStatsModel,
} from "../schema/inviteTracker.js";
import { Logger } from "./Logger.js";

class InviteManager {
  constructor(client) {
    this.client = client;
    this.inviteCache = new Collection();
    this.processingQueues = new Map();
  }

  /**
   * Check if bot has required permissions in guild
   */
  hasRequiredPermissions(guild) {
    const botMember = guild.members.cache.get(this.client.user.id);
    if (!botMember) return false;

    // Check for MANAGE_GUILD or ADMINISTRATOR permission
    return (
      botMember.permissions.has("ManageGuild") ||
      botMember.permissions.has("Administrator")
    );
  }

  /**
   * Initialize invite cache for a guild
   */
  async cacheGuildInvites(guild) {
    try {
      // Ensure guild is properly fetched and available
      if (!guild?.id) {
        console.log(`Invalid guild object provided`);
        return;
      }

      // Try to fetch fresh guild data
      const fetchedGuild = await this.client.guilds
        .fetch(guild.id)
        .catch((err) => {
          console.error(`Failed to fetch guild ${guild.id}:`, err);
          return null;
        });

      if (!fetchedGuild?.available) {
        console.log(
          `Guild ${guild.id} is not available for invite caching - will retry in 5 seconds`
        );
        // Retry after 5 seconds
        setTimeout(() => this.cacheGuildInvites(guild), 5000);
        return;
      }

      // Check permissions using fetched guild
      const botMember = await fetchedGuild.members
        .fetch(this.client.user.id)
        .catch(() => null);

      if (!botMember) {
        console.log(
          `Bot member not found in guild ${fetchedGuild.name} (${fetchedGuild.id})`
        );
        return;
      }

      // Check for MANAGE_GUILD or ADMINISTRATOR permission
      if (
        !botMember.permissions.has("ManageGuild") &&
        !botMember.permissions.has("Administrator")
      ) {
        console.log(
          `Missing required permissions in guild ${fetchedGuild.name} (${fetchedGuild.id})`
        );
        return;
      }

      const invites = await fetchedGuild.invites.fetch().catch((err) => {
        if (err.code === 50013) {
          console.log(
            `Missing permissions to fetch invites in ${fetchedGuild.name} (${fetchedGuild.id})`
          );
        } else {
          console.error(
            `Error fetching invites for ${fetchedGuild.name} (${fetchedGuild.id}):`,
            err
          );
        }
        return null;
      });

      if (!invites) return;

      this.inviteCache.set(
        fetchedGuild.id,
        new Collection(
          invites.map((invite) => [
            invite.code,
            {
              code: invite.code,
              uses: invite.uses,
              inviterId: invite.inviter?.id,
              maxUses: invite.maxUses,
              createdTimestamp: invite.createdTimestamp,
            },
          ])
        )
      );

      console.log(
        `Successfully cached ${invites.size} invites for ${fetchedGuild.name} (${fetchedGuild.id})`
      );
    } catch (error) {
      console.error(`Failed to cache invites for guild ${guild?.id}:`, error);

      // Retry after 5 seconds on error
      setTimeout(() => this.cacheGuildInvites(guild), 5000);
    }
  }

  /**
   * Process member join with race condition handling
   */
  async handleMemberJoin(member) {
    const { guild } = member;

    // Ensure we have a processing queue for this guild
    if (!this.processingQueues.has(guild.id)) {
      this.processingQueues.set(guild.id, Promise.resolve());
    }

    // Add to processing queue
    this.processingQueues.set(
      guild.id,
      this.processingQueues.get(guild.id).then(async () => {
        try {
          const usedInvite = await this.findUsedInvite(guild);
          if (!usedInvite) return;

          await this.trackInviteUsage(usedInvite, member);
          await this.updateInviterStats(usedInvite.inviterId, guild.id);
          await this.logInviteUsage(usedInvite, member);
        } catch (error) {
          console.error("Error processing member join:", error);
        }
      })
    );
  }

  /**
   * Find which invite was used by comparing before/after states
   */
  async findUsedInvite(guild) {
    try {
      const cachedInvites = this.inviteCache.get(guild.id) || new Collection();
      const currentInvites = await guild.invites.fetch();

      // Find invite with increased uses
      for (const [code, invite] of currentInvites) {
        const cachedInvite = cachedInvites.get(code);

        if (!cachedInvite) {
          // New invite that was just used
          return {
            code: invite.code,
            uses: 1,
            inviterId: invite.inviter?.id,
            isNew: true,
          };
        }

        if (invite.uses > cachedInvite.uses) {
          return {
            code: invite.code,
            uses: invite.uses,
            inviterId: invite.inviter?.id,
            isNew: false,
          };
        }
      }

      // Check for vanity URL
      const vanityData = await guild.fetchVanityData().catch(() => null);
      if (vanityData) {
        const cachedVanity = cachedInvites.get("VANITY");
        if (!cachedVanity || vanityData.uses > cachedVanity.uses) {
          return { code: "VANITY", uses: vanityData.uses, isVanity: true };
        }
      }

      return null;
    } catch (error) {
      console.error("Error finding used invite:", error);
      return null;
    }
  }

  /**
   * Track invite usage in database
   */
  async trackInviteUsage(usedInvite, member) {
    if (usedInvite.isVanity) return;

    try {
      // Update or create invite record
      await InviteModel.findOneAndUpdate(
        {
          guildId: member.guild.id,
          code: usedInvite.code,
        },
        {
          $set: {
            inviterId: usedInvite.inviterId,
            uses: usedInvite.uses,
          },
        },
        { upsert: true }
      );

      // Create invite usage record
      await InviteUsageModel.create({
        guildId: member.guild.id,
        inviterId: usedInvite.inviterId,
        invitedId: member.id,
        code: usedInvite.code,
      });
    } catch (error) {
      console.error("Error tracking invite usage:", error);
    }
  }

  /**
   * Update inviter's statistics
   */
  async updateInviterStats(inviterId, guildId) {
    if (!inviterId) return;

    try {
      const stats = await InviterStatsModel.findOneAndUpdate(
        { guildId, userId: inviterId },
        {
          $inc: { "invites.total": 1 },
          $set: { lastInvite: new Date() },
        },
        { upsert: true, new: true }
      );
      return stats;
    } catch (error) {
      console.error("Error updating inviter stats:", error);
    }
  }

  /**
   * Log invite usage to specified channel
   */
  async logInviteUsage(usedInvite, member) {
    try {
      const logChannel = await this.client.channels.fetch("901818838381891624");
      if (!logChannel || !logChannel.isTextBased()) return;

      const inviter = usedInvite.inviterId
        ? await this.client.users.fetch(usedInvite.inviterId).catch(() => null)
        : null;

      const content = inviter
        ? `${member.user.tag} joined using invite code ${
            usedInvite.code
          } from ${inviter.tag}. This invite has been used ${
            usedInvite.uses
          } time${usedInvite.uses !== 1 ? "s" : ""}.`
        : `${member.user.tag} joined using invite code ${usedInvite.code}`;

      await logChannel.send(content);
    } catch (error) {
      console.error("Error logging invite usage:", error);
    }
  }

  /**
   * Handle member leave
   */
  async handleMemberLeave(member) {
    try {
      // Find their invite usage record
      const inviteUsage = await InviteUsageModel.findOne({
        guildId: member.guild.id,
        invitedId: member.id,
        leftAt: null,
      });

      if (inviteUsage && inviteUsage.inviterId) {
        // Update the usage record
        await InviteUsageModel.findByIdAndUpdate(inviteUsage._id, {
          $set: { leftAt: new Date() },
        });

        // Update inviter's stats
        await InviterStatsModel.findOneAndUpdate(
          {
            guildId: member.guild.id,
            userId: inviteUsage.inviterId,
          },
          { $inc: { "invites.left": 1 } }
        );
      }
    } catch (error) {
      console.error("Error handling member leave:", error);
    }
  }

  /**
   * Get invite statistics for a user
   */
  async getInviterStats(guildId, userId) {
    try {
      let stats = await InviterStatsModel.findOne({ guildId, userId });

      if (!stats) {
        stats = await InviterStatsModel.create({
          guildId,
          userId,
          invites: { total: 0, left: 0, fake: 0, bonus: 0 },
        });
      }

      const activeInvites = await InviteUsageModel.countDocuments({
        guildId,
        inviterId: userId,
        leftAt: null,
      });

      return {
        total: stats.invites.total,
        left: stats.invites.left,
        fake: stats.invites.fake,
        bonus: stats.invites.bonus,
        active: activeInvites,
        real: stats.realInvites,
      };
    } catch (error) {
      console.error("Error getting inviter stats:", error);
      return null;
    }
  }
}

export default InviteManager;
