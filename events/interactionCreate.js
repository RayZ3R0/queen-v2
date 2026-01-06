import { InteractionType, EmbedBuilder } from "discord.js";
import { client } from "../bot.js";
import {
  validatePermissions,
  handleCommandError,
} from "../utils/permissionHandler.js";
import { getCooldown, setCooldown } from "../handlers/functions.js";


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

      // Check if user is an owner to skip cooldown
      const isOwner = client.config.Owners.includes(interaction.user.id);

      // Check command cooldown only for non-owners
      if (!isOwner) {
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
      }

      // Run the command with error handling
      await command.run({ client, interaction }).catch(handleCommandError);

      // Set cooldown after successful execution only for non-owners
      if (!isOwner && !command.noCooldownOnFail) {
        if (command.cooldown) {
          // Apply the command's defined cooldown
          await setCooldown(interaction, command).catch(console.error);
        } else {
          // Apply a default 5-second cooldown for commands without a defined cooldown
          await setCooldown(interaction, { ...command, cooldown: 5 }).catch(
            console.error
          );
        }
      }
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


