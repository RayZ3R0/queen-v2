import { Events } from "discord.js";
import { client } from "../bot.js";
import {
  updateMemberActivity,
  createGuildSnapshot,
  handleVoiceUpdate,
  cleanupVoiceStates,
} from "../utils/statsUtils.js";
import GuildConfig from "../schema/guildConfig.js";

// Message tracking
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  try {
    // Check if channel is ignored
    const guildConfig = await GuildConfig.getOrCreate(message.guild.id);
    if (guildConfig.isChannelIgnored(message.channel.id)) return;

    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    await updateMemberActivity(message.guild.id, message.author.id, {
      $inc: {
        "messageStats.totalCount": 1,
        [`messageStats.channelDistribution.${message.channel.id}`]: 1,
        [`messageStats.hourlyActivity.${hour}`]: 1,
        [`messageStats.weeklyActivity.${day}`]: 1,
      },
      $set: {
        "messageStats.lastMessageTimestamp": now,
        lastActive: now,
      },
    });
  } catch (error) {
    console.error("Error tracking message stats:", error);
  }
});

// Voice state tracking
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (!newState.guild || newState.member.user.bot) return;

  try {
    // Check if new channel is ignored
    if (newState.channelId) {
      const guildConfig = await GuildConfig.getOrCreate(newState.guild.id);
      if (guildConfig.isChannelIgnored(newState.channelId)) {
        // If moving to an ignored channel, treat it as leaving voice
        newState.channelId = null;
      }
    }

    handleVoiceUpdate(oldState, newState);
  } catch (error) {
    console.error("Error handling voice state update:", error);
  }
});

// Member tracking
client.on(Events.GuildMemberAdd, async (member) => {
  if (member.user.bot) return;

  try {
    await updateMemberActivity(member.guild.id, member.id, {
      joinTimestamp: new Date(),
      $push: {
        leaveHistory: {
          rejoinedAt: new Date(),
        },
      },
    });
  } catch (error) {
    console.error("Error tracking member join:", error);
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  if (member.user.bot) return;

  try {
    await updateMemberActivity(member.guild.id, member.id, {
      $push: {
        leaveHistory: {
          leftAt: new Date(),
        },
      },
    });
  } catch (error) {
    console.error("Error tracking member leave:", error);
  }
});

// Periodic snapshots
setInterval(async () => {
  try {
    for (const [guildId, guild] of client.guilds.cache) {
      // Get guild config to check for ignored channels
      const guildConfig = await GuildConfig.getOrCreate(guildId);

      // Pass ignored channels to snapshot creation
      await createGuildSnapshot(guild, "1h", guildConfig.ignoredChannels);
    }
  } catch (error) {
    console.error("Error creating periodic snapshots:", error);
  }
}, 60 * 60 * 1000); // Every hour

// Daily cleanup
setInterval(cleanupVoiceStates, 24 * 60 * 60 * 1000); // Every 24 hours

export default (client) => {
  console.log("[✓] Stats handler loaded");
};
