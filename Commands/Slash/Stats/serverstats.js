import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} from "discord.js";
import {
  handleOverview,
  handleMembers,
  handleActivity,
  timeframes,
} from "../../../utils/statsViewHandlers.js";
import { LRUCache } from "lru-cache";

// Cache for storing rendered pages
const pageCache = new LRUCache({
  max: 100, // Maximum number of items
  ttl: 1000 * 60 * 5, // 5 minutes
});

export default {
  name: "serverstats",
  category: "Stats",
  description: "View detailed server statistics",
  userPermissions: [PermissionFlagsBits.ViewChannel],
  botPermissions: [PermissionFlagsBits.ViewChannel],

  data: new SlashCommandBuilder()
    .setName("serverstats")
    .setDescription("View detailed server statistics")
    .addStringOption((option) =>
      option
        .setName("view")
        .setDescription("Choose what statistics to view")
        .setRequired(true)
        .addChoices(
          { name: "Overview", value: "overview" },
          { name: "Members", value: "members" },
          { name: "Activity", value: "activity" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("timeframe")
        .setDescription("Select time period")
        .setRequired(false)
        .addChoices(
          { name: "24 Hours", value: "1d" },
          { name: "7 Days", value: "7d" },
          { name: "30 Days", value: "30d" },
          { name: "All Time", value: "all" }
        )
    ),

  run: async ({ client, interaction }) => {
    await interaction.deferReply();

    try {
      const view = interaction.options.getString("view");
      const timeframe = interaction.options.getString("timeframe") || "7d";

      // Check cache first
      const cacheKey = `${interaction.guildId}_${view}_${timeframe}`;
      const cachedData = pageCache.get(cacheKey);

      if (cachedData) {
        await interaction.editReply(cachedData);
        return;
      }

      let embed = new EmbedBuilder()
        .setColor(client.config.embed.color)
        .setTitle(
          `Server Statistics - ${
            view.charAt(0).toUpperCase() + view.slice(1)
          } - ${timeframes[timeframe].label}`
        )
        .setTimestamp();

      // Handle the specific view and get chart files
      let files = [];
      switch (view) {
        case "overview":
          files = await handleOverview(interaction, embed, timeframe);
          break;
        case "members":
          files = await handleMembers(interaction, embed, timeframe);
          break;
        case "activity":
          files = await handleActivity(interaction, embed, timeframe);
          break;
      }

      // Add timeframe selector
      const components = [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("timeframe_select")
            .setPlaceholder("Select Timeframe")
            .addOptions(
              Object.entries(timeframes).map(([value, data]) => ({
                label: data.label,
                value: value,
                default: value === timeframe,
              }))
            )
        ),
      ];

      const reply = {
        embeds: [embed],
        components,
        files,
      };

      // Cache the response
      pageCache.set(cacheKey, reply);
      await interaction.editReply(reply);
    } catch (error) {
      console.error("Error in serverstats command:", error);
      await interaction.editReply({
        content: "An error occurred while fetching statistics.",
        ephemeral: true,
      });
    }
  },
};
