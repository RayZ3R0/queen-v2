import { EmbedBuilder } from "discord.js";

// Achievement categories and rewards
export const ACHIEVEMENTS = {
  bonding: {
    firstBond: {
      id: "BOND_001",
      title: "First Connection",
      description: "Select your first spirit",
      reward: {
        coins: 100,
        affinity: 10,
      },
    },
    perfectDate: {
      id: "BOND_002",
      title: "Perfect Date",
      description: "Complete a date at a spirit's favorite location",
      reward: {
        coins: 200,
        affinity: 20,
      },
    },
    giftMaster: {
      id: "BOND_003",
      title: "Gift Master",
      description: "Give 10 perfect gifts to spirits",
      reward: {
        coins: 500,
        affinity: 50,
      },
    },
    bondingStreak: {
      id: "BOND_004",
      title: "Dedicated Partner",
      description: "Maintain a 7-day bonding streak",
      reward: {
        coins: 1000,
        affinity: 100,
      },
    },
  },
  affection: {
    cautious: {
      id: "AFF_001",
      title: "Breaking the Ice",
      description: "Reach Cautious affection level with any spirit",
      reward: {
        coins: 150,
        affinity: 15,
      },
    },
    friendly: {
      id: "AFF_002",
      title: "Budding Friendship",
      description: "Reach Friendly affection level with any spirit",
      reward: {
        coins: 300,
        affinity: 30,
      },
    },
    trusting: {
      id: "AFF_003",
      title: "Trusted Companion",
      description: "Reach Trusting affection level with any spirit",
      reward: {
        coins: 600,
        affinity: 60,
      },
    },
    affectionate: {
      id: "AFF_004",
      title: "Unbreakable Bond",
      description: "Reach Affectionate affection level with any spirit",
      reward: {
        coins: 1200,
        affinity: 120,
      },
    },
  },
  spacequake: {
    firstExploration: {
      id: "SPACE_001",
      title: "Brave Explorer",
      description: "Complete your first spacequake exploration",
      reward: {
        coins: 100,
        energy: 10,
      },
    },
    spiritRescue: {
      id: "SPACE_002",
      title: "Spirit Savior",
      description: "Rescue 5 spirits from spacequakes",
      reward: {
        coins: 500,
        energy: 30,
      },
    },
    astDefeat: {
      id: "SPACE_003",
      title: "AST Adversary",
      description: "Defeat 10 AST units in spacequakes",
      reward: {
        coins: 750,
        energy: 50,
      },
    },
  },
  quests: {
    questStreak: {
      id: "QUEST_001",
      title: "Consistent Quester",
      description: "Complete all daily quests for 5 days straight",
      reward: {
        coins: 800,
        seasonXP: 100,
      },
    },
    perfectWeek: {
      id: "QUEST_002",
      title: "Perfect Week",
      description: "Complete every daily quest for a full week",
      reward: {
        coins: 2000,
        seasonXP: 250,
      },
    },
  },
  collection: {
    firstSpirit: {
      id: "COLL_001",
      title: "Spirit Awakening",
      description: "Add your first spirit to your collection",
      reward: {
        coins: 100,
      },
    },
    spiritVariety: {
      id: "COLL_002",
      title: "Spirit Collector",
      description: "Have 3 different spirits in your collection",
      reward: {
        coins: 300,
      },
    },
    spiritMaster: {
      id: "COLL_003",
      title: "Spirit Master",
      description: "Collect all available spirits",
      reward: {
        coins: 5000,
        title: "Spirit Master",
      },
    },
  },
};

// Check if achievement conditions are met
export const checkAchievement = (type, data, profile) => {
  const achievements = [];

  switch (type) {
    case "bonding": {
      // Check bonding-related achievements
      if (data.firstInteraction && !profile.achievements?.firstBond) {
        achievements.push(ACHIEVEMENTS.bonding.firstBond);
      }
      if (data.perfectDate && !profile.achievements?.perfectDate) {
        achievements.push(ACHIEVEMENTS.bonding.perfectDate);
      }
      if (
        profile.achievements?.totalPerfectGifts >= 10 &&
        !profile.achievements?.giftMaster
      ) {
        achievements.push(ACHIEVEMENTS.bonding.giftMaster);
      }
      if (profile.dateStreak >= 7 && !profile.achievements?.bondingStreak) {
        achievements.push(ACHIEVEMENTS.bonding.bondingStreak);
      }
      break;
    }

    case "affection": {
      // Check affection-related achievements
      const level = data.level;
      if (level >= 100 && !profile.achievements?.cautious) {
        achievements.push(ACHIEVEMENTS.affection.cautious);
      }
      if (level >= 250 && !profile.achievements?.friendly) {
        achievements.push(ACHIEVEMENTS.affection.friendly);
      }
      if (level >= 500 && !profile.achievements?.trusting) {
        achievements.push(ACHIEVEMENTS.affection.trusting);
      }
      if (level >= 1000 && !profile.achievements?.affectionate) {
        achievements.push(ACHIEVEMENTS.affection.affectionate);
      }
      break;
    }

    case "spacequake": {
      // Check spacequake-related achievements
      if (data.firstExplore && !profile.achievements?.firstExploration) {
        achievements.push(ACHIEVEMENTS.spacequake.firstExploration);
      }
      if (
        profile.achievements?.spiritsRescued >= 5 &&
        !profile.achievements?.spiritRescue
      ) {
        achievements.push(ACHIEVEMENTS.spacequake.spiritRescue);
      }
      if (
        profile.achievements?.astDefeated >= 10 &&
        !profile.achievements?.astDefeat
      ) {
        achievements.push(ACHIEVEMENTS.spacequake.astDefeat);
      }
      break;
    }

    case "quests": {
      // Check quest-related achievements
      if (
        profile.achievements?.questStreak >= 5 &&
        !profile.achievements?.questStreak
      ) {
        achievements.push(ACHIEVEMENTS.quests.questStreak);
      }
      if (
        profile.achievements?.perfectWeeks > 0 &&
        !profile.achievements?.perfectWeek
      ) {
        achievements.push(ACHIEVEMENTS.quests.perfectWeek);
      }
      break;
    }

    case "collection": {
      // Check collection-related achievements
      const spiritCount = profile.spirits?.length || 0;
      if (spiritCount >= 1 && !profile.achievements?.firstSpirit) {
        achievements.push(ACHIEVEMENTS.collection.firstSpirit);
      }
      if (spiritCount >= 3 && !profile.achievements?.spiritVariety) {
        achievements.push(ACHIEVEMENTS.collection.spiritVariety);
      }
      if (spiritCount >= 5 && !profile.achievements?.spiritMaster) {
        achievements.push(ACHIEVEMENTS.collection.spiritMaster);
      }
      break;
    }
  }

  return achievements;
};

// Create achievement unlock embed
export const createAchievementEmbed = (achievement, extraRewards = {}) => {
  const embed = new EmbedBuilder()
    .setTitle("🏆 Achievement Unlocked!")
    .setDescription(`**${achievement.title}**\n${achievement.description}`)
    .setColor("#ffd700");

  // Combine base rewards with any extra rewards
  const rewards = {
    ...achievement.reward,
    ...extraRewards,
  };

  // Format rewards string
  const rewardsList = Object.entries(rewards)
    .map(([type, amount]) => {
      switch (type) {
        case "coins":
          return `• ${amount} Spirit Coins`;
        case "affinity":
          return `• ${amount} Affinity`;
        case "energy":
          return `• ${amount} Energy`;
        case "seasonXP":
          return `• ${amount} Season XP`;
        case "title":
          return `• Title: ${amount}`;
        default:
          return `• ${amount} ${type}`;
      }
    })
    .join("\n");

  embed.addFields({
    name: "Rewards",
    value: rewardsList,
  });

  return embed;
};

// Export helper function for applying achievements
export const handleAchievements = async (userId, type, data, profile) => {
  // Check for unlocked achievements
  const unlockedAchievements = checkAchievement(type, data, profile);

  if (unlockedAchievements.length === 0) return null;

  // Apply rewards for each achievement
  const updates = {
    $inc: {},
    $set: {},
  };

  const unlockMessages = [];

  for (const achievement of unlockedAchievements) {
    // Add reward increments
    if (achievement.reward.coins) {
      updates.$inc.balance =
        (updates.$inc.balance || 0) + achievement.reward.coins;
    }
    if (achievement.reward.affinity) {
      updates.$inc.affinity =
        (updates.$inc.affinity || 0) + achievement.reward.affinity;
    }
    if (achievement.reward.energy) {
      updates.$inc.energy =
        (updates.$inc.energy || 0) + achievement.reward.energy;
    }
    if (achievement.reward.seasonXP) {
      updates.$inc.seasonXP =
        (updates.$inc.seasonXP || 0) + achievement.reward.seasonXP;
    }

    // Mark achievement as completed
    updates.$set[`achievements.${achievement.id}`] = true;

    // Create unlock message
    unlockMessages.push(createAchievementEmbed(achievement));
  }

  return {
    updates,
    unlockMessages,
  };
};
