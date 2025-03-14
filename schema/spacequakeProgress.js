import mongoose from "mongoose";

const spacequakeProgressSchema = new mongoose.Schema({
  userid: { type: String, required: true },
  seasonLevel: { type: Number, default: 1 },
  seasonXP: { type: Number, default: 0 },
  totalExplorations: { type: Number, default: 0 },
  dailyExplorations: { type: Number, default: 0 },
  lastDailyReset: { type: Date, default: Date.now },
  bossesDefeated: { type: Number, default: 0 },
  specialRewards: [
    {
      type: { type: String },
      name: { type: String },
      obtained: { type: Date },
      duration: { type: String },
      active: { type: Boolean, default: true },
    },
  ],
  territories: {
    "Tenguu City": {
      explored: { type: Number, default: 0 },
      bossesDefeated: { type: Number, default: 0 },
      highestReward: { type: Number, default: 0 },
    },
    "Raizen High School": {
      explored: { type: Number, default: 0 },
      bossesDefeated: { type: Number, default: 0 },
      highestReward: { type: Number, default: 0 },
    },
    "DEM Industries HQ": {
      explored: { type: Number, default: 0 },
      bossesDefeated: { type: Number, default: 0 },
      highestReward: { type: Number, default: 0 },
    },
    Fraxinus: {
      explored: { type: Number, default: 0 },
      bossesDefeated: { type: Number, default: 0 },
      highestReward: { type: Number, default: 0 },
    },
  },
  // Season Pass rewards tracking
  seasonRewards: {
    claimed: [{ type: Number }], // Array of claimed tier numbers
    premiumUnlocked: { type: Boolean, default: false },
  },
  // Team/Party system
  activeParty: [
    {
      userid: { type: String },
      spirit: { type: String },
      joinedAt: { type: Date },
    },
  ],
  partyInvites: [
    {
      partyId: { type: String },
      invitedBy: { type: String },
      expires: { type: Date },
    },
  ],
  // Achievement tracking
  achievements: {
    totalCoins: { type: Number, default: 0 },
    totalFragments: { type: Number, default: 0 },
    rareMaterials: { type: Number, default: 0 },
    bossEncounters: { type: Number, default: 0 },
    specialEvents: { type: Number, default: 0 },
    territoryMastery: {
      type: Map,
      of: {
        level: { type: Number, default: 0 },
        progress: { type: Number, default: 0 },
      },
    },
  },
});

// Middleware to auto-reset daily explorations
spacequakeProgressSchema.pre("save", function (next) {
  const now = new Date();
  const lastReset = this.lastDailyReset;

  // Check if it's a new day
  if (lastReset && now.getDate() !== lastReset.getDate()) {
    this.dailyExplorations = 0;
    this.lastDailyReset = now;
  }

  next();
});

// Methods for season pass progression
spacequakeProgressSchema.methods.addSeasonXP = async function (amount) {
  this.seasonXP += amount;

  // Calculate level ups
  const xpPerLevel = 1000;
  while (this.seasonXP >= xpPerLevel) {
    this.seasonXP -= xpPerLevel;
    this.seasonLevel++;
  }

  await this.save();
  return this.seasonLevel;
};

spacequakeProgressSchema.methods.claimSeasonReward = async function (tier) {
  if (this.seasonRewards.claimed.includes(tier)) {
    return false;
  }

  if (this.seasonLevel < tier) {
    return false;
  }

  this.seasonRewards.claimed.push(tier);
  await this.save();
  return true;
};

// Methods for special rewards management
spacequakeProgressSchema.methods.addSpecialReward = async function (reward) {
  this.specialRewards.push({
    type: reward.type,
    name: reward.name,
    obtained: new Date(),
    duration: reward.duration,
    active: true,
  });

  await this.save();
};

spacequakeProgressSchema.methods.getActiveBuffs = function () {
  const now = new Date();
  return this.specialRewards.filter((reward) => {
    if (!reward.active) return false;

    if (reward.duration === "Permanent") return true;
    if (reward.duration === "Consumable") return reward.active;

    const expiryTime = new Date(reward.obtained);
    if (reward.duration === "24 hours") {
      expiryTime.setHours(expiryTime.getHours() + 24);
    }

    return now < expiryTime;
  });
};

// Methods for party management
spacequakeProgressSchema.methods.canJoinParty = function () {
  return this.activeParty.length === 0;
};

spacequakeProgressSchema.methods.joinParty = async function (partyId, spirit) {
  if (!this.canJoinParty()) return false;

  this.activeParty.push({
    userid: this._id,
    spirit: spirit,
    joinedAt: new Date(),
  });

  await this.save();
  return true;
};

export default mongoose.model("SpacequakeProgress", spacequakeProgressSchema);
