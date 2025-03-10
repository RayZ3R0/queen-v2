import mongoose from "mongoose";

const bumpSchema = new mongoose.Schema({
  guildId: String,
  channelId: String,
  lastBumped: Date,
  nextBumpTime: Date,
  reminderId: String,
  isReminded: Boolean,
});

export default mongoose.model("bump", bumpSchema);
