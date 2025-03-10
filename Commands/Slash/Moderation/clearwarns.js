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
  name: "clearwarns",
  description: "Clear all warnings of a user",
  userPermissions: [PermissionFlagsBits.KickMembers],
  botPermissions: [PermissionFlagsBits.SendMessages],
  category: "Moderation",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "user",
      description: "The user whose warnings to clear",
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: "reason",
      description: "Reason for clearing warnings",
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],

  run: async ({ client, interaction }) => {
    await interaction.deferReply();

    try {
      const targetUser = interaction.options.getUser("user");
      const reason =
        interaction.options.getString("reason") || "No reason provided";

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
          message: `${targetUser.tag} does not have any warnings to clear.`,
        };
      }

      const warningCount = data.content.length;

      // Delete all warnings
      await data.deleteOne();

      await interaction.editReply({
        content: `✅ Successfully cleared all warnings (${warningCount}) from ${targetUser.tag}\n**Reason:** ${reason}`,
      });

      // Try to DM the user
      try {
        await targetUser.send(
          `Your warnings have been cleared in ${interaction.guild.name}\n**Reason:** ${reason}\n**Moderator:** ${interaction.user.tag}`
        );
      } catch (err) {
        await interaction.followUp({
          content:
            "⚠️ Could not send DM to the user, but warnings were cleared.",
          ephemeral: true,
        });
      }

      // Log the warning clearance
      const logChannel = interaction.guild.channels.cache.find(
        (channel) => channel.name === "mod-logs"
      );

      if (logChannel) {
        await logChannel.send({
          content: `**Warnings Cleared**\n**User:** ${targetUser.tag} (${targetUser.id})\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}\n**Warnings Cleared:** ${warningCount}`,
        });
      }
    } catch (error) {
      if (error.name === "ValidationError" || error.name === "HierarchyError") {
        throw error;
      }
      console.error("Error in clearwarns command:", error);
      throw {
        name: "DatabaseError",
        message: "An error occurred while clearing the warnings.",
      };
    }
  },
};
