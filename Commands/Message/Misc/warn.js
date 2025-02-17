import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import warndb from "../../../schema/warndb.js";

export default {
  name: "warn",
  description: "Warn a user with a specified reason.",
  cooldown: 3,
  userPermissions: [PermissionFlagsBits.KickMembers],
  botPermissions: [],
  category: "Moderation",

  run: async ({ client, message, args, prefix }) => {
    try {
      const moderator = message.author.id;
      // Determine target user using a mention or ID
      const targetMember =
        message.mentions.members.first() ||
        message.guild.members.cache.get(args[0]);
      if (!targetMember) {
        return message.channel.send({
          content: "Provide a valid user to warn.",
        });
      }
      if (targetMember.id === moderator) {
        return message.channel.send({
          content: "You cannot warn yourself.",
        });
      }
      const reason = args.slice(1).join(" ");
      if (!reason) {
        return message.channel.send({
          content: "Provide a reason~",
        });
      }

      // Retrieve and update warning data from the database
      let data = await warndb
        .findOne({
          guild: message.guild.id,
          user: targetMember.id,
        })
        .exec();

      const warningObject = {
        moderator: moderator,
        reason: reason,
        time: Math.floor(Date.now() / 1000),
        id: Math.floor(Math.random() * Date.now()).toString(36),
      };

      if (!data) {
        data = new warndb({
          guild: message.guild.id,
          user: targetMember.id,
          content: [warningObject],
        });
      } else {
        data.content.push(warningObject);
      }
      await data.save();

      const embed = new EmbedBuilder()
        .setColor("DarkRed")
        .setTitle("Warning")
        .setDescription(
          `Warned <@${targetMember.id}>\n**Reason:** ${reason}\n**Moderator:** ${message.author}\n**Current Warnings:** \`${data.content.length}\``
        )
        .setFooter({
          text: message.author.username,
          iconURL: message.author.displayAvatarURL({ dynamic: true }),
        })
        .setTimestamp();

      await message.channel.send({ embeds: [embed] });

      // Attempt to DM the warned user; log error if DM fails
      try {
        await targetMember.user.send(`You have been warned: **${reason}**`);
      } catch (err) {
        console.error("Failed to send DM to warned user:", err);
      }
    } catch (error) {
      console.error("Error in warn command:", error);
      return message.channel.send({
        content:
          "An error occurred while processing the warning. Please try again later.",
      });
    }
  },
};
