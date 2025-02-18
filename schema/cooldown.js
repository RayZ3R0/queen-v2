import mongoose from "mongoose";

const cooldownSchema = new mongoose.Schema({
  userID: {
    type: String,
    required: true,
  },
  commandName: {
    type: String,
    required: true,
  },
  cooldown: {
    type: String,
    default: "0",
  },
});

export default mongoose.model("cooldown", cooldownSchema);
