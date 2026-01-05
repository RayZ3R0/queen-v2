import mongoose from "mongoose";

// User's invite statistics
const inviteStatsSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  invites: {
    regular: { type: Number, default: 0 }, // Normal invites
    bonus: { type: Number, default: 0 },   // Admin-given bonus
    leaves: { type: Number, default: 0 },  // People who left
    fake: { type: Number, default: 0 },    // Fake accounts
  },
  lastUpdated: { type: Date, default: Date.now },
});

// Individual invite usage tracking
const inviteUsageSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  inviterId: { type: String, required: true },  // Who created the invite
  invitedUserId: { type: String, required: true }, // Who joined
  inviteCode: { type: String, required: true },
  inviteType: { 
    type: String, 
    enum: ['normal', 'vanity', 'unknown', 'widget'],
    default: 'normal'
  },
  isFake: { type: Boolean, default: false },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date, default: null },
  accountCreatedAt: { type: Date },
  accountAgeDays: { type: Number },
});

// Invite cache for tracking uses
const inviteCacheSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  code: { type: String, required: true },
  inviterId: { type: String, required: true },
  uses: { type: Number, default: 0 },
  maxUses: { type: Number, default: 0 },
  isVanity: { type: Boolean, default: false },
  expiresAt: { type: Date, default: null },
  lastUpdated: { type: Date, default: Date.now },
});

// Indexes for performance
inviteStatsSchema.index({ guildId: 1, userId: 1 }, { unique: true });
inviteUsageSchema.index({ guildId: 1, invitedUserId: 1 }, { unique: true });
inviteUsageSchema.index({ guildId: 1, inviterId: 1 });
inviteCacheSchema.index({ guildId: 1, code: 1 }, { unique: true });

// Virtual for total valid invites
inviteStatsSchema.virtual('total').get(function() {
  return this.invites.regular + this.invites.bonus - this.invites.leaves - this.invites.fake;
});

export const InviteStats = mongoose.model("InviteStats", inviteStatsSchema);
export const InviteUsage = mongoose.model("InviteUsage", inviteUsageSchema);
export const InviteCache = mongoose.model("InviteCache", inviteCacheSchema);
