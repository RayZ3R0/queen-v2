// Date A Live Canon Locations and their attributes
export const LOCATIONS = {
  "Tenguu City": {
    type: "Urban",
    hazards: [
      {
        name: "Random Spacequakes",
        risk: 0.3,
        damage: 40,
        reward: 200,
      },
      {
        name: "AST Patrol",
        risk: 0.4,
        damage: 30,
        reward: 150,
      },
    ],
    bonuses: [
      {
        name: "Spirit Mana Boost",
        effect: "power_boost",
        value: 1.2,
      },
      {
        name: "Civilian Support",
        effect: "reward_boost",
        value: 1.1,
      },
    ],
    difficultyMultiplier: 1.0,
  },
  "Raizen High School": {
    type: "School",
    hazards: [
      {
        name: "DEM Surveillance",
        risk: 0.2,
        damage: 20,
        reward: 100,
      },
      {
        name: "Student Witnesses",
        risk: 0.5,
        damage: 0,
        reward: 50,
      },
    ],
    bonuses: [
      {
        name: "School Protection",
        effect: "defense_boost",
        value: 1.15,
      },
      {
        name: "Friend Support",
        effect: "healing_boost",
        value: 1.2,
      },
    ],
    difficultyMultiplier: 0.8,
  },
  "DEM Industries HQ": {
    type: "Military",
    hazards: [
      {
        name: "Bandersnatch Units",
        risk: 0.6,
        damage: 50,
        reward: 300,
      },
      {
        name: "Wizard Encounter",
        risk: 0.4,
        damage: 60,
        reward: 400,
      },
    ],
    bonuses: [
      {
        name: "Technology Override",
        effect: "critical_boost",
        value: 1.3,
      },
      {
        name: "Realizer Disruption",
        effect: "enemy_weaken",
        value: 0.9,
      },
    ],
    difficultyMultiplier: 1.5,
  },
  Fraxinus: {
    type: "Ratatoskr",
    hazards: [
      {
        name: "System Malfunction",
        risk: 0.2,
        damage: 25,
        reward: 150,
      },
      {
        name: "Emergency Alert",
        risk: 0.3,
        damage: 35,
        reward: 200,
      },
    ],
    bonuses: [
      {
        name: "Ratatoskr Support",
        effect: "all_boost",
        value: 1.1,
      },
      {
        name: "Recovery System",
        effect: "regeneration",
        value: 10,
      },
    ],
    difficultyMultiplier: 0.9,
  },
};

export const SPECIAL_EVENTS = {
  "Spirit Sighting": {
    probability: 0.2,
    rewards: {
      coins: [200, 500],
      fragments: [1, 3],
      special: "spirit_affinity",
    },
  },
  "DEM Ambush": {
    probability: 0.15,
    rewards: {
      coins: [400, 800],
      fragments: [2, 4],
      special: "combat_experience",
    },
  },
  "Ratatoskr Mission": {
    probability: 0.1,
    rewards: {
      coins: [500, 1000],
      fragments: [3, 5],
      special: "equipment_upgrade",
    },
  },
};

// Helper functions
export const getLocationHazards = (locationName) => {
  const location = LOCATIONS[locationName];
  if (!location) return [];
  return location.hazards;
};

export const calculateReward = (locationName, performance) => {
  const location = LOCATIONS[locationName];
  if (!location) return 0;

  const baseReward = 100;
  const difficultyBonus = location.difficultyMultiplier;
  const performanceMultiplier = Math.min(2, Math.max(0.5, performance));

  return Math.floor(baseReward * difficultyBonus * performanceMultiplier);
};

export const getRandomEvent = (locationName) => {
  const location = LOCATIONS[locationName];
  if (!location) return null;

  const events = Object.entries(SPECIAL_EVENTS);
  const totalProb = events.reduce(
    (sum, [_, event]) => sum + event.probability,
    0
  );
  let random = Math.random() * totalProb;

  for (const [eventName, event] of events) {
    random -= event.probability;
    if (random <= 0) {
      return {
        name: eventName,
        ...event,
      };
    }
  }
  return null;
};

export const applyLocationBonuses = (locationName, stats) => {
  const location = LOCATIONS[locationName];
  if (!location || !location.bonuses) return stats;

  let modifiedStats = { ...stats };
  for (const bonus of location.bonuses) {
    switch (bonus.effect) {
      case "power_boost":
        modifiedStats.power *= bonus.value;
        break;
      case "defense_boost":
        modifiedStats.defense *= bonus.value;
        break;
      case "all_boost":
        Object.keys(modifiedStats).forEach(
          (key) => (modifiedStats[key] *= bonus.value)
        );
        break;
      case "regeneration":
        modifiedStats.regeneration =
          (modifiedStats.regeneration || 0) + bonus.value;
        break;
    }
  }

  return modifiedStats;
};

export default LOCATIONS;
