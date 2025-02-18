import mongoose from "mongoose";

const profileSchema = new mongoose.Schema({
  userid: String,
  selected: String,
  image: String,
  color: String,
  bio: String,
  level: Number,
  xp: Number,
  energy: Number,
  balance: Number,
  items: Array,
  started: Boolean,
});

export default mongoose.model("profile", profileSchema);
