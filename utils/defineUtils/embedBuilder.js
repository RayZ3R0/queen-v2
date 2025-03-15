import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { formatContent, formatDate } from "./urbanApi.js";

/**
 * Creates an embed for displaying an Urban Dictionary definition
 * @param {Object} definition - The definition object
 * @param {number} currentPage - Current page number
 * @param {number} totalPages - Total number of pages
 * @param {boolean} hasMore - Whether there are more definitions available
 * @returns {Object} Embed and action row builders
 */
export const createDefinitionEmbed = (
  definition,
  currentPage,
  totalPages,
  hasMore = false
) => {
  const embed = new EmbedBuilder()
    .setTitle(`📚 ${definition.word}`)
    .setColor("#1D2439")
    .setDescription(formatContent(definition.definition))
    .addFields([
      {
        name: "📝 Example",
        value: formatContent(definition.example) || "No example provided",
      },
      {
        name: "📊 Stats",
        value: `👍 ${definition.thumbs_up.toLocaleString()} | 👎 ${definition.thumbs_down.toLocaleString()}`,
        inline: true,
      },
      {
        name: "📅 Submitted",
        value: formatDate(definition.written_on),
        inline: true,
      },
    ])
    .setFooter({
      text: `Definition ${currentPage + 1}/${totalPages}${
        hasMore ? " • More available" : ""
      }`,
    });

  // Create navigation buttons
  const prevButton = new ButtonBuilder()
    .setCustomId("prev")
    .setLabel("Previous")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage === 0);

  const nextButton = new ButtonBuilder()
    .setCustomId("next")
    .setLabel("Next")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage === totalPages - 1 && !hasMore);

  const loadMoreButton = new ButtonBuilder()
    .setCustomId("more")
    .setLabel("Load More")
    .setStyle(ButtonStyle.Primary)
    .setDisabled(!hasMore);

  const shareButton = new ButtonBuilder()
    .setCustomId("share")
    .setLabel("Share")
    .setStyle(ButtonStyle.Success)
    .setEmoji("🔗");

  // Create action row with buttons
  const actionRow = new ActionRowBuilder().addComponents(
    prevButton,
    nextButton,
    loadMoreButton,
    shareButton
  );

  return { embed, actionRow };
};

/**
 * Creates an embed for error messages
 * @param {string} message - The error message
 * @returns {EmbedBuilder} Error embed
 */
export const createErrorEmbed = (message) => {
  return new EmbedBuilder()
    .setTitle("❌ Error")
    .setColor("#FF0000")
    .setDescription(message);
};

/**
 * Creates an embed for no results found
 * @param {string} term - The searched term
 * @returns {EmbedBuilder} No results embed
 */
export const createNoResultsEmbed = (term) => {
  return new EmbedBuilder()
    .setTitle("🔍 No Results Found")
    .setColor("#FFA500")
    .setDescription(
      `No definitions found for "${term}"\n\nTry:\n• Checking your spelling\n• Using different keywords\n• Being less specific`
    )
    .setFooter({
      text: "Tip: Use the autocomplete suggestions for better results!",
    });
};

/**
 * Creates a share message embed
 * @param {Object} definition - The definition object
 * @returns {EmbedBuilder} Share embed
 */
export const createShareEmbed = (definition) => {
  return new EmbedBuilder()
    .setTitle(`📖 Urban Dictionary: ${definition.word}`)
    .setColor("#1D2439")
    .setDescription(formatContent(definition.definition))
    .setURL(definition.permalink)
    .setFooter({
      text: "🔍 Look up more definitions with /define",
    });
};
