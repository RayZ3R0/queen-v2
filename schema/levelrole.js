import mongoose from "mongoose";

const levelRoleSchema = new mongoose.Schema({
  gid: { type: String },
  lvlrole: { type: Array },
});

export default mongoose.model("Simply-XP-LevelRole", levelRoleSchema);
