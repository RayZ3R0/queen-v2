import mongoose from "mongoose";

const balance = new mongoose.Schema({
  guild: String,
  user: String,
  balance: Number,
});

export default mongoose.model("balance", balance);
