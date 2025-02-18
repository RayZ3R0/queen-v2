import { EmbedBuilder } from "discord.js";
import setLevel from "../../../utils/setLevel.js";

/**
 * @type {import("../../../index.js").Mcommand}
 */
export default {
  name: "setlevel",
  aliases: ["slevel", "xpset"],
  cooldown: 3,
  description: "Sets a user's level to a specified value (Dev Only).",
  userPermissions: ["Administrator"],
  botPermissions: [],
  category: "Dev",
  run: async ({ client, message, args, prefix }) => {
    // Validate arguments: expect a user mention (or ID) and a numeric level.
    if (!args[0] || !args[1]) {
      return message.channel.send({
        content: `Usage: \`${prefix}setlevel <user> <level>\``,
      });
    }

    // Try to resolve the target member
    let targetMember = message.mentions.members.first();
    if (!targetMember) {
      targetMember = message.guild.members.cache.get(args[0]);
    }
    if (!targetMember) {
      return message.channel.send({ content: "User not found." });
    }

    const levelValue = Number(args[1]);
    if (isNaN(levelValue) || levelValue < 0) {
      return message.channel.send({
        content: "Please provide a valid level number.",
      });
    }

    try {
      // Call the setLevel utility with the provided parameters.
      const result = await setLevel(
        message,
        targetMember.user.id,
        message.guild.id,
        levelValue
      );
      const successEmbed = new EmbedBuilder()
        .setTitle("Level Updated")
        .setDescription(
          `${targetMember} has been set to **level ${result.level}** with **${result.xp} XP**.`
        )
        .setColor("Green")
        .setTimestamp();
      return message.channel.send({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Error setting level:", error);
      return message.channel.send({
        content: "An error occurred while setting the level.",
      });
    }
  },
};
