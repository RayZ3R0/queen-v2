import { EmbedBuilder } from "discord.js";
import { SPIRIT_POWERS } from "./spiritPowers.js";
import { LOCATIONS } from "./locationManager.js";

// Bond activities and their configurations
export const BOND_ACTIVITIES = {
  date: {
    description: "Take your spirit on a date",
    affinity: 15,
    coins: 200,
    cooldown: 43200, // 12 hours
    locations: [
      {
        name: "Tenguu City Shopping District",
        description: "Browse shops and enjoy local cuisine",
        spirits: ["Tohka Yatogami", "Kotori Itsuka"],
        bonus: 1.2,
      },
      {
        name: "Raizen High School Rooftop",
        description: "A peaceful spot with a great view",
        spirits: ["Tohka Yatogami", "Origami Tobiichi"],
        bonus: 1.15,
      },
      {
        name: "Local Sweets Shop",
        description: "Perfect for those with a sweet tooth",
        spirits: ["Kotori Itsuka", "Yoshino"],
        bonus: 1.25,
      },
      {
        name: "Clock Tower",
        description: "A mysterious and gothic location",
        spirits: ["Kurumi Tokisaki"],
        bonus: 1.3,
      },
    ],
  },
  chat: {
    description: "Have a conversation with your spirit",
    affinity: 5,
    coins: 50,
    cooldown: 3600, // 1 hour
    topics: [
      {
        name: "Daily Life",
        description: "Discuss everyday activities and interests",
        spirits: ["Tohka Yatogami", "Yoshino"],
        bonus: 1.1,
      },
      {
        name: "Combat Tactics",
        description: "Discuss battle strategies and techniques",
        spirits: ["Origami Tobiichi", "Kurumi Tokisaki"],
        bonus: 1.2,
      },
      {
        name: "Spirit Powers",
        description: "Talk about Angels and spirit abilities",
        spirits: ["Tohka Yatogami", "Kurumi Tokisaki"],
        bonus: 1.15,
      },
    ],
  },
  gift: {
    description: "Give a gift to your spirit",
    affinity: 10,
    coins: 100,
    cooldown: 21600, // 6 hours
    items: [
      {
        name: "Kinako Bread",
        description: "A favorite snack",
        cost: 100,
        spirits: ["Tohka Yatogami"],
        bonus: 1.5,
      },
      {
        name: "Chupa Chups",
        description: "A special lollipop",
        cost: 50,
        spirits: ["Kotori Itsuka"],
        bonus: 1.4,
      },
      {
        name: "Yoshinon Puppet",
        description: "A cute puppet friend",
        cost: 200,
        spirits: ["Yoshino"],
        bonus: 1.6,
      },
      {
        name: "Antique Clock",
        description: "A beautifully crafted timepiece",
        cost: 300,
        spirits: ["Kurumi Tokisaki"],
        bonus: 1.5,
      },
      {
        name: "Combat Manual",
        description: "Advanced AST tactical guide",
        cost: 250,
        spirits: ["Origami Tobiichi"],
        bonus: 1.4,
      },
    ],
  },
};

// Affection level thresholds and titles
export const AFFECTION_LEVELS = {
  0: {
    title: "Suspicious",
    color: "#ff0000",
    description: "The spirit is wary of your presence",
    bonus: 1.0,
  },
  100: {
    title: "Cautious",
    color: "#ff9900",
    description: "The spirit shows signs of accepting you",
    bonus: 1.1,
  },
  250: {
    title: "Friendly",
    color: "#ffff00",
    description: "The spirit begins to trust you",
    bonus: 1.2,
  },
  500: {
    title: "Trusting",
    color: "#00ff00",
    description: "The spirit feels comfortable around you",
    bonus: 1.3,
  },
  1000: {
    title: "Affectionate",
    color: "#ff69b4",
    description: "The spirit has developed a strong bond with you",
    bonus: 1.5,
  },
};

// Spirit-specific emotional responses
export const SPIRIT_EMOTIONS = {
  "Tohka Yatogami": {
    highAffinity: [
      "Your kindness reminds me of the first time we met!",
      "As long as you're here, I feel at peace.",
      "Will you take me to try more delicious food?",
    ],
    mediumAffinity: [
      "I'm starting to understand humans better.",
      "You're different from other humans...",
      "This feeling... is it what they call happiness?",
    ],
    lowAffinity: [
      "Are you here to hurt me like the others?",
      "I don't know if I can trust humans...",
      "Should I run away?",
    ],
  },
  "Kurumi Tokisaki": {
    highAffinity: [
      "Ara ara~ You're quite interesting...",
      "Perhaps I'll spare some time for you.",
      "You remind me of him... in a good way.",
    ],
    mediumAffinity: [
      "Your determination is... admirable.",
      "Time is precious, use it wisely.",
      "You're not as boring as most humans.",
    ],
    lowAffinity: [
      "Don't waste my time.",
      "Are you brave or just foolish?",
      "I could end you in an instant...",
    ],
  },
  Yoshino: {
    highAffinity: [
      "Yoshinon and I both like you!",
      "Thank you for being so kind...",
      "Can we play together again?",
    ],
    mediumAffinity: [
      "You won't hurt us, right?",
      "Yoshinon says you seem nice...",
      "It's not so scary when you're here.",
    ],
    lowAffinity: [
      "*hides behind Yoshinon*",
      "Please... don't come closer...",
      "Are you with the AST...?",
    ],
  },
  "Kotori Itsuka": {
    highAffinity: [
      "Don't get the wrong idea, I just happen to trust you!",
      "You're not half bad at this...",
      "Want to share these Chupa Chups?",
    ],
    mediumAffinity: [
      "At least you're trying to understand us.",
      "Keep proving yourself, and maybe...",
      "Commander mode or not, you're interesting.",
    ],
    lowAffinity: [
      "Don't think being nice will work on me.",
      "I'm watching your every move.",
      "Prove you're worth my time.",
    ],
  },
  "Origami Tobiichi": {
    highAffinity: [
      "Your strategic approach is... acceptable.",
      "Perhaps working together isn't inefficient.",
      "You've proven yourself capable.",
    ],
    mediumAffinity: [
      "Your methods are... different.",
      "I'll observe your progress.",
      "Show me more of your capabilities.",
    ],
    lowAffinity: [
      "You're either an ally or an obstacle.",
      "Don't interfere with my mission.",
      "Prove your worth or step aside.",
    ],
  },
};

export const getAffectionLevel = (affinity) => {
  // Ensure affinity is a valid number
  const points = Number(affinity) || 0;

  // Get sorted levels from highest to lowest threshold
  const levels = Object.entries(AFFECTION_LEVELS).sort((a, b) => b[0] - a[0]);

  // Find the appropriate level
  for (const [threshold, data] of levels) {
    if (points >= Number(threshold)) {
      return {
        threshold: Number(threshold),
        ...data,
      };
    }
  }

  // Fallback to default level (0) if no matching level found
  return {
    threshold: 0,
    ...AFFECTION_LEVELS[0],
    title: "Suspicious",
    color: "#ff0000",
    description: "The spirit is wary of your presence",
    bonus: 1.0,
  };
};

// Get random emotional response based on affinity level
export const getEmotionalResponse = (spirit, affinity) => {
  if (!SPIRIT_EMOTIONS[spirit]) return null;

  let responses;
  if (affinity >= 750) {
    responses = SPIRIT_EMOTIONS[spirit].highAffinity;
  } else if (affinity >= 250) {
    responses = SPIRIT_EMOTIONS[spirit].mediumAffinity;
  } else {
    responses = SPIRIT_EMOTIONS[spirit].lowAffinity;
  }

  return responses[Math.floor(Math.random() * responses.length)];
};

// Create affection display embed
export const createAffectionEmbed = (spirit, affinity) => {
  try {
    // Ensure we have valid inputs
    if (!spirit) throw new Error("Spirit name is required");

    // Get current level data
    const level = getAffectionLevel(affinity);
    if (!level) throw new Error("Could not determine affection level");

    // Find next level
    const nextLevel = Object.entries(AFFECTION_LEVELS)
      .sort((a, b) => a[0] - b[0])
      .find(([threshold]) => Number(threshold) > (affinity || 0));

    const response = getEmotionalResponse(spirit, affinity);

    const embed = new EmbedBuilder()
      .setTitle(`${spirit}'s Feelings`)
      .setColor(level.color || "#ff0000") // Fallback color
      .addFields(
        {
          name: "Affection Level",
          value: level.title || "Unknown",
          inline: true,
        },
        {
          name: "Bonus Multiplier",
          value: `${level.bonus || 1.0}x`,
          inline: true,
        }
      )
      .setDescription(level.description || "No description available");

    if (response) {
      embed.addFields({ name: "Spirit's Response", value: response });
    }

    if (nextLevel) {
      const remaining = Number(nextLevel[0]) - (affinity || 0);
      embed.addFields({
        name: "Next Level",
        value: `${remaining} affinity points until "${nextLevel[1].title}"`,
      });
    }

    return embed;
  } catch (error) {
    console.error("Error creating affection embed:", error);
    // Return a basic error embed instead of throwing
    return new EmbedBuilder()
      .setTitle("Spirit Emotions")
      .setColor("#ff0000")
      .setDescription("Could not display spirit emotions at this time.")
      .addFields({
        name: "Debug Info",
        value: `Spirit: ${spirit || "Unknown"}\nAffinity: ${affinity || 0}`,
      });
  }
};

// Calculate performance bonus based on affection
export const calculateAffectionBonus = (baseValue, affinity) => {
  const level = getAffectionLevel(affinity);
  return Math.floor(baseValue * level.bonus);
};
