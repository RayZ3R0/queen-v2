import { EmbedBuilder } from "discord.js";

export const TUTORIAL_CHAPTERS = {
  INTRODUCTION: {
    id: "intro",
    title: "Meet the Devious Dealer",
    content: [
      {
        title: "Welcome to the Table",
        description:
          "Step into the world of Devious Dealer, where wit meets chance and fortune favors the bold... sometimes.\n\n" +
          "The Devious Dealer is a unique take on blackjack where the house doesn't just play by the rules—it bends them. " +
          "Your dealer is cunning, charismatic, and just a little bit crooked.\n\n" +
          "But don't worry, even their tricks can be turned to your advantage if you play smart!",
        image: null,
      },
      {
        title: "What Makes It Special",
        description:
          "• The dealer has a personality that reacts to your play style\n" +
          "• Special mechanics like insurance and surrender options\n" +
          "• Dynamic difficulty that adapts to your winning streaks\n" +
          "• Atmospheric responses that make each game unique",
        image: null,
      },
    ],
  },

  BASICS: {
    id: "basics",
    title: "The Basics of the Game",
    content: [
      {
        title: "Card Values",
        description:
          "• Number cards (2-10): Worth their face value\n" +
          "• Face cards (Jack, Queen, King): Worth 10\n" +
          "• Aces: Worth 1 or 11 (whichever helps you more)\n\n" +
          "Your goal is to get closer to 21 than the dealer without going over.",
        image: "cardValues.png",
      },
      {
        title: "Winning & Losing",
        description:
          "You win if:\n" +
          "• Your hand totals more than the dealer's (without busting)\n" +
          "• The dealer busts (goes over 21)\n" +
          "• You get a Natural Blackjack (21 with first two cards)\n\n" +
          "You lose if:\n" +
          "• Your hand goes over 21 (bust)\n" +
          "• Dealer's hand is higher than yours\n\n" +
          "If both you and the dealer have the same total, it's a push (tie).",
        image: null,
      },
    ],
  },

  MOVES: {
    id: "moves",
    title: "Your Available Moves",
    content: [
      {
        title: "Hit",
        description:
          "Request another card to increase your hand total.\n" +
          "Use this when:\n" +
          "• Your total is low (12 or less)\n" +
          "• You have an Ace counting as 1\n" +
          "• You're feeling lucky!\n\n" +
          "🎯 Practice Tip: Generally safe to hit on 16 or lower",
        image: null,
      },
      {
        title: "Stand",
        description:
          "Keep your current hand and end your turn.\n" +
          "Use this when:\n" +
          "• You have 17 or higher\n" +
          "• The dealer shows a weak card (4-6)\n" +
          "• You think the dealer might bust\n\n" +
          "🎯 Practice Tip: Always stand on hard 17 or higher",
        image: null,
      },
      {
        title: "Double Down",
        description:
          "Double your bet and receive exactly one more card.\n" +
          "Use this when:\n" +
          "• You have 11 (best case)\n" +
          "• You have 10 and dealer shows weak card\n" +
          "• You have 9 and dealer shows very weak card\n\n" +
          "🎯 Practice Tip: Most profitable on 11, but risky!",
        image: null,
      },
      {
        title: "Surrender",
        description:
          "Give up half your bet and end the hand.\n" +
          "Use this when:\n" +
          "• You have 16 vs dealer's 9, 10, or Ace\n" +
          "• You have 15 vs dealer's 10\n" +
          "• Your chances of winning are < 25%\n\n" +
          "🎯 Practice Tip: Better to lose half than whole bet",
        image: null,
      },
    ],
  },

  SPECIAL_PLAYS: {
    id: "special",
    title: "Special Plays & Insurance",
    content: [
      {
        title: "Insurance Bets",
        description:
          "When the dealer shows an Ace:\n" +
          "• You can bet up to half your original bet\n" +
          "• Pays 2:1 if dealer has Blackjack\n" +
          "• Lose insurance bet if dealer doesn't have Blackjack\n\n" +
          "🎯 Practice Tip: Generally not worth it unless you're counting cards!",
        image: null,
      },
      {
        title: "Natural Blackjack",
        description:
          "Getting an Ace and a 10-value card as your first two cards:\n" +
          "• Pays 3:2 on your bet\n" +
          "• Beats any dealer hand except another Natural Blackjack\n" +
          "• Ties with dealer's Natural Blackjack\n\n" +
          "🎯 Practice Tip: Always check dealer's up card for potential Blackjack",
        image: null,
      },
    ],
  },

  STRATEGY: {
    id: "strategy",
    title: "Advanced Strategy & Tips",
    content: [
      {
        title: "Reading the Dealer",
        description:
          "Our dealer has personality traits:\n" +
          "• Gets annoyed during your winning streaks\n" +
          "• Becomes more devious with high stakes\n" +
          "• Shows sympathy when you're down\n\n" +
          "Watch their responses for hints about their mood!",
        image: null,
      },
      {
        title: "Basic Strategy",
        description:
          "Key decisions based on your hand vs dealer's up card:\n\n" +
          "HARD TOTALS:\n" +
          "• 8 or less: Always hit\n" +
          "• 9: Double vs 3-6, otherwise hit\n" +
          "• 10-11: Double vs 2-9, hit vs 10/Ace\n" +
          "• 12-16: Stand vs 4-6, hit vs 7+\n" +
          "• 17+: Always stand\n\n" +
          "SOFT TOTALS (with Ace):\n" +
          "• 13-15: Hit\n" +
          "• 16-17: Double vs 4-6, hit otherwise\n" +
          "• 18: Double vs 3-6, stand vs 2,7,8, hit otherwise\n" +
          "• 19+: Always stand",
        image: null,
      },
    ],
  },
};

export const createTutorialEmbed = (chapter, page = 0) => {
  const chapterData = TUTORIAL_CHAPTERS[chapter];
  if (!chapterData || !chapterData.content[page]) return null;

  const content = chapterData.content[page];
  const totalPages = chapterData.content.length;

  return new EmbedBuilder()
    .setColor("#663399")
    .setTitle(`${chapterData.title} (${page + 1}/${totalPages})`)
    .setDescription(content.description)
    .setAuthor({ name: "Devious Dealer Tutorial" })
    .setFooter({
      text: `Chapter: ${chapterData.title} • Page ${page + 1}/${totalPages}`,
    });
};

export const getPracticeHand = (difficulty = "normal") => {
  // Generate practice scenarios based on difficulty
  const scenarios = {
    easy: [
      { player: ["10H", "7S"], dealer: ["6D"] },
      { player: ["AH", "5D"], dealer: ["7S"] },
      { player: ["8C", "8H"], dealer: ["9D"] },
    ],
    normal: [
      { player: ["10H", "6S"], dealer: ["AS"] },
      { player: ["7H", "8D"], dealer: ["10S"] },
      { player: ["AS", "6H"], dealer: ["7D"] },
    ],
    hard: [
      { player: ["10S", "6H"], dealer: ["AS"] },
      { player: ["9S", "7H"], dealer: ["7S"] },
      { player: ["AS", "5H"], dealer: ["10D"] },
    ],
  };

  const difficultyScenarios = scenarios[difficulty] || scenarios.normal;
  return difficultyScenarios[
    Math.floor(Math.random() * difficultyScenarios.length)
  ];
};

export const getRecommendedPlay = (playerHand, dealerUpcard) => {
  // Return recommended play for practice hands
  const playerTotal = calculateTotal(playerHand);
  const dealerValue = getCardValue(dealerUpcard);

  // Basic strategy recommendations
  if (playerTotal <= 8) return "Hit";
  if (playerTotal === 9)
    return dealerValue >= 3 && dealerValue <= 6 ? "Double Down" : "Hit";
  if (playerTotal === 10) return dealerValue <= 9 ? "Double Down" : "Hit";
  if (playerTotal === 11) return "Double Down";
  if (playerTotal >= 17) return "Stand";
  if (playerTotal >= 12 && playerTotal <= 16)
    return dealerValue >= 4 && dealerValue <= 6 ? "Stand" : "Hit";

  return "Consider your options carefully...";
};

// Helper function to calculate hand total
const calculateTotal = (hand) => {
  let total = 0;
  let aces = 0;

  hand.forEach((card) => {
    const value = getCardValue(card);
    if (value === 11) aces++;
    total += value;
  });

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
};

// Helper function to get card value
const getCardValue = (card) => {
  const value = card.charAt(0);
  if (value === "A") return 11;
  if (["K", "Q", "J", "1"].includes(value)) return 10;
  return parseInt(value);
};
