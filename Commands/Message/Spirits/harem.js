import { EmbedBuilder } from "discord.js";
import spiritSchema from "../../../schema/spirits.js";

export default {
  name: "harem",
  aliases: ["ms", "myspirits"],
  description: "Check your or someone else's spirits.",
  usage: "[@user]",
  timeout: 10,
  userPermissions: [],
  botPermissions: [],
  category: "Spirits",

  run: async ({ client, message, args, prefix }) => {
    // Determine the target member: from mention, ID, or default to the message author.
    const targetMember =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]) ||
      message.member;

    // Retrieve spirit records from the database.
    // Note: The original code always queries using message.author.id as 'husband', so we maintain that.
    const spiritsData = await spiritSchema.find({ husband: message.author.id });

    if (!spiritsData || spiritsData.length === 0) {
      return message.reply({
        content:
          "You do not have any spirits. Use the summon command to summon one.",
      });
    }

    // Sort the spirits descending by stars.
    const sortedSpirits = spiritsData.sort((a, b) => b.stars - a.stars);

    // Map each spirit to a formatted string.
    const spiritList = sortedSpirits.map(
      (spirit) =>
        `**${spirit.name} 【${"<a:starSpin:1006138461234937887>".repeat(
          spirit.stars
        )}】** | **ID:** \`${spirit.id}\``
    );

    // Build the embed with spirit information.
    const embed = new EmbedBuilder()
      .setColor("Random")
      .setTitle(`${targetMember.user.username}'s Spirits`)
      .setDescription(`\n${spiritList.join("\n")}\n`)
      .setFooter({
        text: targetMember.user.tag,
        iconURL: targetMember.user.displayAvatarURL({ dynamic: true }),
      })
      .setImage(
        "https://c.tenor.com/-yGUfX6KZWUAAAAC/date-a-live-game-danmachi-collaboration.gif"
      );

    // Send the embed after a 2 second delay.
    setTimeout(async () => {
      message.reply({ embeds: [embed] });
    }, 2000);
  },
};
