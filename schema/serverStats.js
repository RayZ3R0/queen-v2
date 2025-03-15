import mongoose from "mongoose";

const memberActivitySchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    joinTimestamp: { type: Date, required: true },
    leaveHistory: [
      {
        leftAt: Date,
        rejoinedAt: Date,
      },
    ],
    messageStats: {
      totalCount: { type: Number, default: 0 },
      firstMessageTimestamp: Date,
      lastMessageTimestamp: Date,
      channelDistribution: { type: Map, of: Number, default: new Map() },
      hourlyActivity: { type: Map, of: Number, default: new Map() }, // 0-23
      weeklyActivity: { type: Map, of: Number, default: new Map() }, // 0-6
    },
    voiceStats: {
      totalMinutes: { type: Number, default: 0 },
      channelMinutes: { type: Map, of: Number, default: new Map() },
      lastActive: Date,
      hourlyActivity: { type: Map, of: Number, default: new Map() },
      weeklyActivity: { type: Map, of: Number, default: new Map() },
    },
    threadParticipation: {
      created: { type: Number, default: 0 },
      joined: { type: Number, default: 0 },
      messagesInThreads: { type: Number, default: 0 },
    },
    lastActive: Date,
    activityScore: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    indexes: [
      { guildId: 1, userId: 1 },
      { lastActive: 1 },
      { activityScore: -1 },
    ],
  }
);

const guildSnapshotSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    timestamp: { type: Date, required: true },
    interval: { type: String, required: true }, // '1h', '1d', '1w', '1m'
    metrics: {
      members: {
        total: Number,
        active: Number, // message/voice in last 7 days
        voice: Number, // currently in voice
        messageAuthors: Number,
      },
      messages: {
        total: Number,
        perChannel: { type: Map, of: Number, default: new Map() },
        withFiles: Number,
        withEmbeds: Number,
        withStickers: Number,
        withReactions: Number,
      },
      voice: {
        totalMinutes: Number,
        perChannel: { type: Map, of: Number, default: new Map() },
        peakConcurrent: Number,
      },
      threads: {
        active: Number,
        created: Number,
        archived: Number,
        messageCount: Number,
      },
      channels: {
        categories: Number,
        text: Number,
        voice: Number,
        stage: Number,
        forum: Number,
      },
    },
    activityHeatmap: {
      hourly: { type: Map, of: Number, default: new Map() },
      daily: { type: Map, of: Number, default: new Map() },
    },
  },
  {
    timestamps: true,
    indexes: [
      { guildId: 1, timestamp: -1 },
      { guildId: 1, interval: 1 },
      { timestamp: 1 },
    ],
  }
);

// Add TTL index for automatic cleanup of old snapshots
guildSnapshotSchema.index(
  { timestamp: 1 },
  {
    expireAfterSeconds: 60 * 60 * 24 * 90, // 90 days
  }
);

// Helper methods for MemberActivity
memberActivitySchema.methods.updateMessageStats = async function (channelId) {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Update total count
  this.messageStats.totalCount++;

  // Set first message timestamp if not set
  if (!this.messageStats.firstMessageTimestamp) {
    this.messageStats.firstMessageTimestamp = now;
  }

  // Update last message timestamp
  this.messageStats.lastMessageTimestamp = now;

  // Update channel distribution
  const currentChannelCount =
    this.messageStats.channelDistribution.get(channelId) || 0;
  this.messageStats.channelDistribution.set(channelId, currentChannelCount + 1);

  // Update hourly activity
  const currentHourCount = this.messageStats.hourlyActivity.get(hour) || 0;
  this.messageStats.hourlyActivity.set(hour, currentHourCount + 1);

  // Update weekly activity
  const currentDayCount = this.messageStats.weeklyActivity.get(day) || 0;
  this.messageStats.weeklyActivity.set(day, currentDayCount + 1);

  // Update lastActive
  this.lastActive = now;

  // Recalculate activity score
  this.activityScore = this.calculateActivityScore();

  await this.save();
};

memberActivitySchema.methods.calculateActivityScore = function () {
  const now = new Date();
  const daysSinceJoin = (now - this.joinTimestamp) / (1000 * 60 * 60 * 24);
  const messageScore = this.messageStats.totalCount * 2;
  const voiceScore = this.voiceStats.totalMinutes;
  const threadScore =
    this.threadParticipation.created * 5 +
    this.threadParticipation.joined * 2 +
    this.threadParticipation.messagesInThreads;

  // Weight recent activity more heavily
  const recencyBonus = this.lastActive
    ? Math.max(0, 100 - (now - this.lastActive) / (1000 * 60 * 60 * 24))
    : 0;

  return Math.round(
    ((messageScore + voiceScore + threadScore) * (1 + recencyBonus / 100)) /
      Math.max(1, Math.log(daysSinceJoin + 1))
  );
};

export const MemberActivity = mongoose.model(
  "MemberActivity",
  memberActivitySchema
);
export const GuildSnapshot = mongoose.model(
  "GuildSnapshot",
  guildSnapshotSchema
);
