import mongoose from "mongoose";

const inviteSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  inviterId: { type: String, required: true },
  code: { type: String, required: true },
  uses: { type: Number, default: 0 },
  maxUses: { type: Number, default: 0 },
  isVanity: { type: Boolean, default: false },
  isTemporary: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const inviteUsageSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  inviterId: { type: String, required: true },
  invitedId: { type: String, required: true },
  code: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date, default: null },
});

const inviterStatsSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  invites: {
    total: { type: Number, default: 0 },
    left: { type: Number, default: 0 },
    fake: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
  },
  lastInvite: { type: Date },
});

// Compound indexes for efficient querying
inviteSchema.index({ guildId: 1, code: 1 }, { unique: true });
inviteUsageSchema.index({ guildId: 1, invitedId: 1 });
inviterStatsSchema.index({ guildId: 1, userId: 1 }, { unique: true });

// Calculate real invites (total - left - fake + bonus)
inviterStatsSchema.virtual("realInvites").get(function () {
  return (
    this.invites.total -
    this.invites.left -
    this.invites.fake +
    this.invites.bonus
  );
});

export const InviteModel = mongoose.model("Invite", inviteSchema);
export const InviteUsageModel = mongoose.model(
  "InviteUsage",
  inviteUsageSchema
);
export const InviterStatsModel = mongoose.model(
  "InviterStats",
  inviterStatsSchema
);
