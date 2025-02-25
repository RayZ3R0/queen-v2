import { PermissionsBitField } from "discord.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "addcoins",
  aliases: ["addc", "addcoin"],
  description: "Check your balance, or someone else's",
  usage: "[@user]",
  cooldown: 10,
  userPermissions: [],
  botPermissions: [],
  category: "Spirits",

  run: async ({ client, message, args, prefix }) => {
    if (
      !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
    )
      return message.channel.send({
        content: "You don't have perms to do this, die.",
      });

    const targetUser =
      message.mentions.users.first() ||
      client.users.cache.get(args[0]) ||
      message.author;

    const coinsToAdd = parseFloat(args[1]);
    if (isNaN(coinsToAdd)) {
      return message.channel.send({
        content: "Please provide a valid number of coins.",
      });
    }

    try {
      const userProfile = await profileSchema.findOne({
        userid: targetUser.id,
      });
      if (userProfile) {
        await profileSchema.findOneAndUpdate(
          { userid: targetUser.id },
          { balance: userProfile.balance + coinsToAdd },
          { new: true }
        );
      } else {
        const newProfile = new profileSchema({
          userid: targetUser.id,
          selected: "None",
          image: "https://c.tenor.com/E6P9PZdh7W0AAAAC/date-a-live-kurumi.gif",
          color: "#ff0000",
          bio: "None",
          level: 0,
          xp: 0,
          energy: 60,
          balance: coinsToAdd,
          items: [],
          started: false,
        });
        await newProfile.save();
      }

      return message.channel.send({
        content: `Added **${coinsToAdd}** Spirit Coins to **${targetUser.tag}**`,
      });
    } catch (error) {
      console.error("Error while updating wallet:", error);
      return message.channel.send({
        content: "An error occurred while processing the command.",
      });
    }
  },
};
