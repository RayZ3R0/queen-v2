import mongoose from "mongoose";

const levelSchema = new mongoose.Schema({
  user: { type: String, unique: true },
  guild: { type: String },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 0 },
});

export default mongoose.model("Simply-XP", levelSchema);
