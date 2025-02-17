import mongoose from "mongoose";

const warndbSchema = new mongoose.Schema({
  guild: String,
  user: String,
  content: Array,
});

export default mongoose.model("warndb", warndbSchema);
