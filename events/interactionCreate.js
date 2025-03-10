import { InteractionType } from "discord.js";
import { client } from "../bot.js";
import {
  validatePermissions,
  handleCommandError,
} from "../utils/permissionHandler.js";

/**
 * Handles interaction events, such as slash commands.
 * @param {Interaction} interaction - The interaction received from Discord.
 */
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

      // Run the command with error handling
      await command.run({ client, interaction }).catch((error) => {
        handleCommandError(interaction, error);
      });
    }
  } catch (error) {
    // Handle any unexpected errors
    console.error("An error occurred in interactionCreate event:", error);
    try {
      const errorMessage = {
        content: "❌ An unexpected error occurred. Please try again later.",
        ephemeral: true,
      };

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
