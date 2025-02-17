import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import warndb from "../../../schema/warndb.js";

export default {
  name: "warns",
  aliases: ["warning", "warnings"],
  description: "Check the warnings of a user.",
  cooldown: 3,
  userPermissions: [PermissionFlagsBits.KickMembers],
  botPermissions: [PermissionFlagsBits.EmbedLinks],
  category: "Moderation",

  run: async ({ message, args }) => {
    try {
      // Check if the member has permission to check warnings
      if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
        const noPermEmbed = new EmbedBuilder()
          .setColor("Red")
          .setDescription("You don't have the permissions to check warns.");
        return message.channel.send({ embeds: [noPermEmbed] });
      }

      // Determine target user (mention, ID, or self)
      const user =
        message.mentions.members.first() ||
        message.guild.members.cache.get(args[0]) ||
        message.member;

      // Find the warnings for the user in this guild
      const data = await warndb
        .findOne({
          guild: message.guild.id,
          user: user.id,
        })
        .exec();

      if (data) {
        // Map the warnings into a formatted string for the embed
        const warningsList = data.content
          .map((w, i) => {
            const modMember = message.guild.members.cache.get(w.moderator);
            const modTag = modMember ? modMember.user.tag : "Unknown Moderator";
            return `\n\`${i + 1}\` - **Moderator:** ${modTag} | **Reason:** ${
              w.reason
            } | **ID:** ${w.id || "No ID."} | <t:${w.time}:R>`;
          })
          .join(" ");

        const embed = new EmbedBuilder()
          .setTitle("Warnings")
          .setColor("DarkRed")
          .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
          .setDescription(warningsList)
          .setFooter({ text: "Warnings" })
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      } else {
        const noWarnsEmbed = new EmbedBuilder()
          .setColor("Green")
          .setDescription("This user does not have any warns.");
        return message.channel.send({ embeds: [noWarnsEmbed] });
      }
    } catch (error) {
      console.error("Error in warns command:", error);
      return message.channel.send(
        "An error occurred while retrieving warnings. Please try again later."
      );
    }
  },
};
