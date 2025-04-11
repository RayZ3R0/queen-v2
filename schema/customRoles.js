import mongoose from "mongoose";

const customRolesSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  guildId: {
    type: String,
    required: true,
  },
  roleId: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to ensure one role per user per guild
customRolesSchema.index({ userId: 1, guildId: 1 }, { unique: true });

export default mongoose.model("CustomRoles", customRolesSchema);
