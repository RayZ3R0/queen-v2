import { InteractionType } from "discord.js";
import { client } from "../bot.js";
import {
  validatePermissions,
  handleCommandError,
} from "../utils/permissionHandler.js";
import { getCooldown, setCooldown } from "../handlers/functions.js";

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
