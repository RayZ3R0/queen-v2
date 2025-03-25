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
  handleChannels,
  timeframes,
} from "../utils/statsViewHandlers.js";

client.on("interactionCreate", async (interaction) => {
  try {
    // Ignore interactions from bots
    if (interaction.user.bot) return;

    // Handle Modal Submissions
    if (interaction.type === InteractionType.ModalSubmit) {
      // Try to find command by customId
      let command = null;
      const customId = interaction.customId;

      // Check for specific modal patterns
      if (
        customId === "create_role_modal" ||
        customId.startsWith("edit_name_") ||
        customId.startsWith("edit_color_") ||
        customId.startsWith("edit_icon_")
      ) {
        command = client.scommands.get("customrole");
      } else {
        // Generic lookup by command name prefix
        command = client.scommands.find((cmd) =>
          customId.startsWith(`${cmd.name}_`)
        );
      }

      if (!command) {
        // Fallback to message command name if available
        command = client.scommands.get(
          interaction.message?.interaction?.commandName
        );
      }

      if (command?.modalHandler) {
        try {
          await command.modalHandler(interaction);
        } catch (error) {
          console.error(`Error in modal handler for ${command.name}:`, error);
          // Only reply if we haven't already
          if (!interaction.replied && !interaction.deferred) {
            await interaction
              .reply({
                content: "❌ An error occurred while processing your input.",
                ephemeral: true,
              })
              .catch(console.error);
          }
        }
        return;
      }
    }

    // Handle Button Interactions
    if (interaction.isButton()) {
      // Try to find command by customId
      let command = null;
      const customId = interaction.customId;

      // Check for specific button patterns
      if (
        customId.startsWith("edit_") ||
        customId.startsWith("confirm_") ||
        customId.startsWith("cancel_")
      ) {
        command = client.scommands.get("customrole");
      } else {
        // Generic lookup by command name prefix
        command = client.scommands.find((cmd) =>
          customId.startsWith(`${cmd.name}_`)
        );
      }

      if (!command) {
        // Fallback to message command name if available
        command = client.scommands.get(
          interaction.message?.interaction?.commandName
        );
      }

      if (command?.buttonHandler) {
        try {
          await command.buttonHandler(interaction);
        } catch (error) {
          console.error(`Error in button handler for ${command.name}:`, error);
          await interaction
            .reply({
              content:
                "❌ An error occurred while processing the button interaction.",
              ephemeral: true,
            })
            .catch(console.error);
        }
        return;
      }
    }

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
      await command.run({ client, interaction }).catch(handleCommandError);

      // Set cooldown after successful execution
      if (!command.noCooldownOnFail) {
        await setCooldown(interaction, command).catch(console.error);
      }
    }

    // Handle stats timeframe selection
    if (
      interaction.isStringSelectMenu() &&
      interaction.customId === "timeframe_select"
    ) {
      await handleTimeframeSelection(interaction).catch(async (error) => {
        console.error("Error handling timeframe selection:", error);
        try {
          await interaction.editReply({
            content: "An error occurred while updating the statistics.",
            ephemeral: true,
          });
        } catch (err) {
          console.error("Error sending error response:", err);
        }
      });
    }
  } catch (error) {
    console.error("An error occurred in interactionCreate event:", error);
    try {
      const errorMessage = {
        content:
          error.message?.includes("chart") ||
          error.message?.includes("panicked") ||
          error.message?.includes("None value") ||
          error.message?.includes("cannot read properties of null")
            ? "❌ Unable to generate statistics chart. Statistics will be available once more data is collected."
            : "❌ An unexpected error occurred. Please try again later.",
        ephemeral: true,
      };

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(errorMessage);
      } else {
        await interaction.editReply(errorMessage);
      }
    } catch (err) {
      console.error("Error sending error message:", err);
    }
  }
});

async function handleTimeframeSelection(interaction) {
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
      default:
        throw new Error(`Invalid view: ${currentView}`);
    }

    // Update timeframe menu's selected option
    const timeframeMenu = components[components.length - 1].components[0];
    timeframeMenu.options.forEach((option) => {
      option.default = option.value === timeframe;
    });

    // Send the updated reply
    await interaction.editReply({
      embeds: [embed],
      components,
      files,
    });
  } catch (error) {
    console.error("Error in handleTimeframeSelection:", error);
    await interaction
      .editReply({
        content: "An error occurred while updating the statistics.",
        ephemeral: true,
      })
      .catch(console.error);
  }
}
