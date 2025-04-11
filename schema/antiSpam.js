import mongoose from "mongoose";

const antiSpamSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  guildId: {
    type: String,
    required: true,
  },
  warnings: {
    type: Number,
    default: 0,
  },
  lastOffense: {
    type: Date,
    default: Date.now,
  },
  offenseHistory: [
    {
      type: {
        type: String,
        enum: ["CROSS_CHANNEL", "DUPLICATE", "LINK_SPAM"],
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
      channelIds: [String],
      content: String,
    },
  ],
  mutedUntil: {
    type: Date,
    default: null,
  },
  trustScore: {
    type: Number,
    default: 50,
  },
});

// Compound index for efficient lookups
antiSpamSchema.index({ userId: 1, guildId: 1 });

// Create or update spam record
antiSpamSchema.statics.updateRecord = async function (
  userId,
  guildId,
  offenseData
) {
  return this.findOneAndUpdate(
    { userId, guildId },
    {
      $inc: { warnings: 1 },
      $set: { lastOffense: new Date() },
      $push: {
        offenseHistory: {
          ...offenseData,
          timestamp: new Date(),
        },
      },
    },
    { upsert: true, new: true }
  );
};

// Reset warnings for a user
antiSpamSchema.statics.resetWarnings = async function (userId, guildId) {
  return this.findOneAndUpdate(
    { userId, guildId },
    {
      $set: { warnings: 0 },
    }
  );
};

// Get user's active warnings
antiSpamSchema.statics.getActiveWarnings = async function (userId, guildId) {
  const record = await this.findOne({ userId, guildId });
  return record ? record.warnings : 0;
};

export default mongoose.model("AntiSpam", antiSpamSchema);
