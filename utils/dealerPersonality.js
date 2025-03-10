import {
  NATURAL_BLACKJACK_MULTIPLIER,
  botCheatAdjustment,
} from "./cardGameUtils.js";

// Dealer mood states
export const DEALER_MOODS = {
  FRIENDLY: "FRIENDLY",
  NEUTRAL: "NEUTRAL",
  ANNOYED: "ANNOYED",
  DEVIOUS: "DEVIOUS",
  IMPRESSED: "IMPRESSED",
};

// Difficulty settings
export const DIFFICULTY_SETTINGS = {
  easy: {
    cheatProbability: 0.1,
    mood: {
      friendly: 0.5,
      neutral: 0.3,
      annoyed: 0.1,
      devious: 0.1,
    },
    payoutMultiplier: 1.1,
    description: "A more forgiving dealer who's less likely to cheat.",
  },
  normal: {
    cheatProbability: 0.3,
    mood: {
      friendly: 0.2,
      neutral: 0.4,
      annoyed: 0.2,
      devious: 0.2,
    },
    payoutMultiplier: 1.0,
    description: "The classic devious dealer experience.",
  },
  hard: {
    cheatProbability: 0.5,
    mood: {
      friendly: 0.1,
      neutral: 0.2,
      annoyed: 0.3,
      devious: 0.4,
    },
    payoutMultiplier: 0.9,
    description: "A ruthless dealer who frequently bends the rules.",
  },
};

// Response templates for different situations
export const DEALER_RESPONSES = {
  GAME_START: {
    FRIENDLY: [
      "Ah, a fresh face at my table! Let's see what fortune has in store...",
      "Welcome, welcome! Care to test your luck against a humble dealer?",
      "The cards await your command. Shall we begin?",
    ],
    NEUTRAL: [
      "A sly grin crosses the dealer's face as you approach.",
      "The cards are shuffled, and fate awaits...",
      "Another brave soul seeks their fortune. Very well...",
    ],
    DEVIOUS: [
      "Back for more? How... courageous.",
      "The house always wins... eventually.",
      "Let's see if your luck holds out this time.",
    ],
  },

  NATURAL_BLACKJACK: {
    IMPRESSED: [
      "The dealer's eyes narrow as you reveal your perfect hand.",
      "A masterful draw! Even I must applaud such fortune.",
      "Well played... perhaps too well played.",
    ],
    ANNOYED: [
      "The dealer's smile tightens ever so slightly.",
      "Fortune favors you... for now.",
      "An impressive start. Let's see if it lasts.",
    ],
  },

  PLAYER_BUST: {
    FRIENDLY: [
      "Oh dear, it seems fortune has abandoned you.",
      "Such a shame. Perhaps next time?",
      "The cards can be cruel sometimes.",
    ],
    DEVIOUS: [
      "Another one bites the dust, as they say.",
      "The house claims another victory.",
      "Did you really think that would work?",
    ],
  },

  DEALER_BUST: {
    ANNOYED: [
      '"Impossible!" mutters the dealer, sweat beading on his brow.',
      "A rare mistake. Don't get used to it.",
      "The dealer's composure cracks, just for a moment.",
    ],
    NEUTRAL: [
      "Well played. The cards favored you this time.",
      "A victory well earned... or just lucky?",
      "The dealer nods in reluctant respect.",
    ],
  },

  PLAYER_WIN: {
    FRIENDLY: [
      "Well played! The cards smile upon you today.",
      "A worthy victory. Care to try your luck again?",
      "Most impressive. You seem to know your way around cards.",
    ],
    ANNOYED: [
      '"How... fortunate for you," the dealer says through gritted teeth.',
      "The dealer's smile doesn't quite reach his eyes.",
      "You win... for now.",
    ],
  },

  PLAYER_LOSE: {
    FRIENDLY: [
      "Better luck next time, perhaps?",
      "Don't let it discourage you. The tide always turns.",
      "Even the best players have their off days.",
    ],
    DEVIOUS: [
      "The house always wins in the end.",
      "The dealer's smile widens as he reveals his cards.",
      "Another soul learns the harsh lesson of chance.",
    ],
  },

  PUSH: {
    NEUTRAL: [
      '"A tie. How... anticlimactic," the dealer sighs.',
      "We seem to be evenly matched. How dull.",
      "Neither victory nor defeat. Shall we try again?",
    ],
  },

  TIME_OUT: {
    ANNOYED: [
      "Time is money, and you've wasted mine.",
      "The dealer drums his fingers impatiently.",
      "Some of us have other patrons to attend to.",
    ],
    NEUTRAL: [
      "The moment passes, and with it your chance.",
      "Decisiveness is a virtue at this table.",
      "Perhaps you need more time to consider your strategy?",
    ],
  },

  SURRENDER: {
    NEUTRAL: [
      '"A wise decision, perhaps," the dealer says with a thin smile.',
      "Living to play another day. How pragmatic.",
      "The dealer nods approvingly at your caution.",
    ],
    DEVIOUS: [
      "Another player learns their limits.",
      "Courage fails at the crucial moment.",
      "A strategic retreat? How... sensible.",
    ],
  },
};

// Helper function to get random response based on mood and difficulty
export const getDealerResponse = (situation, mood, difficulty = "normal") => {
  const responses = DEALER_RESPONSES[situation];
  if (!responses) return "";

  const settings = DIFFICULTY_SETTINGS[difficulty];

  // Adjust mood based on difficulty settings
  const moodProbabilities = settings.mood;
  const randomNum = Math.random();
  let selectedMood = mood;

  if (randomNum > moodProbabilities[mood.toLowerCase()]) {
    // Pick a different mood based on difficulty settings
    const moods = Object.keys(moodProbabilities);
    selectedMood =
      moods[Math.floor(Math.random() * moods.length)].toUpperCase();
  }

  const moodResponses =
    responses[selectedMood] || responses[Object.keys(responses)[0]];
  return moodResponses[Math.floor(Math.random() * moodResponses.length)];
};

// Determine dealer's mood based on game state and difficulty
export const getDealerMood = (gameState, difficulty = "normal") => {
  const {
    playerWinStreak = 0,
    dealerWinStreak = 0,
    currentBet = 0,
    playerTotalWinnings = 0,
    isHighStakes = false,
  } = gameState;

  const settings = DIFFICULTY_SETTINGS[difficulty];
  const baseChance = settings.cheatProbability;

  if (playerWinStreak >= 3) return DEALER_MOODS.ANNOYED;
  if (dealerWinStreak >= 3) return DEALER_MOODS.DEVIOUS;
  if (isHighStakes || currentBet > 1000) return DEALER_MOODS.DEVIOUS;
  if (playerTotalWinnings < 0 && Math.random() < settings.mood.friendly)
    return DEALER_MOODS.FRIENDLY;

  return DEALER_MOODS.NEUTRAL;
};

// Get dealer's cheat probability based on difficulty and game state
export const getDealerCheatProbability = (gameState, difficulty = "normal") => {
  const settings = DIFFICULTY_SETTINGS[difficulty];
  let probability = settings.cheatProbability;

  if (gameState.playerWinStreak > 2) probability += 0.1;
  if (gameState.isHighStakes) probability += 0.1;
  if (gameState.playerTotalWinnings > 5000) probability += 0.1;

  return Math.min(probability, 0.75); // Cap at 75% chance
};

// Get thinking delay based on situation and difficulty
export const getThinkingDelay = (action, difficulty = "normal") => {
  const baseDelays = {
    DEAL_INITIAL: { min: 500, max: 1000 },
    HIT_DECISION: { min: 700, max: 1500 },
    FINAL_REVEAL: { min: 1000, max: 2000 },
  };

  const delay = baseDelays[action] || { min: 500, max: 1000 };
  const randomDelay = Math.random() * (delay.max - delay.min) + delay.min;

  // Adjust based on difficulty
  switch (difficulty) {
    case "easy":
      return randomDelay * 1.2; // Slightly slower, more human-like
    case "hard":
      return randomDelay * 0.8; // Faster, more mechanical
    default:
      return randomDelay;
  }
};
