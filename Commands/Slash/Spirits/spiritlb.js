import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "spiritlb",
  category: "Spirits",
  cooldown: 30,
  data: new SlashCommandBuilder()
    .setName("spiritlb")
    .setDescription("Check the spirit coins leaderboard."),

  run: async ({ client, interaction }) => {
    try {
      await interaction.deferReply();

      // Fetch and sort profiles
      const profiles = await profileSchema.find();
      if (!profiles.length) {
        return interaction.editReply("No leaderboard data available.");
      }

      // Sort profiles by balance descending and limit to top 50 entries
      const sortedProfiles = profiles
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 50);

      // Split the sorted list into pages with 10 entries each
      const pageSize = 10;
      const pages = [];
      for (let i = 0; i < sortedProfiles.length; i += pageSize) {
        const chunk = sortedProfiles.slice(i, i + pageSize);
        const description = chunk
          .map(
            (profile, idx) =>
              `**${i + idx + 1}.** <@${profile.userid}> - **${
                profile.balance
              }** Spirit Coins`
          )
          .join("\n");

        // Color scheme for different pages
        let color;
        if (i === 0) color = "Red";
        else if (i === pageSize) color = "Yellow";
        else if (i === pageSize * 2) color = "Green";
        else color = "Blurple";

        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle("Spirit Coins Leaderboard")
          .setDescription(description)
          .setFooter({
            text: `Page ${i / pageSize + 1}/${Math.ceil(
              sortedProfiles.length / pageSize
            )}`,
          });
        pages.push(embed);
      }

      let currentPage = 0;

      // Function to create button components
      const createComponents = () => {
        // Only show buttons if there's more than one page
        if (pages.length <= 1) return [];
        return [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("first")
              .setStyle(ButtonStyle.Primary)
              .setEmoji("911637785037910077"),
            new ButtonBuilder()
              .setCustomId("previous")
              .setStyle(ButtonStyle.Primary)
              .setEmoji("911640280434892850"),
            new ButtonBuilder()
              .setCustomId("next")
              .setStyle(ButtonStyle.Primary)
              .setEmoji("911640141007839273"),
            new ButtonBuilder()
              .setCustomId("last")
              .setStyle(ButtonStyle.Primary)
              .setEmoji("911637840176250890")
          ),
        ];
      };

      const response = await interaction.editReply({
        embeds: [pages[currentPage]],
        components: createComponents(),
      });

      if (pages.length <= 1) return true;

      // Create a button collector for pagination
      const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
        filter: (i) => i.user.id === interaction.user.id,
      });

      collector.on("collect", async (i) => {
        switch (i.customId) {
          case "first":
            currentPage = 0;
            break;
          case "previous":
            currentPage = currentPage > 0 ? currentPage - 1 : pages.length - 1;
            break;
          case "next":
            currentPage = currentPage < pages.length - 1 ? currentPage + 1 : 0;
            break;
          case "last":
            currentPage = pages.length - 1;
            break;
        }
        await i.update({
          embeds: [pages[currentPage]],
          components: createComponents(),
        });
      });

      collector.on("end", async () => {
        // Disable buttons when collector expires
        if (response) {
          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("first")
              .setStyle(ButtonStyle.Primary)
              .setEmoji("911637785037910077")
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId("previous")
              .setStyle(ButtonStyle.Primary)
              .setEmoji("911640280434892850")
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId("next")
              .setStyle(ButtonStyle.Primary)
              .setEmoji("911640141007839273")
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId("last")
              .setStyle(ButtonStyle.Primary)
              .setEmoji("911637840176250890")
              .setDisabled(true)
          );
          await interaction.editReply({ components: [disabledRow] });
        }
      });

      return true;
    } catch (error) {
      console.error("SpiritLB command error:", error);
      await interaction.editReply({
        content: "An error occurred while fetching the leaderboard.",
      });
      return false;
    }
  },
};
