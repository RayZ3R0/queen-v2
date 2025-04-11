import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "inventory",
  category: "Spirits",
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("Check your inventory."),

  run: async ({ client, interaction }) => {
    try {
      await interaction.deferReply();

      const profileData = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      if (!profileData?.items?.length) {
        return interaction.editReply({ content: "You do not have any items." });
      }

      const itemLines = profileData.items.map(
        (item, index) => `**${index + 1}.** ${item.name} \`x${item.count}\``
      );

      const embed = new EmbedBuilder()
        .setColor("Red")
        .setAuthor({
          name: interaction.user.username,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
        })
        .setDescription(itemLines.join("\n"))
        .setFooter({
          text: "Use /use to use an item from your inventory",
        });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Inventory command error:", error);
      await interaction.editReply({
        content: "An error occurred while fetching your inventory.",
      });
      return false;
    }
  },
};
