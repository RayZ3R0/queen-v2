// Date A Live Canon Spirit Powers and Abilities
export const SPIRIT_POWERS = {
  "Tohka Yatogami": {
    angel: "Sandalphon",
    weapons: ["Throne of Annihilation", "Halvanhelev"],
    abilities: {
      Sandalphon: {
        description: "Primary Angel manifesting as a broadsword",
        power: 85,
        energyCost: 40,
      },
      Halvanhelev: {
        description: "Ultimate sword form of Sandalphon",
        power: 100,
        energyCost: 100,
      },
    },
    datePreferences: ["Food", "Simple Activities", "Peaceful Places"],
    personality: "Innocent and emotional",
  },
  "Kurumi Tokisaki": {
    angel: "Zafkiel",
    weapons: ["Flintlock Pistol", "Musket"],
    abilities: {
      Aleph: {
        description: "Accelerates time for target",
        power: 60,
        energyCost: 30,
      },
      Zayin: {
        description: "Temporarily freezes time",
        power: 90,
        energyCost: 80,
      },
      "Yud Bet": {
        description: "Travel through time",
        power: 100,
        energyCost: 100,
      },
    },
    datePreferences: [
      "Tea Time",
      "Intellectual Conversation",
      "Gothic Locations",
    ],
    personality: "Flirtatious but dangerous",
  },
  Yoshino: {
    angel: "Zadkiel",
    weapons: ["Ice Puppet Yoshinon"],
    abilities: {
      Zadkiel: {
        description: "Ice manipulation and defense",
        power: 70,
        energyCost: 35,
      },
      "El-Kanaf": {
        description: "Creates ice barriers",
        power: 65,
        energyCost: 40,
      },
    },
    datePreferences: ["Quiet Places", "Puppet Shows", "Cold Environments"],
    personality: "Shy and gentle",
  },
  "Kotori Itsuka": {
    angel: "Camael",
    weapons: ["Megiddo"],
    abilities: {
      Camael: {
        description: "Fire manipulation and healing",
        power: 80,
        energyCost: 45,
      },
      Megiddo: {
        description: "Powerful flame cannon",
        power: 95,
        energyCost: 90,
      },
    },
    datePreferences: ["Sweets", "Family Activities", "Modern Locations"],
    personality: "Commander mode/Imouto mode duality",
  },
  "Origami Tobiichi": {
    angel: "Metatron",
    weapons: ["Crown Cannon"],
    abilities: {
      Metatron: {
        description: "Light-based attacks",
        power: 85,
        energyCost: 50,
      },
      Shemesh: {
        description: "Concentrated light beams",
        power: 90,
        energyCost: 85,
      },
    },
    datePreferences: [
      "Structured Activities",
      "Technological Places",
      "Direct Communication",
    ],
    personality: "Serious and determined",
  },
};

// Helper functions for spirit powers
export const getRandomAbility = (spiritName) => {
  const spirit = SPIRIT_POWERS[spiritName];
  if (!spirit) return null;

  const abilities = Object.keys(spirit.abilities);
  return abilities[Math.floor(Math.random() * abilities.length)];
};

export const getSpiritPreference = (spiritName, category) => {
  const spirit = SPIRIT_POWERS[spiritName];
  if (!spirit || !spirit.datePreferences) return null;

  return spirit.datePreferences[
    Math.floor(Math.random() * spirit.datePreferences.length)
  ];
};

export const calculateAbilityDamage = (
  spiritName,
  abilityName,
  userAffection
) => {
  const spirit = SPIRIT_POWERS[spiritName];
  if (!spirit || !spirit.abilities[abilityName]) return 0;

  const ability = spirit.abilities[abilityName];
  const affectionBonus = Math.min(1.5, 1 + userAffection / 100);
  return Math.floor(ability.power * affectionBonus);
};

export const getAbilityCost = (spiritName, abilityName) => {
  const spirit = SPIRIT_POWERS[spiritName];
  if (!spirit || !spirit.abilities[abilityName]) return 0;

  return spirit.abilities[abilityName].energyCost;
};

export default SPIRIT_POWERS;
