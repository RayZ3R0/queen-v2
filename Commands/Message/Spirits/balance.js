import { EmbedBuilder } from "discord.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "wallet",
  aliases: ["bal", "balance"],
  description: "Check your balance, or someone else's",
  usage: "[@user]",
  cooldown: 10,
  userPermissions: [],
  botPermissions: [],
  category: "Spirits",

  run: async ({ client, message, args, prefix }) => {
    // Determine the target user (mention, ID, or defaults to the message author)
    const targetUser =
      message.mentions.users.first() ||
      client.users.cache.get(args[0]) ||
      message.author;

    // Retrieve the user's profile data from the database
    const profileData = await profileSchema.findOne({ userid: targetUser.id });
    const balance = profileData ? profileData.balance : 0;

    // Construct the embed with balance information
    const embed = new EmbedBuilder()
      .setColor("Random")
      .setDescription(`**Spirit Coins:** \`${balance}\``)
      .setAuthor({
        name: `${targetUser.username}'s Balance`,
        iconURL: targetUser.displayAvatarURL({ dynamic: true }),
      })
      .setFooter({
        text: "Tip: You can boost the server for double daily reward~",
      });

    return message.reply({ embeds: [embed] });
  },
};
