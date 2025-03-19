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
    this.retryDelays = [1000, 2000, 5000]; // Retry delays in milliseconds
    this.maxRetries = 3;
  }

  /**
   * Safe logging with fallback to console methods
   * @private
   */
  safeLog(level, message, error = null) {
    try {
      switch (level) {
        case "debug":
          Logger.debug(message);
          break;
        case "info":
          Logger.info(message);
          break;
        case "warn":
          Logger.warn(message);
          break;
        case "error":
          Logger.error(message, error);
          break;
      }
    } catch (logError) {
      // Fallback to console methods
      const consoleMethod = console[level] || console.log;
      if (error) {
        consoleMethod(`[${level.toUpperCase()}] ${message}:`, error);
      } else {
        consoleMethod(`[${level.toUpperCase()}] ${message}`);
      }
    }
  }

  /**
   * Utility method for retrying operations with exponential backoff
   * @param {Function} operation - Function to retry
   * @param {string} operationName - Name of operation for logging
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<any>} - Result of the operation
   */
  async retryOperation(operation, operationName, maxRetries = this.maxRetries) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const isLastAttempt = attempt === maxRetries - 1;
        const delay =
          this.retryDelays[attempt] ||
          this.retryDelays[this.retryDelays.length - 1];

        Logger.warn(
          `${operationName} failed (attempt ${attempt + 1}/${maxRetries}): ${
            error.message
          }`
        );

        if (isLastAttempt) {
          Logger.error(`${operationName} failed after ${maxRetries} attempts`);
          throw error;
        }

        Logger.info(`Retrying ${operationName} in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Clear guild invite cache
   * @param {string} guildId - Guild ID to clear cache for
   */
  clearGuildCache(guildId) {
    this.inviteCache.delete(guildId);
    Logger.debug(`Cleared invite cache for guild ${guildId}`);
  }

  /**
   * Get cached invites for a guild
   * @param {string} guildId - Guild ID to get cache for
   * @returns {Collection} - Collection of cached invites
   */
  getGuildCache(guildId) {
    return this.inviteCache.get(guildId) || new Collection();
  }

  /**
   * Check if bot has required permissions in guild
   * Returns a detailed object with permission status and missing permissions
   */
  hasRequiredPermissions(guild) {
    const botMember = guild.members.cache.get(this.client.user.id);
    if (!botMember) {
      Logger.warn(`Bot member not found in guild ${guild.name} (${guild.id})`);
      return {
        hasPermissions: false,
        missing: ["MISSING_MEMBER"],
        reason: "Bot member not found in guild",
      };
    }

    const requiredPermissions = ["ManageGuild", "ViewChannel", "ManageRoles"];
    const missingPermissions = requiredPermissions.filter(
      (perm) => !botMember.permissions.has(perm)
    );

    const hasPermissions =
      missingPermissions.length === 0 ||
      botMember.permissions.has("Administrator");

    if (!hasPermissions) {
      Logger.warn(
        `Missing permissions in ${guild.name}: ${missingPermissions.join(", ")}`
      );
    }

    return {
      hasPermissions,
      missing: missingPermissions,
      reason: hasPermissions
        ? null
        : `Missing permissions: ${missingPermissions.join(", ")}`,
    };
  }

  /**
   * Initialize invite cache for a guild
   */
  /**
   * Initialize or update invite cache for a guild
   * @param {Guild} guild - Guild to cache invites for
   * @returns {Promise<boolean>} - Success status
   */
  async cacheGuildInvites(guild) {
    if (!guild?.id) {
      try {
        Logger.error("Invalid guild object provided");
      } catch (logError) {
        console.error("Invalid guild object provided");
      }
      return false;
    }

    try {
      // Fetch guild with retries
      const fetchedGuild = await this.retryOperation(async () => {
        const g = await this.client.guilds.fetch(guild.id);
        if (!g?.available) {
          throw new Error(`Guild ${guild.id} is not available`);
        }
        return g;
      }, "Guild fetch");

      // Check permissions
      const permissionStatus = this.hasRequiredPermissions(fetchedGuild);
      if (!permissionStatus.hasPermissions) {
        Logger.warn(`${permissionStatus.reason} in ${fetchedGuild.name}`);
        return false;
      }

      // Fetch invites with retries
      const invites = await this.retryOperation(async () => {
        const fetchedInvites = await fetchedGuild.invites.fetch();
        if (!fetchedInvites) {
          throw new Error("No invites returned from API");
        }
        return fetchedInvites;
      }, "Invite fetch");

      // Process and cache invites
      const processedInvites = new Collection(
        invites.map((invite) => [
          invite.code,
          {
            code: invite.code,
            uses: invite.uses,
            inviterId: invite.inviter?.id,
            maxUses: invite.maxUses,
            createdTimestamp: invite.createdTimestamp,
            expiresAt: invite.expiresAt,
            temporary: invite.temporary,
            maxAge: invite.maxAge,
            channelId: invite.channel?.id,
          },
        ])
      );

      // Update cache
      this.inviteCache.set(fetchedGuild.id, processedInvites);

      Logger.info(
        `Successfully cached ${invites.size} invites for ${fetchedGuild.name} (${fetchedGuild.id})`
      );
      return true;
    } catch (error) {
      try {
        Logger.error(
          `Failed to cache invites for guild ${guild?.id}:`,
          error.message
        );
      } catch (logError) {
        console.error(
          `Failed to cache invites for guild ${guild?.id}:`,
          error.message
        );
      }
      return false;
    }
  }

  /**
   * Process member join with race condition handling
   */
  /**
   * Process member join with improved tracking and error handling
   * @param {GuildMember} member - The member that joined
   * @returns {Promise<void>}
   */
  async handleMemberJoin(member) {
    const { guild } = member;

    if (!this.processingQueues.has(guild.id)) {
      this.processingQueues.set(guild.id, Promise.resolve());
    }

    this.processingQueues.set(
      guild.id,
      this.processingQueues.get(guild.id).then(async () => {
        try {
          // Check permissions first
          const permissionStatus = this.hasRequiredPermissions(guild);
          if (!permissionStatus.hasPermissions) {
            Logger.warn(`Cannot process join - ${permissionStatus.reason}`);
            return;
          }

          // Check for existing usage with retries
          const existingUsage = await this.retryOperation(async () => {
            const usage = await InviteUsageModel.findOne({
              guildId: guild.id,
              invitedId: member.id,
              leftAt: { $ne: null },
            }).sort({ joinedAt: -1 });
            return usage;
          }, "Fetch existing invite usage");

          if (existingUsage) {
            Logger.info(
              `${member.user.tag} is rejoining using previous invite`
            );
            const invite = {
              code: existingUsage.code,
              uses: 1,
              inviterId: existingUsage.inviterId,
              isRejoin: true,
            };

            await this.retryOperation(async () => {
              await this.trackInviteUsage(invite, member);
              await this.updateInviterStats(invite.inviterId, guild.id);
              await this.logInviteUsage(invite, member);
            }, "Process rejoin");
            return;
          }

          // Handle new member joins with retries
          const usedInvite = await this.retryOperation(async () => {
            const invite = await this.findUsedInvite(guild);
            if (!invite) {
              throw new Error("Could not determine used invite");
            }
            return invite;
          }, "Find used invite");

          // Process the invite usage with retries
          await this.retryOperation(async () => {
            await this.trackInviteUsage(usedInvite, member);
            await this.updateInviterStats(usedInvite.inviterId, guild.id);
            await this.logInviteUsage(usedInvite, member);

            Logger.info(
              `Successfully processed join for ${member.user.tag} using invite ${usedInvite.code}`
            );
          }, "Process invite usage");
        } catch (error) {
          Logger.error(`Failed to process member join:`, error.message);
          // Attempt to recover cache in case of error
          await this.cacheGuildInvites(guild).catch(() => {});
        }
      })
    );
  }

  /**
   * Find which invite was used by comparing before/after states
   */
  /**
   * Find which invite was used by comparing before/after states
   * @param {Guild} guild - The guild to check invites for
   * @returns {Promise<Object|null>} The used invite or null if not found
   */
  async findUsedInvite(guild) {
    try {
      // Get cached invites with validation
      const cachedInvites = this.getGuildCache(guild.id);
      if (!cachedInvites.size) {
        Logger.warn(
          `No cached invites found for guild ${guild.name}, attempting to cache`
        );
        await this.cacheGuildInvites(guild);
        return null;
      }

      // Fetch current invites with retries
      const currentInvites = await this.retryOperation(async () => {
        const fetchedInvites = await guild.invites.fetch();
        if (!fetchedInvites) {
          throw new Error("No invites returned from API");
        }
        return fetchedInvites;
      }, "Fetch current invites");

      let usedInvite = null;

      // Check regular invites first
      for (const [code, invite] of currentInvites) {
        const cachedInvite = cachedInvites.get(code);
        if (!cachedInvite || invite.uses > cachedInvite.uses) {
          usedInvite = {
            code: invite.code,
            uses: invite.uses,
            inviterId: invite.inviter?.id,
            isNew: !cachedInvite,
            maxUses: invite.maxUses,
            temporary: invite.temporary,
            channel: invite.channel?.name || "unknown",
            createdAt: invite.createdAt,
          };
          break;
        }
      }

      // Update cache with new state
      this.inviteCache.set(
        guild.id,
        new Collection(
          currentInvites.map((invite) => [
            invite.code,
            {
              code: invite.code,
              uses: invite.uses,
              inviterId: invite.inviter?.id,
              maxUses: invite.maxUses,
              createdTimestamp: invite.createdTimestamp,
              expiresAt: invite.expiresAt,
              temporary: invite.temporary,
              maxAge: invite.maxAge,
              channelId: invite.channel?.id,
            },
          ])
        )
      );

      if (!usedInvite) {
        Logger.warn(`Could not determine used invite in ${guild.name}`);
      } else {
        Logger.debug(
          `Found used invite: ${usedInvite.code} (${
            usedInvite.isNew ? "new" : "existing"
          })`
        );
      }

      return usedInvite;
    } catch (error) {
      Logger.error(`Error finding used invite:`, error.message);
      // Attempt to recover cache on error
      await this.cacheGuildInvites(guild).catch(() => {});
      return null;
    }
  }

  /**
   * Track invite usage in database
   */
  /**
   * Track invite usage in database with retries and validation
   * @param {Object} usedInvite - The invite that was used
   * @param {GuildMember} member - The member that joined
   * @returns {Promise<void>}
   */
  async trackInviteUsage(usedInvite, member) {
    if (usedInvite.isVanity) {
      Logger.debug(
        `Skipping tracking for vanity URL use in ${member.guild.name}`
      );
      return;
    }

    try {
      // Update or create invite record with retries
      await this.retryOperation(async () => {
        await InviteModel.findOneAndUpdate(
          {
            guildId: member.guild.id,
            code: usedInvite.code,
          },
          {
            $set: {
              inviterId: usedInvite.inviterId,
              uses: usedInvite.uses,
              maxUses: usedInvite.maxUses,
              temporary: usedInvite.temporary,
              channel: usedInvite.channel,
              createdAt: usedInvite.createdAt,
            },
            $setOnInsert: {
              createdTimestamp: Date.now(),
            },
          },
          {
            upsert: true,
            new: true,
            runValidators: true,
          }
        );
      }, "Update invite record");

      // Create invite usage record with retries
      await this.retryOperation(async () => {
        const usage = await InviteUsageModel.create({
          guildId: member.guild.id,
          inviterId: usedInvite.inviterId,
          invitedId: member.id,
          code: usedInvite.code,
          joinedAt: new Date(),
          metadata: {
            isNew: usedInvite.isNew,
            channelId: usedInvite.channelId,
            temporary: usedInvite.temporary,
          },
        });
        return usage;
      }, "Create invite usage record");

      Logger.debug(
        `Successfully tracked invite usage for ${member.user.tag} in ${member.guild.name}`
      );
    } catch (error) {
      Logger.error("Error tracking invite usage:", error.message);
      throw error; // Re-throw to be handled by caller
    }
  }

  /**
   * Update inviter's statistics with retries and validation
   * @param {string} inviterId - ID of the user who created the invite
   * @param {string} guildId - ID of the guild
   * @returns {Promise<Object|null>} Updated stats or null if failed
   */
  async updateInviterStats(inviterId, guildId) {
    if (!inviterId) {
      Logger.warn("Attempted to update stats with no inviter ID");
      return null;
    }

    try {
      const stats = await this.retryOperation(async () => {
        const updatedStats = await InviterStatsModel.findOneAndUpdate(
          { guildId, userId: inviterId },
          {
            $inc: { "invites.total": 1 },
            $set: {
              lastInvite: new Date(),
              lastUpdated: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
              invites: {
                left: 0,
                fake: 0,
                bonus: 0,
              },
            },
          },
          {
            upsert: true,
            new: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          }
        );

        if (!updatedStats) {
          throw new Error("Failed to update inviter stats");
        }

        return updatedStats;
      }, "Update inviter stats");

      Logger.debug(
        `Updated stats for inviter ${inviterId} in guild ${guildId}: ${stats.invites.total} total invites`
      );

      return stats;
    } catch (error) {
      Logger.error("Error updating inviter stats:", error.message);
      throw error; // Re-throw to be handled by caller
    }
  }

  /**
   * Log invite usage to specified channel
   */
  async logInviteUsage(usedInvite, member) {
    try {
      // Fetch log channel with retries
      const logChannel = await this.retryOperation(async () => {
        const channel = await this.client.channels.fetch("901818838381891624");
        if (!channel || !channel.isTextBased()) {
          throw new Error("Log channel not found or not text-based");
        }
        return channel;
      }, "Fetch log channel");

      // Fetch inviter with retries if needed
      let inviter = null;
      if (usedInvite.inviterId) {
        inviter = await this.retryOperation(
          async () => {
            const user = await this.client.users.fetch(usedInvite.inviterId);
            return user;
          },
          "Fetch inviter",
          2 // Fewer retries for non-critical operation
        ).catch(() => null); // Fallback to null if fetching fails
      }

      // Build log message
      let content = this.buildInviteLogMessage(member, usedInvite, inviter);

      // Send log message with retries
      await this.retryOperation(async () => {
        await logChannel.send({
          content,
          allowedMentions: { parse: [] }, // Prevent unintended mentions
        });
      }, "Send log message");

      Logger.debug(`Successfully logged invite usage for ${member.user.tag}`);
    } catch (error) {
      Logger.error("Error logging invite usage:", error.message);
      // Non-critical error, don't re-throw
    }
  }

  /**
   * Build invite log message
   * @private
   * @param {GuildMember} member - The member that joined
   * @param {Object} usedInvite - The invite that was used
   * @param {User|null} inviter - The user who created the invite
   * @returns {string} Formatted log message
   */
  buildInviteLogMessage(member, usedInvite, inviter) {
    const parts = [];

    // Add member info
    parts.push(`${member.user.tag}`);

    // Add join type
    parts.push(usedInvite.isRejoin ? "rejoined using" : "joined using");

    // Add invite info
    parts.push(usedInvite.isRejoin ? "previous invite" : "invite code");
    parts.push(usedInvite.code);

    // Add inviter info
    parts.push(`from ${inviter?.tag || "Unknown"}`);

    // Add usage count if applicable
    if (!usedInvite.isNew && !usedInvite.isRejoin && usedInvite.uses) {
      parts.push(
        `(used ${usedInvite.uses} time${usedInvite.uses !== 1 ? "s" : ""})`
      );
    }

    // Add metadata flags
    const flags = [];
    if (usedInvite.temporary) flags.push("Temporary");
    if (usedInvite.maxUses) flags.push(`Max uses: ${usedInvite.maxUses}`);
    if (usedInvite.channel) flags.push(`Channel: #${usedInvite.channel}`);

    if (flags.length > 0) {
      parts.push(`[${flags.join(" | ")}]`);
    }

    return parts.join(" ");
  }

  /**
   * Handle member leave with retries and better tracking
   * @param {GuildMember} member - The member that left
   * @returns {Promise<void>}
   */
  async handleMemberLeave(member) {
    try {
      // Find the most recent invite usage with retries
      const inviteUsage = await this.retryOperation(
        async () => {
          const usage = await InviteUsageModel.findOne({
            guildId: member.guild.id,
            invitedId: member.id,
            leftAt: null,
          }).sort({ joinedAt: -1 });

          if (!usage) {
            throw new Error("No active invite usage found");
          }
          return usage;
        },
        "Find invite usage",
        2
      ).catch((error) => {
        Logger.warn(
          `No active invite usage found for ${member.user.tag}: ${error.message}`
        );
        return null;
      });

      if (inviteUsage?.inviterId) {
        // Update invite usage record with retries
        await this.retryOperation(async () => {
          const updated = await InviteUsageModel.findByIdAndUpdate(
            inviteUsage._id,
            {
              $set: {
                leftAt: new Date(),
                leaveReason: member.joinedAt
                  ? `Left after ${Math.floor(
                      (Date.now() - member.joinedAt) / (1000 * 60)
                    )} minutes`
                  : "Left",
              },
            },
            { new: true }
          );
          if (!updated) {
            throw new Error("Failed to update invite usage");
          }
          return updated;
        }, "Update invite usage");

        // Update inviter stats with retries
        await this.retryOperation(async () => {
          const updated = await InviterStatsModel.findOneAndUpdate(
            {
              guildId: member.guild.id,
              userId: inviteUsage.inviterId,
            },
            {
              $inc: {
                "invites.left": 1,
                "invites.active": -1,
              },
              $set: { lastUpdated: new Date() },
            },
            { new: true }
          );
          if (!updated) {
            throw new Error("Failed to update inviter stats");
          }
          return updated;
        }, "Update inviter stats");

        Logger.debug(
          `Successfully processed leave for ${member.user.tag} (invited by ${inviteUsage.inviterId})`
        );
      }
    } catch (error) {
      Logger.error("Error handling member leave:", error.message);
      // Non-critical error, don't re-throw
    }
  }

  /**
   * Get invite statistics for a user with retries and validation
   * @param {string} guildId - ID of the guild
   * @param {string} userId - ID of the user to get stats for
   * @returns {Promise<Object|null>} User's invite statistics or null if error
   */
  async getInviterStats(guildId, userId) {
    if (!guildId || !userId) {
      Logger.warn("Missing required parameters for getInviterStats");
      return null;
    }

    try {
      // Get or create stats with retries
      const stats = await this.retryOperation(async () => {
        let userStats = await InviterStatsModel.findOne({ guildId, userId });

        if (!userStats) {
          userStats = await InviterStatsModel.create({
            guildId,
            userId,
            invites: { total: 0, left: 0, fake: 0, bonus: 0 },
            createdAt: new Date(),
            lastUpdated: new Date(),
          });
        }

        return userStats;
      }, "Get inviter stats");

      // Get active invites count with retries
      const activeInvites = await this.retryOperation(
        async () => {
          const count = await InviteUsageModel.countDocuments({
            guildId,
            inviterId: userId,
            leftAt: null,
          });
          return count;
        },
        "Count active invites",
        2 // Fewer retries for non-critical operation
      );

      // Calculate statistics
      const inviteStats = {
        total: stats.invites.total || 0,
        left: stats.invites.left || 0,
        fake: stats.invites.fake || 0,
        bonus: stats.invites.bonus || 0,
        active: activeInvites,
        real:
          (stats.invites.total || 0) -
          (stats.invites.left || 0) -
          (stats.invites.fake || 0) +
          (stats.invites.bonus || 0),
        // Add additional useful stats
        joinedAt: stats.createdAt,
        lastInvite: stats.lastInvite,
        lastUpdated: stats.lastUpdated,
      };

      Logger.debug(
        `Retrieved invite stats for user ${userId} in guild ${guildId}: ` +
          `${inviteStats.total} total, ${inviteStats.active} active`
      );

      return inviteStats;
    } catch (error) {
      Logger.error("Error getting inviter stats:", error.message);
      return null;
    }
  }
}

export default InviteManager;
