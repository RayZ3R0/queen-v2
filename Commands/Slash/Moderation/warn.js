import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import warndb from "../../../schema/warndb.js";
import { checkRoleHierarchy } from "../../../utils/permissionHandler.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user for breaking rules")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to warn")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("The reason for the warning")
        .setRequired(true)
    ),
  category: "Moderation",
  botPermissions: [PermissionFlagsBits.SendMessages],

  run: async ({ client, interaction }) => {
    await interaction.deferReply({ ephemeral: true });

    try {
      const targetMember = interaction.options.getMember("user");
      const reason = interaction.options.getString("reason");

      // Check if target is valid
      if (!targetMember) {
        throw {
          name: "ValidationError",
          message: "Please provide a valid user to warn.",
        };
      }

      // Validate role hierarchy
      checkRoleHierarchy(interaction.member, targetMember, interaction);

      // Create warning object
      const warningObject = {
        moderator: interaction.user.id,
        reason: reason,
        time: Math.floor(Date.now() / 1000),
        id: Math.floor(Math.random() * Date.now()).toString(36),
      };

      // Find or create warning data
      let data = await warndb.findOne({
        guild: interaction.guild.id,
        user: targetMember.id,
      });

      if (!data) {
        data = new warndb({
          guild: interaction.guild.id,
          user: targetMember.id,
          content: [warningObject],
        });
      } else {
        data.content.push(warningObject);
      }

      await data.save();

      // Send success message to moderator
      await interaction.editReply({
        content: `✅ Successfully warned ${targetMember.user.tag}\n**Reason:** ${reason}\n**Total Warnings:** ${data.content.length}`,
        ephemeral: true,
      });

      // Try to DM the warned user
      try {
        await targetMember.send(
          `You have been warned in ${interaction.guild.name}\n**Reason:** ${reason}`
        );
      } catch (err) {
        await interaction.followUp({
          content:
            "⚠️ Could not send DM to the user, but the warning was recorded.",
          ephemeral: true,
        });
      }

      // Log the warning in the guild (if log channel exists)
      const logChannel = interaction.guild.channels.cache.find(
        (channel) => channel.name === "mod-logs"
      );

      if (logChannel) {
        await logChannel.send({
          content: `**Warning**\n**User:** ${targetMember.user.tag} (${targetMember.id})\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}\n**Total Warnings:** ${data.content.length}`,
        });
      }
    } catch (error) {
      if (error.name === "ValidationError" || error.name === "HierarchyError") {
        throw error;
      }
      console.error("Error in warn command:", error);
      throw {
        name: "DatabaseError",
        message: "An error occurred while saving the warning.",
      };
    }
  },
};
