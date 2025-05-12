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
  handleChannels,
  timeframes,
} from "../../../utils/statsViewHandlers.js";

// Validate imports exist
if (!handleOverview || !handleMembers || !handleActivity || !handleChannels) {
  throw new Error(
    "Failed to import required handlers from statsViewHandlers.js",
  );
}
import { LRUCache } from "lru-cache";

// Cache for storing rendered pages
const pageCache = new LRUCache({
  max: 100, // Maximum number of items
  ttl: 1000 * 60 * 5, // 5 minutes
});

const getCommandData = () => ({
  name: "serverstats",
  category: "Stats",
  description: "View detailed server statistics",
  userPermissions: [PermissionFlagsBits.ViewChannel],
  botPermissions: [PermissionFlagsBits.ViewChannel],
  cooldown: 120,
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
          { name: "Activity", value: "activity" },
          { name: "Channels", value: "channels" },
        ),
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
          { name: "All Time", value: "all" },
        ),
    ),
});

export default {
  ...getCommandData(),

  run: async ({ client, interaction }) => {
    await interaction.deferReply().catch(console.error);

    try {
      const view = interaction.options.getString("view");
      const timeframe = interaction.options.getString("timeframe") || "7d";
      const cacheKey = `${interaction.guildId}_${view}_${timeframe}`;

      // Check cache first
      const cachedData = pageCache.get(cacheKey);
      if (cachedData) {
        return await interaction.editReply(cachedData);
      }

      // Create embed base
      const embed = new EmbedBuilder()
        .setColor(client.config.embed.color)
        .setTitle(
          `Server Statistics - ${
            view.charAt(0).toUpperCase() + view.slice(1)
          } - ${timeframes[timeframe].label}`,
        )
        .setTimestamp();

      // Get files and populate embed from handler
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
        case "channels":
          files = await handleChannels(interaction, embed, timeframe);
          break;
      }

      // Create UI components
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
              })),
            ),
        ),
      ];

      const replyOptions = {
        embeds: [embed],
        components,
        files,
      };

      // Cache and send response
      pageCache.set(cacheKey, replyOptions);
      await interaction.editReply(replyOptions);
    } catch (error) {
      console.error("Error in serverstats command:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply();
      }
      await interaction.editReply({
        content: "An error occurred while fetching statistics.",
        ephemeral: true,
      });
    }
  },
};
