import mongoose from "mongoose";

const blacklistSchema = new mongoose.Schema(
  {
    guildId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "url"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      // For text/url: the actual text/url pattern
      // For image: the perceptual hash
    },
    imageUrl: {
      type: String,
      required: false,
      // Optional: store the original image URL for reference
    },
    addedBy: {
      type: String,
      required: true,
      // User ID of the admin who added this
    },
    reason: {
      type: String,
      default: "Raid/spam content",
    },
    triggerCount: {
      type: Number,
      default: 0,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    lastTriggered: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
blacklistSchema.index({ guildId: 1, type: 1 });
blacklistSchema.index({ guildId: 1, content: 1 });

export default mongoose.model("Blacklist", blacklistSchema);
