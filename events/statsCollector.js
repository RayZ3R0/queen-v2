import { client } from "../bot.js";
import { MemberActivity, GuildSnapshot } from "../schema/serverStats.js";
import { ChannelType, Events } from "discord.js";

let voiceStates = new Map(); // Track ongoing voice sessions

/**
 * Updates or creates member activity record
 */
async function updateMemberActivity(guildId, userId, updateData = {}) {
  try {
    // Validate numeric values in updateData
    if (updateData.$inc) {
      Object.values(updateData.$inc).forEach((value) => {
        if (isNaN(value)) {
          throw new Error("Invalid numeric value in update data");
        }
      });
    }

    // First try to find the existing document
    let activity = await MemberActivity.findOne({ guildId, userId });

    if (!activity) {
      // If no document exists, we need to fetch the member to get joinTimestamp
      try {
        const guild = await client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        const now = new Date();

        activity = new MemberActivity({
          guildId,
          userId,
          joinTimestamp: member.joinedTimestamp || now,
          messageStats: {
            totalCount: 0,
            channelDistribution: new Map(),
            hourlyActivity: new Map(),
            weeklyActivity: new Map(),
            firstMessageTimestamp: now,
            lastMessageTimestamp: now,
          },
          voiceStats: {
            totalMinutes: 0,
            channelMinutes: new Map(),
            hourlyActivity: new Map(),
            weeklyActivity: new Map(),
            lastActive: now,
          },
          threadParticipation: {
            created: 0,
            joined: 0,
            messagesInThreads: 0,
          },
          lastActive: now,
          activityScore: 0,
          leaveHistory: [],
        });
      } catch (err) {
        console.error("Error fetching member for joinTimestamp:", err);
        // Create with current timestamp as fallback
        const now = new Date();
        activity = new MemberActivity({
          guildId,
          userId,
          joinTimestamp: now, // Fallback to current time
          messageStats: {
            totalCount: 0,
            channelDistribution: new Map(),
            hourlyActivity: new Map(),
            weeklyActivity: new Map(),
            firstMessageTimestamp: now,
            lastMessageTimestamp: now,
          },
          voiceStats: {
            totalMinutes: 0,
            channelMinutes: new Map(),
            hourlyActivity: new Map(),
            weeklyActivity: new Map(),
            lastActive: now,
          },
          threadParticipation: {
            created: 0,
            joined: 0,
            messagesInThreads: 0,
          },
          lastActive: now,
          activityScore: 0,
          leaveHistory: [],
        });
      }
    }

    // Apply the updates with dot notation handling
    if (updateData.$inc) {
      Object.entries(updateData.$inc).forEach(([key, value]) => {
        const parts = key.split(".");
        let target = activity;

        // Navigate to the nested property
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]]) {
            // Initialize missing objects/maps
            if (
              parts[i + 1] === "channelMinutes" ||
              parts[i + 1] === "channelDistribution" ||
              parts[i + 1] === "hourlyActivity" ||
              parts[i + 1] === "weeklyActivity"
            ) {
              target[parts[i]] = { [parts[i + 1]]: new Map() };
            } else {
              target[parts[i]] = {};
            }
          }
          target = target[parts[i]];
        }

        const finalKey = parts[parts.length - 1];
        if (target instanceof Map) {
          target.set(finalKey, (target.get(finalKey) || 0) + value);
        } else {
          target[finalKey] = (target[finalKey] || 0) + value;
        }
      });
    }
    if (updateData.$set) {
      Object.entries(updateData.$set).forEach(([key, value]) => {
        const parts = key.split(".");
        let target = activity;

        // Navigate to the nested property
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]]) {
            target[parts[i]] = {};
          }
          target = target[parts[i]];
        }

        // Set the final value
        const finalKey = parts[parts.length - 1];

        // Check if this is a Map field
        if (
          parts[parts.length - 2] === "channelMinutes" ||
          parts[parts.length - 2] === "channelDistribution" ||
          parts[parts.length - 2] === "hourlyActivity" ||
          parts[parts.length - 2] === "weeklyActivity"
        ) {
          if (!(target instanceof Map)) {
            target = new Map();
          }
          target.set(finalKey, value);
        } else {
          target[finalKey] = value;
        }
      });
    }

    await activity.save();

    // Validate activity score after update
    if (isNaN(activity.activityScore)) {
      activity.activityScore = 0;
      await activity.save();
    }

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
    // Get the member activity document
    let memberActivity = await MemberActivity.findOne({
      guildId: message.guild.id,
      userId: message.author.id,
    });

    if (!memberActivity) {
      try {
        // Try to get member if not cached
        const member = await message.guild.members.fetch(message.author.id);

        memberActivity = new MemberActivity({
          guildId: message.guild.id,
          userId: message.author.id,
          joinTimestamp: member.joinedAt || new Date(),
          messageStats: {
            totalCount: 0,
            channelDistribution: new Map(),
            hourlyActivity: new Map(),
            weeklyActivity: new Map(),
          },
          voiceStats: {
            totalMinutes: 0,
            channelMinutes: new Map(),
            hourlyActivity: new Map(),
            weeklyActivity: new Map(),
          },
          threadParticipation: {
            created: 0,
            joined: 0,
            messagesInThreads: 0,
          },
          lastActive: new Date(),
          activityScore: 0,
          leaveHistory: [],
        });
      } catch (err) {
        console.error("Error fetching member data:", err);
        // Create with fallback timestamp
        const now = new Date();
        memberActivity = new MemberActivity({
          guildId: message.guild.id,
          userId: message.author.id,
          joinTimestamp: now,
          messageStats: {
            totalCount: 0,
            channelDistribution: new Map(),
            hourlyActivity: new Map(),
            weeklyActivity: new Map(),
            firstMessageTimestamp: now,
            lastMessageTimestamp: now,
          },
          voiceStats: {
            totalMinutes: 0,
            channelMinutes: new Map(),
            hourlyActivity: new Map(),
            weeklyActivity: new Map(),
            lastActive: now,
          },
          threadParticipation: {
            created: 0,
            joined: 0,
            messagesInThreads: 0,
          },
          lastActive: now,
          activityScore: 0,
          leaveHistory: [],
        });
      }
    }

    // Update all stats at once
    memberActivity.messageStats.totalCount++;
    memberActivity.messageStats.lastMessageTimestamp = new Date();
    memberActivity.lastActive = new Date();

    // Update channel distribution with string key
    const channelId = message.channel.id.toString();
    const currentChannelCount =
      memberActivity.messageStats.channelDistribution.get(channelId) || 0;
    memberActivity.messageStats.channelDistribution.set(
      channelId,
      currentChannelCount + 1
    );

    // Update hourly and weekly activity
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    const hourKey = hour.toString();
    const dayKey = day.toString();

    const hourlyCount =
      memberActivity.messageStats.hourlyActivity.get(hourKey) || 0;
    const weeklyCount =
      memberActivity.messageStats.weeklyActivity.get(dayKey) || 0;

    memberActivity.messageStats.hourlyActivity.set(hourKey, hourlyCount + 1);
    memberActivity.messageStats.weeklyActivity.set(dayKey, weeklyCount + 1);

    // Update first message timestamp if not set
    if (!memberActivity.messageStats.firstMessageTimestamp) {
      memberActivity.messageStats.firstMessageTimestamp = now;
    }

    // Recalculate activity score with new algorithm
    // Calculate and validate activity score
    const newScore = memberActivity.calculateActivityScore();
    if (!isNaN(newScore)) {
      memberActivity.activityScore = newScore;
    } else {
      console.warn(
        `Invalid activity score for ${message.author.tag}:`,
        newScore
      );
      memberActivity.activityScore = 0;
    }

    // Save all changes
    await memberActivity.save();

    // console.debug(
    //   `Updated activity score for ${message.author.tag}: ${memberActivity.activityScore}`
    // );
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
            [`voiceStats.channelMinutes.${oldState.channelId.toString()}`]:
              duration,
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
            [`voiceStats.channelMinutes.${oldState.channelId.toString()}`]:
              duration,
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
    // Check if member already exists
    const existingMember = await MemberActivity.findOne({
      guildId: member.guild.id,
      userId: member.id,
    });

    if (existingMember) {
      // Find the latest leave entry that doesn't have a rejoin date
      const lastLeave = existingMember.leaveHistory
        .slice()
        .reverse()
        .find((entry) => entry.leftAt && !entry.rejoinedAt);

      if (lastLeave) {
        // Update only the matching leave entry
        await MemberActivity.updateOne(
          {
            guildId: member.guild.id,
            userId: member.id,
            "leaveHistory.leftAt": lastLeave.leftAt,
          },
          {
            $set: {
              "leaveHistory.$.rejoinedAt": new Date(),
            },
          }
        );
      }

      // Update last join timestamp
      existingMember.joinTimestamp = member.joinedTimestamp || new Date();
      await existingMember.save();
    } else {
      // This is a first join - create new record
      const now = new Date();
      await MemberActivity.create({
        guildId: member.guild.id,
        userId: member.id,
        joinTimestamp: member.joinedTimestamp || now,
        messageStats: {
          totalCount: 0,
          channelDistribution: new Map(),
          hourlyActivity: new Map(),
          weeklyActivity: new Map(),
          firstMessageTimestamp: null,
          lastMessageTimestamp: null,
        },
        voiceStats: {
          totalMinutes: 0,
          channelMinutes: new Map(),
          hourlyActivity: new Map(),
          weeklyActivity: new Map(),
          lastActive: null,
        },
        threadParticipation: {
          created: 0,
          joined: 0,
          messagesInThreads: 0,
        },
        activityScore: 0,
        lastActive: now,
        leaveHistory: [],
      });
    }
  } catch (error) {
    console.error("Error handling member join:", error);
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  if (member.user.bot) return;

  try {
    const memberActivity = await MemberActivity.findOne({
      guildId: member.guild.id,
      userId: member.id,
    });

    if (memberActivity) {
      // Only add leave entry if the last one has a rejoinedAt date
      const lastLeave =
        memberActivity.leaveHistory[memberActivity.leaveHistory.length - 1];

      if (!lastLeave || lastLeave.rejoinedAt) {
        memberActivity.leaveHistory.push({
          leftAt: new Date(),
        });
        await memberActivity.save();
      }
    }
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

// Periodic Snapshots and Score Updates
setInterval(async () => {
  try {
    for (const [guildId, guild] of client.guilds.cache) {
      // Create snapshot
      await createGuildSnapshot(guild, "1h");

      // Update activity scores for all members
      const members = await MemberActivity.find({ guildId });
      for (const member of members) {
        try {
          const newScore = member.calculateActivityScore();
          if (!isNaN(newScore)) {
            member.activityScore = newScore;
          } else {
            console.warn(
              `Invalid periodic score update for member ${member.userId}:`,
              newScore
            );
            member.activityScore = 0;
          }
          await member.save();
        } catch (err) {
          console.error(
            `Error updating activity score for member ${member.userId}:`,
            err
          );
        }
      }

      console.log(
        `Updated activity scores for ${members.length} members in ${guild.name}`
      );
    }
  } catch (error) {
    console.error("Error in periodic updates:", error);
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
