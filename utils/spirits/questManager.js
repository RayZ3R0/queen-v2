import { EmbedBuilder } from "discord.js";
import { SPIRIT_POWERS } from "./spiritPowers.js";
import { LOCATIONS } from "./locationManager.js";

// Daily Quest Types
export const QUEST_TYPES = {
  DATE: "date",
  GIFT: "gift",
  CHAT: "chat",
  EXPLORE: "explore",
  RACE: "race",
  BOND: "bond",
};

// Quest Difficulties and Rewards
export const QUEST_TIERS = {
  EASY: {
    multiplier: 1,
    color: "#00ff00",
    rewards: {
      coins: 100,
      affinity: 5,
      seasonXP: 50,
    },
  },
  MEDIUM: {
    multiplier: 1.5,
    color: "#ffff00",
    rewards: {
      coins: 200,
      affinity: 10,
      seasonXP: 100,
    },
  },
  HARD: {
    multiplier: 2,
    color: "#ff0000",
    rewards: {
      coins: 400,
      affinity: 20,
      seasonXP: 200,
    },
  },
};

// Quest Templates
const QUEST_TEMPLATES = [
  {
    type: QUEST_TYPES.DATE,
    description: "Go on {count} date(s) with {spirit}",
    requirements: { count: [1, 2, 3] },
    tier: ["EASY", "MEDIUM", "HARD"],
  },
  {
    type: QUEST_TYPES.GIFT,
    description: "Give {count} perfect gift(s) to {spirit}",
    requirements: { count: [1, 2, 3] },
    tier: ["EASY", "MEDIUM", "HARD"],
  },
  {
    type: QUEST_TYPES.CHAT,
    description: "Have {count} conversation(s) with {spirit}",
    requirements: { count: [2, 4, 6] },
    tier: ["EASY", "MEDIUM", "HARD"],
  },
  {
    type: QUEST_TYPES.EXPLORE,
    description: "Complete {count} spacequake exploration(s) in {location}",
    requirements: { count: [2, 3, 5] },
    tier: ["EASY", "MEDIUM", "HARD"],
  },
  {
    type: QUEST_TYPES.RACE,
    description: "Win {count} spirit race(s) in {location}",
    requirements: { count: [1, 2, 3] },
    tier: ["EASY", "MEDIUM", "HARD"],
  },
  {
    type: QUEST_TYPES.BOND,
    description: "Reach {affinity} total affinity with {spirit}",
    requirements: { affinity: [100, 250, 500] },
    tier: ["EASY", "MEDIUM", "HARD"],
  },
];

// Generate daily quests for a user
export const generateDailyQuests = (spirit, count = 3) => {
  const quests = [];
  const usedTypes = new Set();

  while (quests.length < count) {
    // Get random template
    const template =
      QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)];

    // Avoid duplicate quest types
    if (usedTypes.has(template.type)) continue;
    usedTypes.add(template.type);

    // Randomly select difficulty tier
    const tierIndex = Math.floor(Math.random() * template.tier.length);
    const tier = template.tier[tierIndex];

    // Build quest object
    const quest = {
      id: `${Date.now()}_${quests.length}`,
      type: template.type,
      tier: tier,
      description: template.description,
      requirements: {},
      progress: 0,
      completed: false,
    };

    // Fill in requirements based on tier
    for (const [key, values] of Object.entries(template.requirements)) {
      quest.requirements[key] = values[tierIndex];
    }

    // Replace placeholders in description
    quest.description = quest.description
      .replace("{spirit}", spirit)
      .replace(
        "{count}",
        quest.requirements.count || quest.requirements.affinity
      )
      .replace(
        "{location}",
        quest.type.includes("race") || quest.type.includes("explore")
          ? Object.keys(LOCATIONS)[
              Math.floor(Math.random() * Object.keys(LOCATIONS).length)
            ]
          : ""
      );

    quests.push(quest);
  }

  return quests;
};

// Create quest display embed
export const createQuestEmbed = (quests, spirit) => {
  const embed = new EmbedBuilder()
    .setTitle(`Daily Quests for ${spirit}`)
    .setDescription(
      "Complete quests to earn rewards and increase your affinity!"
    )
    .setColor("#00ff00")
    .setTimestamp();

  quests.forEach((quest) => {
    const tier = QUEST_TIERS[quest.tier];
    const rewards = Object.entries(tier.rewards)
      .map(([type, amount]) => `${amount} ${type}`)
      .join(", ");

    const progress =
      quest.type === QUEST_TYPES.BOND
        ? `${quest.progress}/${quest.requirements.affinity} affinity`
        : `${quest.progress}/${quest.requirements.count} completed`;

    embed.addFields({
      name: `${quest.completed ? "✅" : "❌"} ${quest.description}`,
      value: `Difficulty: ${quest.tier}\nProgress: ${progress}\nRewards: ${rewards}`,
    });
  });

  return embed;
};

// Calculate rewards for completed quest
export const calculateQuestRewards = (quest) => {
  const tier = QUEST_TIERS[quest.tier];
  return {
    coins: Math.floor(tier.rewards.coins * tier.multiplier),
    affinity: Math.floor(tier.rewards.affinity * tier.multiplier),
    seasonXP: Math.floor(tier.rewards.seasonXP * tier.multiplier),
  };
};

// Check if quest can be updated based on action type
export const canUpdateQuest = (quest, actionType, actionData = {}) => {
  if (quest.completed) return false;

  switch (quest.type) {
    case QUEST_TYPES.BOND:
      return (
        actionType === "affinity_update" &&
        actionData.spirit === actionData.questSpirit
      );

    case QUEST_TYPES.DATE:
    case QUEST_TYPES.GIFT:
    case QUEST_TYPES.CHAT:
      return (
        actionType === quest.type &&
        actionData.spirit === actionData.questSpirit
      );

    case QUEST_TYPES.EXPLORE:
      return (
        actionType === quest.type &&
        actionData.location === actionData.questLocation
      );

    case QUEST_TYPES.RACE:
      return (
        actionType === quest.type &&
        actionData.location === actionData.questLocation &&
        actionData.won
      );

    default:
      return false;
  }
};
