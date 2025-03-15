import { MemberActivity, GuildSnapshot } from "../schema/serverStats.js";
import { LRUCache } from "lru-cache";

// Voice state tracking
export const voiceStates = new Map();

/**
 * Updates member activity data
 */
export async function updateMemberActivity(guildId, userId, updateData = {}) {
  try {
    return await MemberActivity.findOneAndUpdate(
      { guildId, userId },
      updateData,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );
  } catch (error) {
    console.error("Error updating member activity:", error);
    throw error;
  }
}

/**
 * Creates a snapshot of guild statistics
 */
export async function createGuildSnapshot(guild, interval = "1h") {
  try {
    const snapshot = new GuildSnapshot({
      guildId: guild.id,
      timestamp: new Date(),
      interval,
      metrics: {
        members: {
          total: guild.memberCount,
          active: guild.members.cache.filter((m) => !m.user.bot).size,
          voice: guild.members.cache.filter((m) => m.voice.channelId).size,
        },
        channels: {
          categories: guild.channels.cache.filter((c) => c.type === 4).size,
          text: guild.channels.cache.filter((c) => c.type === 0).size,
          voice: guild.channels.cache.filter((c) => c.type === 2).size,
          stage: guild.channels.cache.filter((c) => c.type === 13).size,
          forum: guild.channels.cache.filter((c) => c.type === 15).size,
        },
      },
    });

    await snapshot.save();
    return snapshot;
  } catch (error) {
    console.error("Error creating guild snapshot:", error);
    throw error;
  }
}

/**
 * Cleans up old voice states
 */
export function cleanupVoiceStates() {
  const now = Date.now();
  for (const [key, session] of voiceStates) {
    if (now - session.startTime > 24 * 60 * 60 * 1000) {
      // 24 hours
      voiceStates.delete(key);
    }
  }
}

/**
 * Handles voice state updates
 */
export async function handleVoiceUpdate(oldState, newState) {
  if (!newState.guild || newState.member.user.bot) return;

  const now = Date.now();
  const userId = newState.member.id;
  const guildId = newState.guild.id;
  const stateKey = `${guildId}-${userId}`;

  try {
    // Handle join
    if (!oldState.channelId && newState.channelId) {
      voiceStates.set(stateKey, {
        channelId: newState.channelId,
        startTime: now,
      });
    }
    // Handle leave
    else if (oldState.channelId && !newState.channelId) {
      const session = voiceStates.get(stateKey);
      if (session) {
        const duration = Math.floor((now - session.startTime) / 60000); // Minutes
        await updateVoiceStats(guildId, userId, oldState.channelId, duration);
        voiceStates.delete(stateKey);
      }
    }
    // Handle channel switch
    else if (
      oldState.channelId &&
      newState.channelId &&
      oldState.channelId !== newState.channelId
    ) {
      const session = voiceStates.get(stateKey);
      if (session) {
        const duration = Math.floor((now - session.startTime) / 60000);
        await updateVoiceStats(guildId, userId, oldState.channelId, duration);

        voiceStates.set(stateKey, {
          channelId: newState.channelId,
          startTime: now,
        });
      }
    }
  } catch (error) {
    console.error("Error handling voice state update:", error);
  }
}

/**
 * Updates voice statistics
 */
async function updateVoiceStats(guildId, userId, channelId, duration) {
  await updateMemberActivity(guildId, userId, {
    $inc: {
      "voiceStats.totalMinutes": duration,
      [`voiceStats.channelMinutes.${channelId}`]: duration,
    },
    $set: {
      "voiceStats.lastActive": new Date(),
      lastActive: new Date(),
    },
  });
}
