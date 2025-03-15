import { client } from "../bot.js";
import { MemberActivity, GuildSnapshot } from "../schema/serverStats.js";
import { ChannelType, Events } from "discord.js";

let voiceStates = new Map(); // Track ongoing voice sessions

/**
 * Updates or creates member activity record
 */
async function updateMemberActivity(guildId, userId, updateData = {}) {
  try {
    const activity = await MemberActivity.findOneAndUpdate(
      { guildId, userId },
      updateData,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
    return activity;
  } catch (error) {
    console.error("Error updating member activity:", error);
  }
}

/**
 * Creates periodic snapshots of guild statistics
 */
async function createGuildSnapshot(guild, interval = "1h") {
  try {
    const members = await guild.members.fetch();
    const channels = await guild.channels.fetch();

    const snapshot = new GuildSnapshot({
      guildId: guild.id,
      timestamp: new Date(),
      interval,
      metrics: {
        members: {
          total: members.size,
          active: members.filter((m) => !m.user.bot).size,
          voice: members.filter((m) => m.voice.channelId).size,
          messageAuthors: 0, // Will be updated by message events
        },
        channels: {
          categories: channels.filter(
            (c) => c.type === ChannelType.GuildCategory
          ).size,
          text: channels.filter((c) => c.type === ChannelType.GuildText).size,
          voice: channels.filter((c) => c.type === ChannelType.GuildVoice).size,
          stage: channels.filter((c) => c.type === ChannelType.GuildStageVoice)
            .size,
          forum: channels.filter((c) => c.type === ChannelType.GuildForum).size,
        },
      },
    });

    await snapshot.save();
  } catch (error) {
    console.error("Error creating guild snapshot:", error);
  }
}

// Message Events
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  try {
    // Update member's message statistics
    await updateMemberActivity(message.guild.id, message.author.id, {
      $inc: { "messageStats.totalCount": 1 },
      $set: {
        "messageStats.lastMessageTimestamp": new Date(),
        lastActive: new Date(),
      },
    });

    // Update channel distribution
    await MemberActivity.findOneAndUpdate(
      { guildId: message.guild.id, userId: message.author.id },
      {
        $inc: { [`messageStats.channelDistribution.${message.channel.id}`]: 1 },
      }
    );

    // Update hourly and daily activity
    const hour = new Date().getHours();
    const day = new Date().getDay();

    await MemberActivity.findOneAndUpdate(
      { guildId: message.guild.id, userId: message.author.id },
      {
        $inc: {
          [`messageStats.hourlyActivity.${hour}`]: 1,
          [`messageStats.weeklyActivity.${day}`]: 1,
        },
      }
    );
  } catch (error) {
    console.error("Error handling message event:", error);
  }
});

// Voice State Events
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (!newState.guild || newState.member.user.bot) return;

  try {
    const now = Date.now();
    const userId = newState.member.id;
    const guildId = newState.guild.id;

    // Handle join
    if (!oldState.channelId && newState.channelId) {
      voiceStates.set(`${guildId}-${userId}`, {
        channelId: newState.channelId,
        startTime: now,
      });
    }
    // Handle leave
    else if (oldState.channelId && !newState.channelId) {
      const session = voiceStates.get(`${guildId}-${userId}`);
      if (session) {
        const duration = Math.floor((now - session.startTime) / 60000); // Convert to minutes

        await updateMemberActivity(guildId, userId, {
          $inc: {
            "voiceStats.totalMinutes": duration,
            [`voiceStats.channelMinutes.${oldState.channelId}`]: duration,
          },
          $set: {
            "voiceStats.lastActive": new Date(),
            lastActive: new Date(),
          },
        });

        voiceStates.delete(`${guildId}-${userId}`);
      }
    }
    // Handle channel switch
    else if (
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !== newState.channelId
    ) {
      const session = voiceStates.get(`${guildId}-${userId}`);
      if (session) {
        const duration = Math.floor((now - session.startTime) / 60000);

        await updateMemberActivity(guildId, userId, {
          $inc: {
            "voiceStats.totalMinutes": duration,
            [`voiceStats.channelMinutes.${oldState.channelId}`]: duration,
          },
        });

        voiceStates.set(`${guildId}-${userId}`, {
          channelId: newState.channelId,
          startTime: now,
        });
      }
    }
  } catch (error) {
    console.error("Error handling voice state update:", error);
  }
});

// Member Events
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
    console.error("Error handling member join:", error);
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
    console.error("Error handling member leave:", error);
  }
});

// Thread Events
client.on(Events.ThreadCreate, async (thread) => {
  if (!thread.guild) return;

  try {
    await updateMemberActivity(thread.guild.id, thread.ownerId, {
      $inc: { "threadParticipation.created": 1 },
    });
  } catch (error) {
    console.error("Error handling thread creation:", error);
  }
});

// Periodic Snapshots
setInterval(async () => {
  try {
    for (const [guildId, guild] of client.guilds.cache) {
      await createGuildSnapshot(guild, "1h");
    }
  } catch (error) {
    console.error("Error creating periodic snapshots:", error);
  }
}, 60 * 60 * 1000); // Every hour

// Daily cleanup of voice states
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of voiceStates) {
    if (now - session.startTime > 24 * 60 * 60 * 1000) {
      // 24 hours
      voiceStates.delete(key);
    }
  }
}, 24 * 60 * 60 * 1000); // Every 24 hours
