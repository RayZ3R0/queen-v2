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
 * @returns {Object} Embed and action row builders
 */
export const createDefinitionEmbed = (definition, currentPage, totalPages) => {
  const embed = new EmbedBuilder()
    .setTitle(`📚 ${definition.word}`)
    .setURL(definition.permalink)
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
      text: `Definition ${currentPage + 1}/${totalPages}`,
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
    .setDisabled(currentPage === totalPages - 1);

  const deleteButton = new ButtonBuilder()
    .setCustomId("delete")
    .setLabel("Delete")
    .setStyle(ButtonStyle.Danger)
    .setEmoji("🗑️");

  // Create action row with buttons
  const actionRow = new ActionRowBuilder().addComponents(
    prevButton,
    nextButton,
    deleteButton
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
