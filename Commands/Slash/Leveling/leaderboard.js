import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import getLeaderboard from "../../../utils/getLeaderboard.js";

export default {
  name: "leaderboard",
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Display the server's leveling leaderboard"),

  category: "Leveling",
  cooldown: 300,

  run: async ({ client, interaction }) => {
    try {
      await interaction.deferReply();

      const lbData = await getLeaderboard(client, interaction.guild.id);
      if (!lbData || lbData.length === 0) {
        return interaction.editReply({ content: "No leaderboard data found." });
      }

      // Sort by rank (position)
      lbData.sort((a, b) => a.position - b.position);

      // Pagination: 10 entries per page
      const itemsPerPage = 10;
      const pages = [];
      for (let i = 0; i < lbData.length; i += itemsPerPage) {
        const current = lbData.slice(i, i + itemsPerPage);
        const description = current
          .map(
            (e) =>
              `**#${e.position}** - ${e.tag} • Level: ${e.level} • XP: ${e.shortxp}`
          )
          .join("\n");

        const embed = new EmbedBuilder()
          .setTitle(`${interaction.guild.name} Leaderboard`)
          .setDescription(description)
          .setColor("Random")
          .setFooter({
            text: `Page ${Math.floor(i / itemsPerPage) + 1} of ${Math.ceil(
              lbData.length / itemsPerPage
            )}`,
          })
          .setTimestamp();
        pages.push(embed);
      }

      let currentPage = 0;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pages.length <= 1)
      );

      const msg = await interaction.editReply({
        embeds: [pages[currentPage]],
        components: [row],
      });

      if (pages.length <= 1) return;

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
      });

      collector.on("collect", async (i) => {
        // Only allow command invoker to interact
        if (i.user.id !== interaction.user.id) {
          return i.reply({
            content: "These buttons aren't for you.",
            ephemeral: true,
          });
        }

        if (i.customId === "prev") {
          currentPage = currentPage > 0 ? currentPage - 1 : pages.length - 1;
        } else if (i.customId === "next") {
          currentPage = currentPage < pages.length - 1 ? currentPage + 1 : 0;
        }

        // Update button disabled status
        row.components[0].setDisabled(currentPage === 0);
        row.components[1].setDisabled(currentPage === pages.length - 1);

        await i.update({
          embeds: [pages[currentPage]],
          components: [row],
        });
      });

      collector.on("end", async () => {
        row.components.forEach((btn) => btn.setDisabled(true));
        await interaction.editReply({ components: [row] }).catch(() => {});
      });
    } catch (error) {
      console.error("Error in leaderboard command:", error);
      return interaction.editReply({
        content: "An error occurred while retrieving the leaderboard.",
      });
    }
  },
};
