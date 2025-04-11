import { EmbedBuilder } from "discord.js";
import { LOCATIONS } from "./locationManager.js";
import { SPIRIT_POWERS } from "./spiritPowers.js";

// Constants for spacequake exploration
export const SPACEQUAKE_CONSTANTS = {
  MAX_ROUNDS: 5,
  MIN_PARTY_SIZE: 1,
  MAX_PARTY_SIZE: 4,
  BASE_REWARDS: {
    coins: 100,
    fragments: 1,
  },
  BOSS_REWARDS: {
    coins: 500,
    fragments: 3,
  },
};

// Special encounters in spacequake zones
export const ENCOUNTERS = {
  "AST Squad": {
    type: "combat",
    difficulty: 0.7,
    rewards: {
      coins: [200, 400],
      fragments: [1, 2],
      special: "combat_experience",
    },
    description: "An AST squad has detected spirit mana!",
  },
  "DEM Wizards": {
    type: "combat",
    difficulty: 0.9,
    rewards: {
      coins: [400, 800],
      fragments: [2, 4],
      special: "realizer_fragment",
    },
    description: "DEM wizards are attempting to capture spirits!",
  },
  "Spirit Sighting": {
    type: "event",
    difficulty: 0.5,
    rewards: {
      coins: [300, 600],
      fragments: [2, 3],
      special: "spirit_affinity",
    },
    description: "A spirit has been detected in the area!",
  },
  "Ratatoskr Cache": {
    type: "treasure",
    difficulty: 0.3,
    rewards: {
      coins: [150, 300],
      fragments: [1, 2],
      special: "equipment",
    },
    description: "A Ratatoskr supply cache has been located!",
  },
};

// Boss encounters
export const BOSS_ENCOUNTERS = {
  "Ellen Mira Mathers": {
    title: "The World's Strongest Wizard",
    power: 95,
    rewards: {
      coins: [800, 1200],
      fragments: [4, 6],
      special: "dem_technology",
    },
    description: "The strongest DEM wizard stands before you!",
  },
  "Sir Isaac Ray Pelham Westcott": {
    title: "DEM Director",
    power: 100,
    rewards: {
      coins: [1000, 1500],
      fragments: [5, 7],
      special: "boss_fragment",
    },
    description: "The sinister director of DEM has appeared!",
  },
  "Bandersnatch Squad": {
    title: "Automated Spirit Hunters",
    power: 85,
    rewards: {
      coins: [600, 1000],
      fragments: [3, 5],
      special: "mechanical_parts",
    },
    description: "A squad of Bandersnatch units surrounds you!",
  },
};

// Special rewards that can be found
export const SPECIAL_REWARDS = {
  combat_experience: {
    name: "Combat Experience",
    effect: "Increases damage in future encounters",
    duration: "Permanent",
  },
  realizer_fragment: {
    name: "Realizer Fragment",
    effect: "Can be used to enhance spirit abilities",
    duration: "Consumable",
  },
  spirit_affinity: {
    name: "Spirit Affinity",
    effect: "Improves relationship with spirits",
    duration: "24 hours",
  },
  equipment: {
    name: "Ratatoskr Equipment",
    effect: "Provides defensive bonuses",
    duration: "Until defeated",
  },
  dem_technology: {
    name: "DEM Technology",
    effect: "Rare crafting material",
    duration: "Consumable",
  },
  boss_fragment: {
    name: "Demon King Fragment",
    effect: "Ultra rare enhancement material",
    duration: "Consumable",
  },
  mechanical_parts: {
    name: "Mechanical Parts",
    effect: "Used for crafting equipment",
    duration: "Consumable",
  },
};

// Helper functions
export const generateEncounter = (round, location) => {
  const locationData = LOCATIONS[location];
  if (!locationData) return null;

  // Higher chance of special encounters in higher difficulty locations
  const encounterChance = locationData.difficultyMultiplier * 0.3;

  if (Math.random() < encounterChance) {
    const encounters = Object.entries(ENCOUNTERS);
    const totalWeight = encounters.reduce(
      (sum, [_, data]) => sum + data.difficulty,
      0
    );
    let random = Math.random() * totalWeight;

    for (const [name, data] of encounters) {
      random -= data.difficulty;
      if (random <= 0) {
        return {
          name,
          ...data,
          rewards: {
            ...data.rewards,
            coins: [
              Math.floor(
                data.rewards.coins[0] * locationData.difficultyMultiplier
              ),
              Math.floor(
                data.rewards.coins[1] * locationData.difficultyMultiplier
              ),
            ],
          },
        };
      }
    }
  }

  return null;
};

export const generateBoss = (location) => {
  const bosses = Object.entries(BOSS_ENCOUNTERS);
  return {
    ...bosses[Math.floor(Math.random() * bosses.length)][1],
    name: bosses[Math.floor(Math.random() * bosses.length)][0],
  };
};

export const calculateRewards = (encounter, performance) => {
  if (!encounter) return null;

  const performanceMultiplier = Math.min(2, Math.max(0.5, performance));
  const rewards = {
    coins: Math.floor(
      (encounter.rewards.coins[0] +
        Math.random() *
          (encounter.rewards.coins[1] - encounter.rewards.coins[0])) *
        performanceMultiplier
    ),
    fragments: Math.floor(
      (encounter.rewards.fragments[0] +
        Math.random() *
          (encounter.rewards.fragments[1] - encounter.rewards.fragments[0])) *
        performanceMultiplier
    ),
  };

  if (
    encounter.rewards.special &&
    Math.random() < 0.3 * performanceMultiplier
  ) {
    rewards.special = {
      type: encounter.rewards.special,
      ...SPECIAL_REWARDS[encounter.rewards.special],
    };
  }

  return rewards;
};

export const createEncounterEmbed = (encounter, rewards = null) => {
  const embed = new EmbedBuilder()
    .setTitle(encounter.name)
    .setDescription(encounter.description)
    .setColor(encounter.type === "combat" ? "#ff0000" : "#00ff00");

  if (rewards) {
    let rewardsText = `Coins: ${rewards.coins}\nFragments: ${rewards.fragments}`;
    if (rewards.special) {
      rewardsText += `\n\nSpecial Reward: ${rewards.special.name}\n${rewards.special.effect}`;
    }
    embed.addFields({ name: "Rewards", value: rewardsText });
  }

  return embed;
};

export const createBossEmbed = (boss) => {
  return new EmbedBuilder()
    .setTitle(`Boss Encounter: ${boss.name}`)
    .setDescription(
      `**${boss.title}**\n\n${boss.description}\n\nPower Level: ${boss.power}`
    )
    .setColor("#ff0000");
};
