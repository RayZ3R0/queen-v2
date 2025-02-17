import { PermissionFlagsBits } from "discord.js";
import warndb from "../../../schema/warndb.js";

export default {
  name: "delwarn",
  aliases: [
    "removewarning",
    "removewarn",
    "deletewarn",
    "deletewarning",
    "delwarning",
  ],
  description: "Delete a specific warning from a user.",
  cooldown: 3,
  userPermissions: [PermissionFlagsBits.KickMembers],
  botPermissions: [],
  category: "Moderation",

  run: async ({ client, message, args, prefix }) => {
    try {
      // Determine target user (mention or ID)
      const targetMember =
        message.mentions.members.first() ||
        message.guild.members.cache.get(args[0]);
      if (!targetMember)
        return message.channel.send({ content: "Mention a valid user." });

      if (!args[1])
        return message.channel.send({
          content: "Provide a valid warn id to delete.",
        });

      // Find the warnings data for the user in this guild
      const data = await warndb
        .findOne({
          guild: message.guild.id,
          user: targetMember.id,
        })
        .exec();

      if (!data)
        return message.channel.send({
          content: `No warnings found for **${targetMember.user.tag}**.`,
        });

      // Find the specific warning object by warn id (provided as second argument)
      const warn = data.content.find((c) => c.id === args[1]);
      if (!warn)
        return message.channel.send({
          content: "Provide a valid warn id to delete.",
        });

      // Remove the warning entry from the array
      data.content.splice(data.content.indexOf(warn), 1);

      // Update the database
      await warndb.findOneAndUpdate(
        { guild: message.guild.id, user: targetMember.id },
        { content: data.content },
        { new: true }
      );

      return message.channel.send({
        content: `Cleared the warning: **${warn.reason}**`,
      });
    } catch (error) {
      console.error("Error in delwarn command:", error);
      return message.channel.send({
        content:
          "An error occurred while deleting the warning. Please try again later.",
      });
    }
  },
};
