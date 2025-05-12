import mongoose from "mongoose";

const giveawaySchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true,
  },
  channelId: {
    type: String,
    required: true,
  },
  messageId: {
    type: String,
    required: true,
    unique: true,
  },
  creatorId: {
    type: String,
    required: true,
  },
  prize: {
    type: String,
    required: true,
    trim: true,
    maxlength: 256,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1024,
    default: "",
  },
  winnerCount: {
    type: Number,
    required: true,
    min: 1,
    max: 20,
  },
  participants: [
    {
      type: String,
      ref: "User",
    },
  ],
  winners: [
    {
      type: String,
    },
  ],
  startTime: {
    type: Date,
    default: Date.now,
  },
  endTime: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ["ACTIVE", "ENDED", "CANCELLED"],
    default: "ACTIVE",
  },
  requiredRoleId: {
    type: String,
    default: null,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for querying active giveaways efficiently
giveawaySchema.index({ guildId: 1, status: 1 });
giveawaySchema.index({ endTime: 1, status: 1 });

export default mongoose.model("Giveaway", giveawaySchema);
