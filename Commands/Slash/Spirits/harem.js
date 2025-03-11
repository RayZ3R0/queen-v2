import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import spiritSchema from "../../../schema/spirits.js";

export default {
  name: "harem",
  category: "Spirits",
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName("harem")
    .setDescription("Check your or someone else's spirits.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to check spirits for")
        .setRequired(false)
    ),

  run: async ({ client, interaction }) => {
    try {
      await interaction.deferReply();

      // Get target user or default to the command user
      const targetUser =
        interaction.options.getUser("user") || interaction.user;
      const targetMember = await interaction.guild.members.fetch(targetUser.id);

      // Retrieve spirit records from the database
      const spiritsData = await spiritSchema.find({ husband: targetUser.id });

      if (!spiritsData || spiritsData.length === 0) {
        return interaction.editReply({
          content:
            targetUser.id === interaction.user.id
              ? "You do not have any spirits. Use the /summon command to summon one."
              : `${targetUser.username} does not have any spirits.`,
        });
      }

      // Sort spirits descending by stars
      const sortedSpirits = spiritsData.sort((a, b) => b.stars - a.stars);

      // Map each spirit to a formatted string
      const spiritList = sortedSpirits.map(
        (spirit) =>
          `**${spirit.name} 【${"<a:starSpin:1006138461234937887>".repeat(
            spirit.stars
          )}】** | **ID:** \`${spirit.id}\``
      );

      // Build the embed with spirit information
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

      // Send the embed after a short delay to mimic the original command's behavior
      setTimeout(async () => {
        await interaction.editReply({ embeds: [embed] });
      }, 2000);

      return true;
    } catch (error) {
      console.error("Harem command error:", error);
      await interaction.editReply({
        content: "An error occurred while retrieving spirit information.",
      });
      return false;
    }
  },
};
