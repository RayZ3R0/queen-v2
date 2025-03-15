import { SlashCommandBuilder, ComponentType } from "discord.js";
import {
  searchTerm,
  getAutoComplete,
  isContentSafe,
} from "../../../utils/defineUtils/urbanApi.js";
import { definitionCache } from "../../../utils/defineUtils/cache.js";
import {
  createDefinitionEmbed,
  createErrorEmbed,
  createNoResultsEmbed,
} from "../../../utils/defineUtils/embedBuilder.js";

export default {
  name: "define",
  category: "Utils",
  cooldown: 30, // 30 second cooldown

  data: new SlashCommandBuilder()
    .setName("define")
    .setDescription("Look up a term on Urban Dictionary")
    .addStringOption((option) =>
      option
        .setName("term")
        .setDescription("The term to search for")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addBooleanOption((option) =>
      option
        .setName("filter")
        .setDescription("Enable content filtering")
        .setRequired(false)
    ),

  // Handle autocomplete interactions
  async autocompleteRun({ interaction }) {
    const focusedValue = interaction.options.getFocused();
    if (!focusedValue || focusedValue.length < 2) {
      return interaction.respond([]);
    }

    try {
      const suggestions = await getAutoComplete(focusedValue);
      await interaction.respond(
        suggestions.map((term) => ({ name: term, value: term }))
      );
    } catch (error) {
      console.error("Autocomplete error:", error);
      await interaction.respond([]);
    }
  },

  async run({ interaction }) {
    await interaction.deferReply();

    try {
      const term = interaction.options.getString("term");
      const shouldFilter = interaction.options.getBoolean("filter") ?? true;
      let currentPage = 0;
      let definitions = definitionCache.get(term);

      // Fetch definitions if not cached
      if (!definitions) {
        definitions = await searchTerm(term);

        // Sort definitions by vote score (thumbs_up - thumbs_down)
        definitions.sort((a, b) => {
          const scoreA = a.thumbs_up - a.thumbs_down;
          const scoreB = b.thumbs_up - b.thumbs_down;
          return scoreB - scoreA; // Descending order
        });

        if (definitions.length > 0) {
          definitionCache.set(term, definitions);
        }
      }

      // Filter definitions if needed
      if (shouldFilter) {
        definitions = definitions.filter(isContentSafe);
      }

      if (!definitions.length) {
        return interaction.editReply({
          embeds: [createNoResultsEmbed(term)],
        });
      }

      const updateEmbed = async () => {
        const { embed, actionRow } = createDefinitionEmbed(
          definitions[currentPage],
          currentPage,
          definitions.length
        );

        return interaction.editReply({
          embeds: [embed],
          components: [actionRow],
        });
      };

      await updateEmbed();

      // Create button collector
      const collector = interaction.channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000, // 2 minutes
        filter: (i) => i.user.id === interaction.user.id,
      });

      collector.on("collect", async (i) => {
        await i.deferUpdate();

        switch (i.customId) {
          case "prev":
            if (currentPage > 0) {
              currentPage--;
              await updateEmbed();
            }
            break;

          case "next":
            if (currentPage < definitions.length - 1) {
              currentPage++;
              await updateEmbed();
            }
            break;

          case "delete":
            // Delete the reply if the user has permission
            if (i.message.deletable) {
              await i.message.delete();
            }
            break;
        }
      });

      collector.on("end", () => {
        // Don't update if message was deleted
        if (!interaction.replied) return;

        // Disable all buttons when collector expires
        const { embed, actionRow } = createDefinitionEmbed(
          definitions[currentPage],
          currentPage,
          definitions.length
        );
        actionRow.components.forEach((button) => button.setDisabled(true));

        interaction
          .editReply({
            embeds: [embed],
            components: [actionRow],
          })
          .catch(console.error);
      });
    } catch (error) {
      console.error("Error in define command:", error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed(
            "Failed to fetch definition. Please try again later."
          ),
        ],
        components: [],
      });
    }
  },
};
