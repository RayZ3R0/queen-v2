import mongoose from "mongoose";

const spiritsSchema = new mongoose.Schema({
  name: String,
  husband: String,
  stars: Number,
  happiness: Number,
  id: String,
  skin: String,
  attackboost: Number,
  defenceboost: Number,
  agilityboost: Number,
  spiritPowerBoost: Number,
  items: Array,
  nickname: String,
});

export default mongoose.model("spirits", spiritsSchema);
