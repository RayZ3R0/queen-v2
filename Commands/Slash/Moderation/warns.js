import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import warndb from "../../../schema/warndb.js";

export default {
  data: new SlashCommandBuilder()
    .setName("warns")
    .setDescription("Check the warnings of a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to check warnings for (defaults to yourself)")
        .setRequired(false)
    ),
  category: "Moderation",
  botPermissions: [
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
  ],

  run: async ({ client, interaction }) => {
    await interaction.deferReply();

    try {
      // Get target user or default to command user
      const targetUser =
        interaction.options.getUser("user") || interaction.user;
      const targetMember = await interaction.guild.members
        .fetch(targetUser.id)
        .catch(() => null);

      if (!targetMember) {
        throw {
          name: "ValidationError",
          message: "Could not find that user in this server.",
        };
      }

      // Find warnings in database
      const data = await warndb.findOne({
        guild: interaction.guild.id,
        user: targetUser.id,
      });

      if (!data || data.content.length === 0) {
        const noWarnsEmbed = new EmbedBuilder()
          .setColor("Green")
          .setDescription(`${targetUser.tag} does not have any warnings.`)
          .setThumbnail(
            targetUser.displayAvatarURL({ dynamic: true, size: 512 })
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [noWarnsEmbed] });
      }

      // Format warnings list
      const warningsList = data.content
        .map((w, i) => {
          const modUser = client.users.cache.get(w.moderator);
          const modTag = modUser ? modUser.tag : "Unknown Moderator";
          return `\n\`${i + 1}\` - **Moderator:** ${modTag}\n**Reason:** ${
            w.reason
          }\n**ID:** ${w.id || "No ID"}\n**Time:** <t:${w.time}:R>`;
        })
        .join("\n");

      // Create and send embed
      const embed = new EmbedBuilder()
        .setTitle(`Warnings for ${targetUser.tag}`)
        .setColor("DarkRed")
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
        .setDescription(warningsList)
        .setFooter({
          text: `Total Warnings: ${data.content.length}`,
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      if (error.name === "ValidationError") {
        throw error;
      }
      console.error("Error in warns command:", error);
      throw {
        name: "DatabaseError",
        message: "An error occurred while fetching the warnings.",
      };
    }
  },
};
