import mongoose from "mongoose";

const memberActivitySchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    joinTimestamp: { type: Date, required: true, default: Date.now },
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
      { joinTimestamp: -1 },
      { "leaveHistory.leftAt": 1 },
      { "leaveHistory.rejoinedAt": 1 },
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

// Add error handler for validation errors
memberActivitySchema.post("save", function (error, doc, next) {
  if (error.name === "ValidationError") {
    console.error("MemberActivity Validation Error:", {
      document: doc?.guildId,
      userId: doc?.userId,
      error: error.message,
      details: error.errors,
    });
  }
  next(error);
});

// Add pre-save middleware for validation and data sanitization
memberActivitySchema.pre("save", function (next) {
  const now = new Date();

  // Ensure joinTimestamp exists and is valid
  if (!this.joinTimestamp || isNaN(this.joinTimestamp.getTime())) {
    this.joinTimestamp = now;
  }

  // Validate activityScore
  if (isNaN(this.activityScore)) {
    this.activityScore = 0;
  }

  // Ensure all maps and required fields exist with proper defaults
  this.messageStats = this.messageStats || {};
  this.voiceStats = this.voiceStats || {};
  this.threadParticipation = this.threadParticipation || {
    created: 0,
    joined: 0,
    messagesInThreads: 0,
  };

  // Initialize messageStats fields
  this.messageStats.totalCount = this.messageStats.totalCount || 0;
  this.messageStats.channelDistribution =
    this.messageStats.channelDistribution || new Map();
  this.messageStats.hourlyActivity =
    this.messageStats.hourlyActivity || new Map();
  this.messageStats.weeklyActivity =
    this.messageStats.weeklyActivity || new Map();

  // Initialize voiceStats fields
  this.voiceStats.totalMinutes = this.voiceStats.totalMinutes || 0;
  this.voiceStats.channelMinutes = this.voiceStats.channelMinutes || new Map();
  this.voiceStats.hourlyActivity = this.voiceStats.hourlyActivity || new Map();
  this.voiceStats.weeklyActivity = this.voiceStats.weeklyActivity || new Map();

  // Ensure timestamps
  this.lastActive = this.lastActive || now;
  this.leaveHistory = this.leaveHistory || [];

  next();
});

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

    // Ensure all required properties exist with defaults
    this.messageStats = this.messageStats || {};
    this.voiceStats = this.voiceStats || {};
    this.threadParticipation = this.threadParticipation || {};

    // Set default values for all numeric fields
    const messageCount = Number(this.messageStats.totalCount) || 0;
    const voiceMinutes = Number(this.voiceStats.totalMinutes) || 0;
    const threadsCreated = Number(this.threadParticipation.created) || 0;
    const threadsJoined = Number(this.threadParticipation.joined) || 0;
    const threadMessages =
      Number(this.threadParticipation.messagesInThreads) || 0;

    // Calculate days since join with validation
    const joinDate = new Date(this.joinTimestamp || now); // Fallback to now if missing
    const daysSinceJoin = Math.max(0, (now - joinDate) / (1000 * 60 * 60 * 24));

    // Calculate base scores with safe operations
    const messageScore = Math.min(10000, messageCount) * 2; // Cap at 10k messages
    const voiceScore = Math.min(1440, voiceMinutes); // Cap at 24 hours
    const threadScore = Math.min(
      1000,
      threadsCreated * 5 + threadsJoined * 2 + threadMessages
    );

    // Calculate recency bonus with validation
    let recencyBonus = 0;
    if (this.lastActive) {
      const lastActiveDate = new Date(this.lastActive);
      const hoursSinceActive = Math.max(
        0,
        (now - lastActiveDate) / (1000 * 60 * 60)
      );
      recencyBonus = Math.max(0, Math.min(100, 100 - hoursSinceActive)); // Clamp between 0-100
    }

    // Calculate final score with bounds and safety checks
    const baseScore = messageScore + voiceScore + threadScore;
    const multiplier = 1 + recencyBonus / 100;
    const decay = Math.max(1, Math.log(daysSinceJoin + 1));

    const finalScore = Math.round((baseScore * multiplier) / decay);

    // Ensure score is a valid number and within bounds
    if (isNaN(finalScore)) {
      console.error("Invalid score calculation:", {
        messageScore,
        voiceScore,
        threadScore,
        multiplier,
        decay,
      });
      return 0;
    }

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
