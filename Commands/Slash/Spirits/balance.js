import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "balance",
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your balance or someone else's")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to check balance for")
        .setRequired(false)
    ),

  category: "Spirits",

  run: async ({ client, interaction }) => {
    try {
      await interaction.deferReply();

      // Get target user or default to command user
      const targetUser =
        interaction.options.getUser("user") || interaction.user;

      // Retrieve the user's profile data from the database
      const profileData = await profileSchema.findOne({
        userid: targetUser.id,
      });
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

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Balance command error:", error);
      return interaction.editReply({
        content: "An error occurred. Please try again later.",
      });
    }
  },
};
