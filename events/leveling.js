import { client } from "../bot.js"; // Adjust path if needed
import addXP from "../utils/addXP.js"; // Ensure this file exports a named "roleSetup"
import lvlRole from "../utils/lvlRole.js";

const spame = [];

// Event listener for messageCreate
client.on("messageCreate", async (message) => {
  const spamChannels = [
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

  // Ignore messages from spam channels or from bots or if not in a guild.
  if (spamChannels.includes(message.channel.id)) return;
  if (!message.guild || message.author.bot) return;
  if (spame.includes(message.author.id)) return;

  try {
    await addXP(message, message.author.id, message.guild.id, {
      min: 5,
      max: 20,
    });
  } catch (err) {
    console.error("[XP] Error adding XP:", err);
  }

  spame.push(message.author.id);
  setTimeout(() => {
    const index = spame.indexOf(message.author.id);
    if (index !== -1) spame.splice(index, 1);
  }, 60000);

  lvlRole(message, message.author.id, message.guild.id);
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
