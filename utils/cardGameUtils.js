import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Game Constants
export const CHEAT_PROBABILITY = 0.3;
export const SOFT17_HIT_PROBABILITY = 0.5;
export const BORDERLINE_NUDGE_PROBABILITY = 0.35;
export const EXTRA_TWEAK_PROBABILITY = 0.2;
export const NATURAL_BLACKJACK_MULTIPLIER = 1.5;
export const MAX_ANIMATIONS_PER_MIN = 5;

// Difficulty-based payout multipliers
const DIFFICULTY_MULTIPLIERS = {
  easy: 1.2,
  normal: 1.0,
  hard: 0.8,
};

// Calculate payout with difficulty adjustment
export const calculatePayout = (baseBet, multiplier, difficulty = "normal") => {
  const difficultyMultiplier =
    DIFFICULTY_MULTIPLIERS[difficulty] || DIFFICULTY_MULTIPLIERS.normal;
  return Math.floor(baseBet * multiplier * difficultyMultiplier);
};

// Card definitions
export const suits = ["S", "H", "D", "C"];
export const ranks = [
  { rank: "A", value: 11 },
  { rank: "2", value: 2 },
  { rank: "3", value: 3 },
  { rank: "4", value: 4 },
  { rank: "5", value: 5 },
  { rank: "6", value: 6 },
  { rank: "7", value: 7 },
  { rank: "8", value: 8 },
  { rank: "9", value: 9 },
  { rank: "10", value: 10 },
  { rank: "J", value: 10 },
  { rank: "Q", value: 10 },
  { rank: "K", value: 10 },
];

// Card image paths mapping
export const cardImages = {};
suits.forEach((suit) => {
  ranks.forEach(({ rank }) => {
    const code = `${rank}${suit}`;
    let fileName = "";

    // Handle face cards that have "2" suffix
    if (["K", "Q", "J"].includes(rank)) {
      const cardName = {
        K: "king",
        Q: "queen",
        J: "jack",
      }[rank];
      fileName = `${cardName}_of_${getSuitName(suit)}2.png`;
    } else {
      // Regular number cards and ace
      const cardName = {
        A: "ace",
        2: "2",
        3: "3",
        4: "4",
        5: "5",
        6: "6",
        7: "7",
        8: "8",
        9: "9",
        10: "10",
      }[rank];
      fileName = `${cardName}_of_${getSuitName(suit)}.png`;
    }

    cardImages[code] = join(__dirname, "..", "Cards", fileName);
  });
});

function getSuitName(suit) {
  switch (suit) {
    case "S":
      return "spades";
    case "H":
      return "hearts";
    case "D":
      return "diamonds";
    case "C":
      return "clubs";
    default:
      return "";
  }
}

// Deck generation and manipulation
export const generateDeck = () => {
  const deck = [];
  for (const suit of suits) {
    for (const { rank, value } of ranks) {
      deck.push({ code: `${rank}${suit}`, rank, suit, value });
    }
  }
  return deck;
};

export const shuffleDeck = (deck) => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

// Hand calculations
export const calculateHandTotal = (hand) => {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += card.value;
    if (card.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
};

export const isNaturalBlackjack = (hand) => {
  return hand.length === 2 && calculateHandTotal(hand) === 21;
};

export const isSoft17 = (hand) => {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += card.value;
    if (card.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total === 17 && aces > 0;
};

// Dealer AI
export const smartDealerMove = (dealerHand, deck) => {
  let total = calculateHandTotal(dealerHand);

  while (
    total < 17 ||
    (total === 17 &&
      isSoft17(dealerHand) &&
      Math.random() < SOFT17_HIT_PROBABILITY)
  ) {
    const newCard = deck.pop();
    dealerHand.push(newCard);
    total = calculateHandTotal(dealerHand);
  }

  if (total > 21 && Math.random() < CHEAT_PROBABILITY) {
    for (let i = 0; i < dealerHand.length; i++) {
      const card = dealerHand[i];
      if (["K", "Q", "J", "10"].includes(card.rank)) {
        dealerHand[i] = {
          code: `2${card.suit}`,
          rank: "2",
          suit: card.suit,
          value: 2,
        };
        break;
      }
    }
  }

  return dealerHand;
};

export const botCheatAdjustment = (dealerHand) => {
  let total = calculateHandTotal(dealerHand);

  if (
    total >= 17 &&
    total < 21 &&
    Math.random() < BORDERLINE_NUDGE_PROBABILITY
  ) {
    total = Math.min(21, total + 1);
  }

  if (total === 17 && isSoft17(dealerHand) && Math.random() < 0.5) {
    const bonus = Math.random() < 0.5 ? 1 : 2;
    total = Math.min(21, total + bonus);
  }

  if (total >= 18 && total < 21 && Math.random() < EXTRA_TWEAK_PROBABILITY) {
    total = Math.min(21, total + 1);
  }

  return total;
};

// Rate limiting
const animationTimestamps = new Map();

export const canSendAnimation = (userId) => {
  const now = Date.now();
  const userAnimations = animationTimestamps.get(userId) || [];
  const recentAnimations = userAnimations.filter((time) => now - time < 60000);

  if (recentAnimations.length >= MAX_ANIMATIONS_PER_MIN) {
    return false;
  }

  recentAnimations.push(now);
  animationTimestamps.set(userId, recentAnimations);
  return true;
};
