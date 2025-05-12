import { Events, EmbedBuilder } from "discord.js";
import { MemberActivity } from "../schema/serverStats.js";
import pkg from "@napi-rs/canvas";
const { createCanvas, GlobalFonts } = pkg;
import { LRUCache } from "lru-cache";
import {
  handleOverview,
  handleMembers,
  handleActivity,
  handleChannels,
  timeframes,
} from "../utils/statsViewHandlers.js";

// Cache for storing rendered pages
const pageCache = new LRUCache({
  max: 100, // Maximum number of items
  ttl: 1000 * 60 * 5, // 5 minutes
});

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "timeframe_select") return;

    try {
      await interaction.deferUpdate();

      // Get the selected timeframe
      const timeframe = interaction.values[0];

      // Get current view from the message embed title
      const currentEmbed = interaction.message.embeds[0];
      if (!currentEmbed) return;

      const titleMatch = currentEmbed.title.match(
        /Server Statistics - (\w+) -/,
      );
      if (!titleMatch) return;

      const view = titleMatch[1].toLowerCase();

      // Check cache first
      const cacheKey = `${interaction.guildId}_${view}_${timeframe}`;
      const cachedData = pageCache.get(cacheKey);

      if (cachedData) {
        return await interaction.editReply(cachedData);
      }

      // Create a new embed with the updated timeframe
      const embed = new EmbedBuilder()
        .setColor(interaction.message.embeds[0].color)
        .setTitle(
          `Server Statistics - ${view.charAt(0).toUpperCase() + view.slice(1)} - ${timeframes[timeframe].label}`,
        )
        .setTimestamp();

      // Get the chart file
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
        default:
          files = [];
      }

      // Generate components with updated timeframe selection
      const components = [
        {
          type: 1,
          components: [
            {
              type: 3,
              custom_id: "timeframe_select",
              placeholder: "Select Timeframe",
              options: Object.entries(timeframes).map(([value, data]) => ({
                label: data.label,
                value: value,
                default: value === timeframe,
              })),
            },
          ],
        },
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
      console.error("Error handling stats interaction:", error);
      await interaction.followUp({
        content: "An error occurred while updating the statistics display.",
        ephemeral: true,
      });
    }
  },
};
