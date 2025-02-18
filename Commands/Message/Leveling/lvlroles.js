import { EmbedBuilder } from "discord.js";
import Lvl from "../../../schema/levelrole.js";

export default {
  name: "lvlroles",
  aliases: ["lr", "levelrole", "lvlrole"],
  description:
    "When you reach the required level, the level role is added to you.",
  timeout: 3,
  userPermissions: [],
  botPermissions: [],
  category: "Leveling",

  /**
   * @param {Object} context
   * @param {import("discord.js").Client} context.client
   * @param {import("discord.js").Message} context.message
   * @param {String[]} context.args
   * @param {String} context.prefix
   */
  run: async ({ client, message, args, prefix }) => {
    try {
      // Use the current guild's id to fetch level role data dynamically.
      const guildId = message.guild.id;
      const levelData = await Lvl.find({ gid: guildId });
      if (!levelData[0]) {
        return message.channel.send({ content: "No level role data found." });
      }

      const rolesData = levelData[0].lvlrole;
      if (!Array.isArray(rolesData) || rolesData.length === 0) {
        return message.channel.send({ content: "No level roles configured." });
      }

      // Limit display to at most 11 roles.
      const maxDisplay = 11;
      const displayedRoles = rolesData.slice(0, maxDisplay).map((roleEntry) => {
        const roleInstance = message.guild.roles.cache.get(roleEntry.role);
        return `**${roleEntry.lvl}** | ${
          roleInstance ? roleInstance : "Role not found"
        }`;
      });

      // Append note if there are extra roles beyond the first 11.
      if (rolesData.length > maxDisplay) {
        displayedRoles.push(`...and ${rolesData.length - maxDisplay} more.`);
      }

      const randomColor = `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")}`;

      const embed = new EmbedBuilder()
        .setColor(randomColor)
        .setTitle("Level Roles")
        .setThumbnail(message.guild.iconURL({ dynamic: true, size: 1024 }))
        .setDescription(
          `When you reach the required levels you get the following roles:\n\n${displayedRoles.join(
            "\n"
          )}`
        )
        .setFooter({
          text: `${rolesData.length} Level Role${
            rolesData.length !== 1 ? "s" : ""
          }`,
        });

      await message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Error in lvlroles command:", error);
      message.channel.send({
        content: "An error occurred while executing the command.",
      });
    }
  },
};
