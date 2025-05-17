import mongoose from "mongoose";

const trollmuteSchema = new mongoose.Schema({
  guild: String,
  user: String,
  active: Boolean,
  totalDuration: Number, // 0 means indefinite
  speakDuration: Number, // in milliseconds
  muteDuration: Number, // in milliseconds
  startTime: Number, // timestamp when trollmute was applied
  expiresAt: Number, // timestamp when trollmute will end (0 for indefinite)
  lastCycleTime: Number, // timestamp of last cycle change
  currentlyMuted: Boolean, // tracks current state
  channelId: String, // channel where the trollmute was activated
});

export default mongoose.model("trollmutedb", trollmuteSchema);
