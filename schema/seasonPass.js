import mongoose from "mongoose";

const seasonPassSchema = new mongoose.Schema({
  seasonId: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  tiers: [
    {
      level: { type: Number, required: true },
      freeRewards: {
        coins: { type: Number, default: 0 },
        fragments: { type: Number, default: 0 },
        items: [
          {
            type: { type: String },
            name: { type: String },
            description: { type: String },
          },
        ],
      },
      premiumRewards: {
        coins: { type: Number, default: 0 },
        fragments: { type: Number, default: 0 },
        items: [
          {
            type: { type: String },
            name: { type: String },
            description: { type: String },
          },
        ],
      },
    },
  ],
});

// Default rewards for each tier
const DEFAULT_SEASON_TIERS = [
  // Tier 1 (Level 1)
  {
    level: 1,
    freeRewards: {
      coins: 100,
      fragments: 1,
      items: [
        {
          type: "title",
          name: "Spirit Novice",
          description: "A beginner's title for aspiring spirit handlers",
        },
      ],
    },
    premiumRewards: {
      coins: 300,
      fragments: 2,
      items: [
        {
          type: "equipment",
          name: "Basic Realizer",
          description: "Standard AST equipment",
        },
      ],
    },
  },
  // Tier 10 Milestone
  {
    level: 10,
    freeRewards: {
      coins: 500,
      fragments: 3,
      items: [
        {
          type: "title",
          name: "Spirit Guardian",
          description: "A title for proven spirit protectors",
        },
      ],
    },
    premiumRewards: {
      coins: 1000,
      fragments: 5,
      items: [
        {
          type: "equipment",
          name: "CR-Unit Fragment",
          description: "Part of a Combat Realizer Unit",
        },
      ],
    },
  },
  // Tier 25 Milestone
  {
    level: 25,
    freeRewards: {
      coins: 1000,
      fragments: 5,
      items: [
        {
          type: "title",
          name: "Spirit Whisperer",
          description: "A title for those who understand spirits",
        },
      ],
    },
    premiumRewards: {
      coins: 2000,
      fragments: 8,
      items: [
        {
          type: "equipment",
          name: "Advanced Realizer",
          description: "Enhanced spirit combat equipment",
        },
      ],
    },
  },
  // Tier 50 Milestone
  {
    level: 50,
    freeRewards: {
      coins: 2000,
      fragments: 8,
      items: [
        {
          type: "title",
          name: "Spirit Master",
          description: "A title for master spirit handlers",
        },
      ],
    },
    premiumRewards: {
      coins: 4000,
      fragments: 12,
      items: [
        {
          type: "equipment",
          name: "Complete CR-Unit",
          description: "Full Combat Realizer Unit",
        },
      ],
    },
  },
  // Tier 75 Milestone
  {
    level: 75,
    freeRewards: {
      coins: 3000,
      fragments: 10,
      items: [
        {
          type: "title",
          name: "Spirit Champion",
          description: "A title for exceptional spirit allies",
        },
      ],
    },
    premiumRewards: {
      coins: 6000,
      fragments: 15,
      items: [
        {
          type: "equipment",
          name: "Experimental Realizer",
          description: "Prototype spirit technology",
        },
      ],
    },
  },
  // Tier 100 (Max Level)
  {
    level: 100,
    freeRewards: {
      coins: 5000,
      fragments: 15,
      items: [
        {
          type: "title",
          name: "Spirit Legend",
          description: "A legendary title for ultimate spirit companions",
        },
      ],
    },
    premiumRewards: {
      coins: 10000,
      fragments: 25,
      items: [
        {
          type: "equipment",
          name: "Spirit Crystal Realizer",
          description: "Legendary spirit-enhanced equipment",
        },
      ],
    },
  },
];

// Helper method to create a new season
seasonPassSchema.statics.createNewSeason = async function (
  seasonId,
  durationDays = 90
) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + durationDays);

  // Generate intermediate tiers
  const allTiers = [...DEFAULT_SEASON_TIERS];
  const milestones = DEFAULT_SEASON_TIERS.map((tier) => tier.level);

  // Fill in gaps between milestones with smaller rewards
  for (let level = 1; level <= 100; level++) {
    if (!milestones.includes(level)) {
      allTiers.push({
        level,
        freeRewards: {
          coins: Math.floor(100 + level * 1.5),
          fragments: Math.floor(level / 20) + 1,
        },
        premiumRewards: {
          coins: Math.floor(200 + level * 2),
          fragments: Math.floor(level / 10) + 1,
        },
      });
    }
  }

  // Sort tiers by level
  allTiers.sort((a, b) => a.level - b.level);

  const season = new this({
    seasonId,
    startDate,
    endDate,
    tiers: allTiers,
  });

  return await season.save();
};

// Method to get rewards for a specific tier
seasonPassSchema.methods.getTierRewards = function (level, isPremium = false) {
  const tier = this.tiers.find((t) => t.level === level);
  if (!tier) return null;

  return isPremium
    ? { ...tier.freeRewards, ...tier.premiumRewards }
    : tier.freeRewards;
};

// Method to check if season is active
seasonPassSchema.methods.isActive = function () {
  const now = new Date();
  return now >= this.startDate && now <= this.endDate;
};

export default mongoose.model("SeasonPass", seasonPassSchema);
