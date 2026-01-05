import mongoose from "mongoose";

const partnershipSchema = new mongoose.Schema({
  inviteCode: {
    type: String,
    required: true,
    unique: true, // This creates an index automatically, so we don't need partnershipSchema.index({ inviteCode: 1 })
  },
  inviteUrl: {
    type: String,
    required: true,
  },
  guildId: {
    type: String,
    required: true,
  },
  guildName: {
    type: String,
    required: true,
  },
  guildIcon: String,
  memberCount: Number,
  description: String,
  addedBy: {
    type: String,
    required: true,
  },
  addedById: {
    type: String,
    required: true,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
  lastChecked: {
    type: Date,
    default: Date.now,
  },
  messageId: String, // ID of the partnership message in the channel
  channelId: String, // Channel where partnership was posted
  status: {
    type: String,
    enum: ["active", "expired", "invalid", "flagged"],
    default: "active",
  },
  expiresAt: Date,
  consecutiveFailures: {
    type: Number,
    default: 0,
  },
  notes: String,
});

// Indexes (inviteCode already indexed via unique: true)
partnershipSchema.index({ guildId: 1 });
partnershipSchema.index({ status: 1 });
partnershipSchema.index({ addedAt: -1 });

export default mongoose.model("Partnership", partnershipSchema);
