import { PermissionFlagsBits } from "discord.js";
import warndb from "../../../schema/warndb.js";

export default {
  name: "clearwarns",
  aliases: ["clearwarn", "clearwarnings"],
  description: "Clear all warnings of a user.",
  cooldown: 3,
  userPermissions: [PermissionFlagsBits.KickMembers],
  botPermissions: [],
  category: "Moderation",

  run: async ({ client, message, args, prefix }) => {
    try {
      // Determine target user (mention, ID, or default to invoker)
      const targetMember =
        message.mentions.members.first() ||
        message.guild.members.cache.get(args[0]) ||
        message.member;
      if (!targetMember)
        return message.channel.send({
          content: "Provide a valid user to clear warns.",
        });

      // Find the warnings for the user in this guild
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

      await data.deleteOne();
      return message.channel.send({
        content: `Cleared all warnings for **${targetMember.user.tag}**.`,
      });
    } catch (error) {
      console.error("Error in clearwarns command:", error);
      return message.channel.send({
        content:
          "An error occurred while clearing warns. Please try again later.",
      });
    }
  },
};
