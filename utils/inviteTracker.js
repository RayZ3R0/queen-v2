import { Collection } from "discord.js";
import { InviteStats, InviteUsage, InviteCache } from "../schema/inviteSystem.js";

const FAKE_ACCOUNT_THRESHOLD_DAYS = 7; // Accounts younger than 7 days are considered fake
const INVITE_LOGS_CHANNEL_ID = "901818838381891624";

export class InviteTracker {
  constructor(client) {
    this.client = client;
    this.inviteCache = new Map(); // guildId -> Map<code, invite data>
  }

  /**
   * Initialize invite tracking for all guilds
   */
  async initialize() {
    console.log("🔄 Initializing invite tracking system...");
    
    for (const guild of this.client.guilds.cache.values()) {
      await this.cacheInvites(guild);
    }
    
    console.log("✅ Invite tracking system initialized");
  }

  /**
   * Cache all invites for a guild
   */
  async cacheInvites(guild) {
    try {
      // Check if bot has permission
      const botMember = guild.members.me;
      if (!botMember.permissions.has("ManageGuild")) {
        console.warn(`❌ Missing ManageGuild permission in ${guild.name}`);
        return;
      }

      const invites = await guild.invites.fetch();
      const guildCache = new Map();

      // Cache regular invites
      for (const [code, invite] of invites) {
        const inviteData = {
          code: invite.code,
          uses: invite.uses || 0,
          inviterId: invite.inviter?.id || null,
          maxUses: invite.maxUses || 0,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdTimestamp,
        };
        
        guildCache.set(code, inviteData);

        // Update database cache
        await InviteCache.findOneAndUpdate(
          { guildId: guild.id, code: invite.code },
          {
            guildId: guild.id,
            code: invite.code,
            inviterId: inviteData.inviterId,
            uses: inviteData.uses,
            maxUses: inviteData.maxUses,
            isVanity: false,
            expiresAt: inviteData.expiresAt,
            lastUpdated: new Date(),
          },
          { upsert: true, new: true }
        );
      }

      // Check for vanity URL
      if (guild.vanityURLCode) {
        try {
          const vanityData = await guild.fetchVanityData();
          const vanityInfo = {
            code: guild.vanityURLCode,
            uses: vanityData.uses || 0,
            inviterId: guild.ownerId,
            maxUses: 0,
            isVanity: true,
          };
          
          guildCache.set(guild.vanityURLCode, vanityInfo);

          await InviteCache.findOneAndUpdate(
            { guildId: guild.id, code: guild.vanityURLCode },
            {
              guildId: guild.id,
              code: guild.vanityURLCode,
              inviterId: guild.ownerId,
              uses: vanityInfo.uses,
              maxUses: 0,
              isVanity: true,
              lastUpdated: new Date(),
            },
            { upsert: true, new: true }
          );
        } catch (err) {
          // Vanity not available or guild doesn't have one
        }
      }

      this.inviteCache.set(guild.id, guildCache);
      console.log(`📥 Cached ${guildCache.size} invites for ${guild.name}`);
    } catch (error) {
      console.error(`Error caching invites for ${guild.name}:`, error.message);
    }
  }

  /**
   * Find which invite was used
   */
  async findUsedInvite(guild) {
    try {
      const oldCache = this.inviteCache.get(guild.id) || new Map();
      const newInvites = await guild.invites.fetch();
      
      console.log(`🔍 Comparing invites: ${oldCache.size} cached, ${newInvites.size} current`);
      
      // Check regular invites
      for (const [code, newInvite] of newInvites) {
        const oldInvite = oldCache.get(code);
        
        if (oldInvite) {
          console.log(`  Checking ${code}: old=${oldInvite.uses}, new=${newInvite.uses}`);
        }
        
        if (oldInvite && newInvite.uses > oldInvite.uses) {
          // This invite was used!
          console.log(`✅ Found used invite: ${code} by ${newInvite.inviter?.tag}`);
          return {
            code: newInvite.code,
            inviterId: newInvite.inviter?.id || null,
            type: 'normal',
          };
        }
      }

      // Check vanity URL
      if (guild.vanityURLCode) {
        try {
          const vanityData = await guild.fetchVanityData();
          const oldVanity = oldCache.get(guild.vanityURLCode);
          
          if (oldVanity && vanityData.uses > oldVanity.uses) {
            return {
              code: guild.vanityURLCode,
              inviterId: guild.ownerId,
              type: 'vanity',
            };
          }
        } catch (err) {
          // Vanity check failed
        }
      }

      // Couldn't determine invite - could be widget, discovery, etc.
      return {
        code: 'unknown',
        inviterId: null,
        type: 'unknown',
      };
    } catch (error) {
      console.error("Error finding used invite:", error.message);
      return {
        code: 'unknown',
        inviterId: null,
        type: 'unknown',
      };
    }
  }

  /**
   * Handle member join
   */
  async handleJoin(member) {
    if (member.user.bot) return;

    try {
      console.log(`🔎 Processing join for ${member.user.tag}...`);
      
      // Find which invite was used
      const usedInvite = await this.findUsedInvite(member.guild);
      console.log(`📋 Used invite: ${usedInvite.code} (${usedInvite.type}), inviter: ${usedInvite.inviterId || 'unknown'}`);
      
      // Recache invites
      await this.cacheInvites(member.guild);

      // Check if account is fake
      const accountAge = Date.now() - member.user.createdTimestamp;
      const accountAgeDays = accountAge / (1000 * 60 * 60 * 24);
      const isFake = accountAgeDays < FAKE_ACCOUNT_THRESHOLD_DAYS;

      console.log(`📊 Account age: ${Math.floor(accountAgeDays)} days, isFake: ${isFake}`);

      // Save usage record
      await InviteUsage.create({
        guildId: member.guild.id,
        inviterId: usedInvite.inviterId || member.guild.ownerId,
        invitedUserId: member.id,
        inviteCode: usedInvite.code,
        inviteType: usedInvite.type,
        isFake: isFake,
        joinedAt: new Date(),
        accountCreatedAt: new Date(member.user.createdTimestamp),
        accountAgeDays: Math.floor(accountAgeDays),
      });
      
      console.log(`💾 Saved invite usage record to database`);

      // Update inviter stats
      if (usedInvite.inviterId) {
        const stats = await InviteStats.findOneAndUpdate(
          { guildId: member.guild.id, userId: usedInvite.inviterId },
          {
            $inc: {
              [isFake ? 'invites.fake' : 'invites.regular']: 1,
            },
            lastUpdated: new Date(),
          },
          { upsert: true, new: true }
        );
        
        console.log(`📈 Updated stats for inviter ${usedInvite.inviterId}: ${isFake ? 'fake' : 'regular'} +1`);

        // Log to channel
        await this.logInvite(member, usedInvite, stats, isFake);
      } else {
        // Unknown inviter - log it anyway
        await this.logInvite(member, usedInvite, null, isFake);
      }
    } catch (error) {
      console.error("Error handling member join:", error);
    }
  }

  /**
   * Handle member leave
   */
  async handleLeave(member) {
    if (member.user.bot) return;

    try {
      // Find their join record
      const usage = await InviteUsage.findOne({
        guildId: member.guild.id,
        invitedUserId: member.id,
        leftAt: null,
      });

      if (usage) {
        // Mark as left
        usage.leftAt = new Date();
        await usage.save();

        // Update inviter stats
        if (usage.inviterId) {
          await InviteStats.findOneAndUpdate(
            { guildId: member.guild.id, userId: usage.inviterId },
            {
              $inc: {
                'invites.leaves': 1,
                [usage.isFake ? 'invites.fake' : 'invites.regular']: -1,
              },
              lastUpdated: new Date(),
            }
          );
        }

        // Log leave
        await this.logLeave(member, usage);
      }
    } catch (error) {
      console.error("Error handling member leave:", error);
    }
  }

  /**
   * Log invite to channel
   */
  async logInvite(member, invite, stats, isFake) {
    try {
      console.log(`📝 Attempting to log invite to channel ${INVITE_LOGS_CHANNEL_ID}...`);
      
      const { EmbedBuilder } = await import("discord.js");
      const channel = this.client.channels.cache.get(INVITE_LOGS_CHANNEL_ID);
      
      if (!channel) {
        console.error(`❌ Could not find invite logs channel: ${INVITE_LOGS_CHANNEL_ID}`);
        return;
      }
      
      console.log(`✅ Found channel: ${channel.name}`);

      let inviterText = "Unknown";
      let inviterMention = "Unknown";
      
      if (invite.inviterId) {
        try {
          const inviter = await this.client.users.fetch(invite.inviterId);
          inviterText = inviter.tag;
          inviterMention = `<@${inviter.id}>`;
        } catch (err) {
          inviterText = `User ID: ${invite.inviterId}`;
          inviterMention = `<@${invite.inviterId}>`;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(isFake ? "#ff6b6b" : "#00ff00")
        .setAuthor({
          name: `${member.user.tag} joined`,
          iconURL: member.user.displayAvatarURL(),
        })
        .setDescription(
          `**Member:** ${member} (${member.id})\n` +
          `**Invited by:** ${inviterMention}\n` +
          `**Invite Code:** \`${invite.code}\` ${invite.type === 'vanity' ? '(Vanity URL)' : invite.type === 'unknown' ? '(Unknown)' : ''}\n` +
          `**Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>\n` +
          `${isFake ? '⚠️ **Fake Account** (< 7 days old)' : ''}`
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();

      if (stats) {
        const total = stats.invites.regular + stats.invites.bonus - stats.invites.leaves - stats.invites.fake;
        embed.addFields({
          name: `${inviterText}'s Invites`,
          value: 
            `Total: **${total}**\n` +
            `Regular: ${stats.invites.regular} | Bonus: ${stats.invites.bonus}\n` +
            `Leaves: ${stats.invites.leaves} | Fake: ${stats.invites.fake}`,
        });
      }

      await channel.send({ embeds: [embed] });
      console.log(`✅ Successfully logged invite to channel`);
    } catch (error) {
      console.error("Error logging invite:", error);
    }
  }

  /**
   * Log member leave
   */
  async logLeave(member, usage) {
    try {
      const { EmbedBuilder } = await import("discord.js");
      const channel = this.client.channels.cache.get(INVITE_LOGS_CHANNEL_ID);
      if (!channel) return;

      let inviterMention = "Unknown";
      if (usage.inviterId) {
        try {
          const inviter = await this.client.users.fetch(usage.inviterId);
          inviterMention = `<@${inviter.id}>`;
        } catch (err) {
          inviterMention = `<@${usage.inviterId}>`;
        }
      }

      const memberFor = Date.now() - usage.joinedAt.getTime();
      const days = Math.floor(memberFor / (1000 * 60 * 60 * 24));

      const embed = new EmbedBuilder()
        .setColor("#ff6b6b")
        .setAuthor({
          name: `${member.user.tag} left`,
          iconURL: member.user.displayAvatarURL(),
        })
        .setDescription(
          `**Member:** ${member.user.tag} (${member.id})\n` +
          `**Invited by:** ${inviterMention}\n` +
          `**Invite Code:** \`${usage.inviteCode}\`\n` +
          `**Member For:** ${days} days\n` +
          `**Joined:** <t:${Math.floor(usage.joinedAt.getTime() / 1000)}:R>`
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Error logging leave:", error);
    }
  }

  /**
   * Get user's invite stats
   */
  async getStats(guildId, userId) {
    let stats = await InviteStats.findOne({ guildId, userId });
    
    if (!stats) {
      stats = await InviteStats.create({
        guildId,
        userId,
        invites: { regular: 0, bonus: 0, leaves: 0, fake: 0 },
      });
    }

    const total = stats.invites.regular + stats.invites.bonus - stats.invites.leaves - stats.invites.fake;

    return {
      regular: stats.invites.regular,
      bonus: stats.invites.bonus,
      leaves: stats.invites.leaves,
      fake: stats.invites.fake,
      total: Math.max(0, total),
    };
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(guildId, limit = 10) {
    const allStats = await InviteStats.find({ guildId });
    
    // Calculate totals and sort
    const leaderboard = allStats
      .map(stat => ({
        userId: stat.userId,
        regular: stat.invites.regular,
        bonus: stat.invites.bonus,
        leaves: stat.invites.leaves,
        fake: stat.invites.fake,
        total: stat.invites.regular + stat.invites.bonus - stat.invites.leaves - stat.invites.fake,
      }))
      .filter(stat => stat.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);

    return leaderboard;
  }

  /**
   * Add bonus invites (admin only)
   */
  async addBonus(guildId, userId, amount) {
    const stats = await InviteStats.findOneAndUpdate(
      { guildId, userId },
      {
        $inc: { 'invites.bonus': amount },
        lastUpdated: new Date(),
      },
      { upsert: true, new: true }
    );

    return stats;
  }

  /**
   * Reset user invites
   */
  async resetUser(guildId, userId) {
    await InviteStats.findOneAndUpdate(
      { guildId, userId },
      {
        invites: { regular: 0, bonus: 0, leaves: 0, fake: 0 },
        lastUpdated: new Date(),
      },
      { upsert: true }
    );
  }

  /**
   * Reset all invites for guild
   */
  async resetAll(guildId) {
    await InviteStats.deleteMany({ guildId });
    await InviteUsage.deleteMany({ guildId });
    await InviteCache.deleteMany({ guildId });
  }
}
