import { client } from "../bot.js";
import addXP from "../utils/addXP.js";
import lvlRole from "../utils/lvlRole.js";

const IGNORED_CHANNELS = [
  "1006477488014249994",
  "1006477351716134972",
  "901338643128516648",
  "957981195604471858",
  "957980980201816174",
  "957979414812065852",
  "955399577895317524",
  "972865600680497172",
  "1006472847608250419",
  "1006473034003128340",
];

const IGNORED_CATEGORIES = ["747780021657272390"];
const USER_COOLDOWNS = new Map();
const COOLDOWN_DURATION = 60000;

client.on("messageCreate", async (message) => {
  // Ignore bots and DMs
  if (message.author.bot || !message.guild) return;

  // Ignore specified channels and categories
  if (IGNORED_CHANNELS.includes(message.channel.id)) return;
  if (IGNORED_CATEGORIES.includes(message.channel.parentId)) return;

  // Ignore threads from ignored channels and categories
  if (message.channel.isThread?.()) {
    const parentChannelId = message.channel.parentId;
    if (IGNORED_CHANNELS.includes(parentChannelId)) return;
    
    // Check if parent channel is in an ignored category
    const parentChannel = await message.guild.channels.fetch(parentChannelId);
    if (parentChannel && IGNORED_CATEGORIES.includes(parentChannel.parentId)) return;
  }

  // Ignore if user is on cooldown
  if (USER_COOLDOWNS.has(message.author.id)) return;

  try {
    await addXP(message, message.author.id, message.guild.id, {
      min: 5,
      max: 20,
    });
    await lvlRole(message, message.author.id, message.guild.id);
  } catch (err) {
    console.error("[XP] Error adding XP:", err);
  }

  // Set cooldown
  USER_COOLDOWNS.set(message.author.id, true);
  setTimeout(() => {
    USER_COOLDOWNS.delete(message.author.id);
  }, COOLDOWN_DURATION);
});

client.on("levelUp", async (message, data, role) => {
  try {
    await message.reply({
      content: `Congratulations ${message.author}, you have reached level **${data.level}**.`,
    });
  } catch (error) {
    console.error("Error handling level up event:", error);
  }
});
