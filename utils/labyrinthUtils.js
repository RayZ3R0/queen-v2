/**
 * Configuration and constants for the Lucky Labyrinth game
 */

export const MAX_ROUNDS = 5;

// Path multipliers and risk percentages
export const PATH_DATA = {
  safe: { multiplier: 1.1, risk: 0.15 },
  risky: { multiplier: 1.3, risk: 0.4 },
  mysterious: { multiplier: 2.5, risk: 0.6 },
};

// Atmospheric path names
export const PATH_NAMES = {
  safe: [
    "Golden Passage",
    "Radiant Corridor",
    "Luminous Walk",
    "Aurora Lane",
    "Daybreak Boulevard",
    "Sunrise Trail",
    "Solstice Road",
    "Bright Promenade",
    "Dawn Passage",
    "Glittering Aisle",
  ],
  risky: [
    "Twilight Path",
    "Dusky Arc",
    "Nocturne Alley",
    "Shadowed Way",
    "Gloom Route",
    "Nightfall Shortcut",
    "Darkened Passage",
    "Ebon Track",
    "Obsidian Trail",
    "Veiled Road",
  ],
  mysterious: [
    "Arcane Alcove",
    "Enchanted Nook",
    "Phantom Chamber",
    "Cryptic Hall",
    "Mystic Sanctuary",
    "Otherworldly Niche",
    "Spectral Vault",
    "Ethereal Hideaway",
    "Esoteric Grotto",
    "Secret Oasis",
  ],
};

// Artifact event configuration
export const ARTIFACT_CONFIG = {
  blessingChance: 0.5,
  blessingMultiplier: 1.5,
  curseMultiplier: 0.8,
};

// Helper functions
export const getRandomPathName = (pathType) => {
  const names = PATH_NAMES[pathType];
  return names[Math.floor(Math.random() * names.length)];
};

export const formatMultiplier = (multiplier) => {
  return multiplier.toFixed(2);
};

export const calculateWinnings = (bet, multiplier) => {
  return Math.ceil(bet * multiplier);
};

// Delay function for atmospheric pauses
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
