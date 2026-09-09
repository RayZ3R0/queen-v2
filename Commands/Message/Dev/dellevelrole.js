import { EmbedBuilder } from "discord.js";
import roleSetup from "../../../utils/roleSetup.js";

/**
 * @type {import("../../../index.js").Mcommand}
 */
export default {
  name: "dellevelrole",
  aliases: ["dellvlrole", "dlr", "removelevelrole", "removelvlrole"],
  description: "Remove a level role reward for a specific level. (Dev Only)",
  category: "Dev",
  owneronly: true,
  cooldown: 0,
  userPermissions: [],
  botPermissions: [],

  run: async ({ client, message, args, prefix }) => {
    if (!args[0]) {
      return message.channel.send({
        content: `❌ **Usage:** \`${prefix}dellevelrole <level>\``,
      });
    }

    const levelValue = Number(args[0]);
    if (isNaN(levelValue) || levelValue < 0) {
      return message.channel.send({
        content: "❌ Please provide a valid level number (0 or higher).",
      });
    }

    try {
      const removed = await roleSetup.remove(client, message.guild.id, {
        level: levelValue,
      });

      const roleObj =
        message.guild.roles.cache.get(removed.role) ||
        (await message.guild.roles.fetch(removed.role).catch(() => null));

      const embed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("Level Role Removed")
        .setDescription(
          `Removed level **${levelValue}** role reward: ${
            roleObj ? roleObj : `\`Role ID: ${removed.role}\``
          }`
        )
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Error in dellevelrole command:", error);
      return message.channel.send({
        content: `❌ ${error.message || "An error occurred while removing the level role."}`,
      });
    }
  },
};
