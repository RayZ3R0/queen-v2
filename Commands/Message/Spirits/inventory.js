import { EmbedBuilder } from "discord.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "inventory",
  aliases: ["inv"],
  description: "Check your inventory.",
  usage: "",
  cooldown: 10,
  userPermissions: [],
  botPermissions: [],
  category: "Spirits",

  run: async ({ client, message, args, prefix }) => {
    const profileData = await profileSchema.findOne({
      userid: message.author.id,
    });
    if (!profileData) {
      return message.reply({ content: "You do not have any items." });
    }

    const items = profileData.items;
    if (!items || items.length === 0) {
      return message.reply({ content: "You do not have any items." });
    }

    const itemLines = items.map(
      (item, index) => `**${index + 1}.** ${item.name} \`x${item.count}\``
    );

    const embed = new EmbedBuilder()
      .setColor("Red")
      .setAuthor({
        name: message.author.username,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .setDescription(itemLines.join("\n"));

    return message.reply({ embeds: [embed] });
  },
};
