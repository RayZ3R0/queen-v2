import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import Lvl from "../../../schema/levelrole.js";

export default {
  name: "lvlroles",
  data: new SlashCommandBuilder()
    .setName("lvlroles")
    .setDescription("Display the server's level role rewards"),

  category: "Leveling",
  cooldown: 10,

  run: async ({ client, interaction }) => {
    try {
      await interaction.deferReply();

      // Use the current guild's id to fetch level role data dynamically
      const guildId = interaction.guild.id;
      const levelData = await Lvl.find({ gid: guildId });
      if (!levelData[0]) {
        return interaction.editReply({ content: "No level role data found." });
      }

      const rolesData = levelData[0].lvlrole;
      if (!Array.isArray(rolesData) || rolesData.length === 0) {
        return interaction.editReply({ content: "No level roles configured." });
      }

      // Sort roles by level ascending and display all configured roles
      const displayedRoles = [...rolesData]
        .sort((a, b) => Number(a.lvl) - Number(b.lvl))
        .map((roleEntry) => {
          const roleInstance = interaction.guild.roles.cache.get(roleEntry.role);
          return `**${roleEntry.lvl}** | ${
            roleInstance ? roleInstance : "Role not found"
          }`;
        });

      const randomColor = `#${Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0")}`;

      const embed = new EmbedBuilder()
        .setColor(randomColor)
        .setTitle("Level Roles")
        .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 1024 }))
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

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in lvlroles command:", error);
      return interaction.editReply({
        content: "An error occurred while executing the command.",
      });
    }
  },
};
