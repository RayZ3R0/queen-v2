import {
  ApplicationCommandType,
  PermissionFlagsBits,
  ApplicationCommandOptionType,
} from "discord.js";
import warndb from "../../../schema/warndb.js";
import { checkRoleHierarchy } from "../../../utils/permissionHandler.js";

/**
 * @type {import("../../../index").Scommand}
 */
export default {
  name: "delwarn",
  description: "Delete a specific warning from a user",
  userPermissions: [PermissionFlagsBits.KickMembers],
  botPermissions: [PermissionFlagsBits.SendMessages],
  category: "Moderation",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "user",
      description: "The user whose warning to delete",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: "warnid",
      description: "The ID of the warning to delete",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],

  run: async ({ client, interaction }) => {
    await interaction.deferReply();

    try {
      const targetUser = interaction.options.getUser("user");
      const warnId = interaction.options.getString("warnid");

      // Get member object for hierarchy check
      const targetMember = await interaction.guild.members
        .fetch(targetUser.id)
        .catch(() => null);

      if (!targetMember) {
        throw {
          name: "ValidationError",
          message: "Could not find that user in this server.",
        };
      }

      // Check role hierarchy
      checkRoleHierarchy(interaction.member, targetMember, interaction);

      // Find warnings data
      const data = await warndb.findOne({
        guild: interaction.guild.id,
        user: targetUser.id,
      });

      if (!data || data.content.length === 0) {
        throw {
          name: "ValidationError",
          message: `${targetUser.tag} does not have any warnings.`,
        };
      }

      // Find the specific warning
      const warn = data.content.find((w) => w.id === warnId);
      if (!warn) {
        throw {
          name: "ValidationError",
          message: "Could not find a warning with that ID.",
        };
      }

      // Remove the warning from the array
      data.content = data.content.filter((w) => w.id !== warnId);

      // If no warnings left, delete the document
      if (data.content.length === 0) {
        await data.deleteOne();
      } else {
        // Update the document with the warning removed
        await warndb.findOneAndUpdate(
          { guild: interaction.guild.id, user: targetUser.id },
          { content: data.content }
        );
      }

      await interaction.editReply({
        content: `✅ Successfully deleted warning from ${targetUser.tag}\n**Reason of deleted warning:** ${warn.reason}`,
      });

      // Log the warning deletion
      const logChannel = interaction.guild.channels.cache.find(
        (channel) => channel.name === "mod-logs"
      );

      if (logChannel) {
        await logChannel.send({
          content: `**Warning Deleted**\n**User:** ${targetUser.tag} (${targetUser.id})\n**Moderator:** ${interaction.user.tag}\n**Deleted Warning Reason:** ${warn.reason}\n**Warning ID:** ${warnId}`,
        });
      }
    } catch (error) {
      if (error.name === "ValidationError" || error.name === "HierarchyError") {
        throw error;
      }
      console.error("Error in delwarn command:", error);
      throw {
        name: "DatabaseError",
        message: "An error occurred while deleting the warning.",
      };
    }
  },
};
