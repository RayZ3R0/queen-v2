import { InteractionType, EmbedBuilder } from "discord.js";
import { client } from "../bot.js";
import {
  validatePermissions,
  handleCommandError,
} from "../utils/permissionHandler.js";
import { getCooldown, setCooldown } from "../handlers/functions.js";
import {
  handleOverview,
  handleMembers,
  handleActivity,
  timeframes,
} from "../utils/statsViewHandlers.js";

client.on("interactionCreate", async (interaction) => {
  try {
    // Ignore interactions from bots
    if (interaction.user.bot) return;

    // Handle slash commands
    if (interaction.type === InteractionType.ApplicationCommand) {
      const command = client.scommands.get(interaction.commandName);
      if (!command?.data) {
        return interaction.reply({
          content: `\`${interaction.commandName}\` is not a valid command!`,
          ephemeral: true,
        });
      }

      // Validate permissions using enhanced system
      const validationResult = validatePermissions(interaction, command);
      if (!validationResult.hasPermission) {
        return interaction.reply({
          content: `❌ ${validationResult.error}`,
          ephemeral: true,
        });
      }

      // Check command cooldown
      const cd = await getCooldown(interaction, command);
      if (cd) {
        const totalSeconds = Math.floor(cd);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const timeParts = [];
        if (days) timeParts.push(`${days} day${days !== 1 ? "s" : ""}`);
        if (hours) timeParts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
        if (minutes)
          timeParts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
        if (seconds)
          timeParts.push(`${seconds} second${seconds !== 1 ? "s" : ""}`);
        const timeString = timeParts.join(" ");
        return interaction.reply({
          content: `You are currently on cooldown. Please wait for **${timeString}** before trying again.`,
          ephemeral: true,
        });
      }

      // Run the command with error handling
      try {
        await command.run({ client, interaction });

        // Set cooldown after successful execution
        if (!command.noCooldownOnFail) {
          await setCooldown(interaction, command);
        }
      } catch (error) {
        handleCommandError(interaction, error);
      }
    }

    // Handle stats timeframe selection
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "timeframe_select"
    ) {
      try {
        await interaction.deferUpdate();

        const timeframe = interaction.values[0];
        const message = interaction.message;
        const oldEmbed = message.embeds[0];
        const components = [...message.components];
        const files = [];

        // Get the current view from the embed title
        const titleParts = oldEmbed.title.split(" - ");
        const currentView = titleParts[1].toLowerCase();

        // Create new embed with updated title
        const embed = EmbedBuilder.from(oldEmbed).setTitle(
          `Server Statistics - ${
            currentView.charAt(0).toUpperCase() + currentView.slice(1)
          } - ${timeframes[timeframe].label}`
        );

        // Re-run the appropriate handler
        switch (currentView) {
          case "overview":
            files.push(
              ...(await handleOverview(interaction, embed, timeframe))
            );
            break;
          case "members":
            files.push(...(await handleMembers(interaction, embed, timeframe)));
            break;
          case "activity":
            files.push(
              ...(await handleActivity(interaction, embed, timeframe))
            );
            break;
        }

        // Update timeframe menu's selected option
        const timeframeMenu = components[components.length - 1].components[0];
        timeframeMenu.options.forEach((option) => {
          option.default = option.value === timeframe;
        });

        await interaction.editReply({
          embeds: [embed],
          components,
          files,
        });
      } catch (error) {
        console.error("Error handling timeframe selection:", error);
        await interaction
          .editReply({
            content: "An error occurred while updating the statistics.",
            ephemeral: true,
          })
          .catch(() => null);
      }
    }
  } catch (error) {
    // Handle any unexpected errors
    console.error("An error occurred in interactionCreate event:", error);
    try {
      let errorMessage = {
        content: "❌ An unexpected error occurred. Please try again later.",
        ephemeral: true,
      };

      // Special handling for canvas/chart generation errors
      if (
        error.message?.includes("panicked") ||
        error.message?.includes("None value") ||
        error.message?.includes("cannot read properties of null")
      ) {
        errorMessage.content =
          "❌ Unable to generate statistics chart. Statistics will be available once more data is collected.";
      }

      if (interaction.deferred) {
        await interaction.editReply(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    } catch (err) {
      console.error("Error sending error message:", err);
    }
  }
});
