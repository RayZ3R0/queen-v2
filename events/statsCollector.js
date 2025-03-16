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
    // Get the member activity document
    let memberActivity = await MemberActivity.findOne({
      guildId: message.guild.id,
      userId: message.author.id,
    });

    if (!memberActivity) {
      memberActivity = new MemberActivity({
        guildId: message.guild.id,
        userId: message.author.id,
        joinTimestamp: message.member.joinedAt,
      });
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
    memberActivity.activityScore = memberActivity.calculateActivityScore();

    // Save all changes
    await memberActivity.save();

    console.debug(
      `Updated activity score for ${message.author.tag}: ${memberActivity.activityScore}`
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
      await MemberActivity.create({
        guildId: member.guild.id,
        userId: member.id,
        joinTimestamp: member.joinedTimestamp || new Date(),
        messageStats: {
          channelDistribution: new Map(),
          hourlyActivity: new Map(),
          weeklyActivity: new Map(),
        },
        voiceStats: {
          channelMinutes: new Map(),
        },
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
          member.activityScore = member.calculateActivityScore();
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
