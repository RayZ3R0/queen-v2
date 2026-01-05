import mongoose from "mongoose";

const honeypotViolationSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  messageId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageContent: { type: String },
  triggeredAt: { type: Date, default: Date.now },
  messagesDeleted: { type: Number, default: 0 },
  channelsScanned: { type: Number, default: 0 },
  dmSent: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  verifiedAt: { type: Date },
  correctButton: { type: String }, // Store which button is correct for this violation
});

// Index for quick lookups
honeypotViolationSchema.index({ guildId: 1, userId: 1 });
honeypotViolationSchema.index({ userId: 1, verified: 1 });

export default mongoose.model("HoneypotViolation", honeypotViolationSchema);
