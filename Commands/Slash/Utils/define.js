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
  createShareEmbed,
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
  async autocomplete({ interaction }) {
    const focusedValue = interaction.options.getFocused();
    if (!focusedValue) return interaction.respond([]);

    const suggestions = await getAutoComplete(focusedValue);
    await interaction.respond(
      suggestions.map((term) => ({ name: term, value: term }))
    );
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

      // Initial batch of definitions (10)
      let currentBatch = definitions.slice(0, 10);
      const hasMore = definitions.length > 10;

      const updateEmbed = async () => {
        const { embed, actionRow } = createDefinitionEmbed(
          currentBatch[currentPage],
          currentPage,
          currentBatch.length,
          hasMore && currentPage === currentBatch.length - 1
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
            if (currentPage < currentBatch.length - 1) {
              currentPage++;
              await updateEmbed();
            }
            break;

          case "more":
            // Load next batch of definitions
            const nextBatchStart = currentBatch.length;
            const nextBatch = definitions.slice(
              nextBatchStart,
              nextBatchStart + 10
            );

            if (nextBatch.length) {
              currentBatch = [...currentBatch, ...nextBatch];
              currentPage = nextBatchStart;
              await updateEmbed();
            }
            break;

          case "share":
            // Create a new message with a shareable embed
            const shareEmbed = createShareEmbed(currentBatch[currentPage]);
            await i.channel.send({ embeds: [shareEmbed] });
            break;
        }
      });

      collector.on("end", () => {
        // Disable all buttons when collector expires
        const { embed, actionRow } = createDefinitionEmbed(
          currentBatch[currentPage],
          currentPage,
          currentBatch.length,
          false
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
