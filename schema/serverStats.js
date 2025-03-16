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
  try {
    const now = new Date();

    // Calculate days since join with validation
    const joinDate = new Date(this.joinTimestamp);
    const daysSinceJoin = Math.max(0, (now - joinDate) / (1000 * 60 * 60 * 24));

    // Calculate base scores
    const messageScore = Math.min(10000, this.messageStats.totalCount) * 2; // Cap at 10k messages
    const voiceScore = Math.min(1440, this.voiceStats.totalMinutes); // Cap at 24 hours
    const threadScore = Math.min(
      1000,
      this.threadParticipation.created * 5 +
        this.threadParticipation.joined * 2 +
        this.threadParticipation.messagesInThreads
    );

    // Calculate recency bonus (up to 2x multiplier for very recent activity)
    let recencyBonus = 0;
    if (this.lastActive) {
      const lastActiveDate = new Date(this.lastActive);
      const hoursSinceActive = Math.max(
        0,
        (now - lastActiveDate) / (1000 * 60 * 60)
      );
      recencyBonus = Math.max(0, 100 - hoursSinceActive); // More granular bonus based on hours
    }

    // Calculate final score with bounds
    const baseScore = messageScore + voiceScore + threadScore;
    const multiplier = 1 + recencyBonus / 100;
    const decay = Math.max(1, Math.log(daysSinceJoin + 1));

    const finalScore = Math.round((baseScore * multiplier) / decay);

    // Ensure score is within reasonable bounds
    return Math.max(0, Math.min(10000, finalScore));
  } catch (error) {
    console.error("Error calculating activity score:", error);
    return 0;
  }
};

// Create the models
const MemberActivity = mongoose.model("MemberActivity", memberActivitySchema);
const GuildSnapshot = mongoose.model("GuildSnapshot", guildSnapshotSchema);

// Export the models
export { MemberActivity, GuildSnapshot };
