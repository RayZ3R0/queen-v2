import { SlashCommandBuilder } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { InviteUsageModel } from "../../../schema/inviteTracker.js";
import InviteManager from "../../../utils/inviteManager.js";

export default {
  name: "invites",
  category: "Utils",
  cooldown: 10, // 10 second cooldown
  data: new SlashCommandBuilder()
    .setName("invites")
    .setDescription("Check invite statistics for a user")
    .setDefaultMemberPermissions(null) // Everyone can use this command
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to check invites for (defaults to yourself)")
        .setRequired(false)
    ),

  run: async ({ interaction }) => {
    await interaction.deferReply();

    try {
      // Get target user
      const targetUser =
        interaction.options.getUser("user") || interaction.user;
      // Get the invite manager instance from the client
      const stats = await interaction.client.inviteManager.getInviterStats(
        interaction.guildId,
        targetUser.id
      );

      if (!stats) {
        return interaction.editReply({
          content: "Failed to fetch invite statistics.",
          ephemeral: true,
        });
      }

      // Get detailed invite information
      const recentInvites = await InviteUsageModel.find({
        guildId: interaction.guildId,
        inviterId: targetUser.id,
      })
        .sort({ joinedAt: -1 })
        .limit(10)
        .populate("invitedId", "tag");

      // Create embed
      const embed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle(`Invite Statistics for ${targetUser.tag}`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields({
          name: "📊 Statistics",
          value: [
            `Total Invites: ${stats.total}`,
            `Left Members: ${stats.left}`,
            `Fake Invites: ${stats.fake}`,
            `Bonus Invites: ${stats.bonus}`,
            `Currently Active: ${stats.active}`,
            `Real Invites: ${stats.real}`,
          ].join("\n"),
          inline: false,
        })
        .setFooter({
          text: `Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      // Add recent invites field if there are any
      if (recentInvites.length > 0) {
        const recentInvitesText = recentInvites
          .map((invite) => {
            const status = invite.leftAt ? "❌ Left" : "✅ Active";
            return `${status} | <@${invite.invitedId}> (${new Date(
              invite.joinedAt
            ).toLocaleDateString()})`;
          })
          .join("\n");

        embed.addFields({
          name: "🔍 Recent Invites",
          value: recentInvitesText,
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error executing invites command:", error);
      return interaction.editReply({
        content: "An error occurred while fetching invite statistics.",
        ephemeral: true,
      });
    }
  },
};
