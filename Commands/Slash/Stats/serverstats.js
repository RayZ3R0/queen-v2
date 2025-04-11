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
    "Failed to import required handlers from statsViewHandlers.js"
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
          { name: "Channels", value: "channels" }
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

      const embed = await generateEmbed({
        client,
        interaction,
        view,
        timeframe,
      });
      const files = await generateFiles({
        interaction,
        embed,
        view,
        timeframe,
      });
      const components = generateComponents(timeframe);

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
      if (!interaction.deferred) {
        await interaction.deferReply();
      }
      await interaction.editReply({
        content: "An error occurred while fetching statistics.",
        ephemeral: true,
      });
    }
  },
};

function generateComponents(timeframe) {
  try {
    return [
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
  } catch (error) {
    console.error("Error generating components:", error);
    throw error;
  }
}

async function generateEmbed({ client, interaction, view, timeframe }) {
  try {
    return new EmbedBuilder()
      .setColor(client.config.embed.color)
      .setTitle(
        `Server Statistics - ${
          view.charAt(0).toUpperCase() + view.slice(1)
        } - ${timeframes[timeframe].label}`
      )
      .setTimestamp();
  } catch (error) {
    console.error("Error generating embed:", error);
    throw error;
  }
}

async function generateFiles({ interaction, embed, view, timeframe }) {
  try {
    const files = [];

    switch (view) {
      case "overview":
        files.push(...(await handleOverview(interaction, embed, timeframe)));
        break;
      case "members":
        files.push(...(await handleMembers(interaction, embed, timeframe)));
        break;
      case "activity":
        files.push(...(await handleActivity(interaction, embed, timeframe)));
        break;
      case "channels":
        files.push(...(await handleChannels(interaction, embed, timeframe)));
        break;
    }

    if (files.length > 0) {
      const chartFileName = {
        overview: "trend.png",
        members: "member_trend.png",
        activity: "activity_scores.png",
        channels: "channel_stats.png",
      }[view];

      embed.setImage(`attachment://${chartFileName}`);
    }

    return files;
  } catch (error) {
    console.error("Error generating files:", error);
    throw error;
  }
}
