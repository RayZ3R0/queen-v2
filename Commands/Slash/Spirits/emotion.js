import { SlashCommandBuilder } from "discord.js";
import { createAffectionEmbed } from "../../../utils/spirits/emotionSystem.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "emotion",
  data: new SlashCommandBuilder()
    .setName("emotion")
    .setDescription("Check your spirit's emotional state and affection level"),
  category: "Spirits",
  cooldown: 10, // 10 seconds cooldown
  run: async ({ client, interaction }) => {
    try {
      const userProfile = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      if (!userProfile?.selected || userProfile.selected === "None") {
        return interaction.reply({
          content: "You need to select a spirit first using `/select`!",
          ephemeral: true,
        });
      }

      // Get the spirit's affection level
      const affinity = userProfile.affinity || 0;
      const spirit = userProfile.selected;

      // Create and send the emotion embed
      const embed = createAffectionEmbed(spirit, affinity);

      // Add spirit-specific details
      if (userProfile.dateStreak > 0) {
        embed.addFields({
          name: "Dating Streak",
          value: `${userProfile.dateStreak} day${
            userProfile.dateStreak > 1 ? "s" : ""
          }`,
          inline: true,
        });
      }

      // Add total interactions if any
      if (
        userProfile.totalDates ||
        userProfile.totalGifts ||
        userProfile.totalChats
      ) {
        const interactions = [];
        if (userProfile.totalDates)
          interactions.push(`${userProfile.totalDates} dates`);
        if (userProfile.totalGifts)
          interactions.push(`${userProfile.totalGifts} gifts`);
        if (userProfile.totalChats)
          interactions.push(`${userProfile.totalChats} chats`);

        if (interactions.length > 0) {
          embed.addFields({
            name: "Total Interactions",
            value: interactions.join("\n"),
            inline: true,
          });
        }
      }

      // Footer with tip
      embed.setFooter({
        text: "Tip: Use /bond to increase your affection level!",
      });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in emotion command:", error);
      return interaction.reply({
        content: "An error occurred while checking spirit emotions.",
        ephemeral: true,
      });
    }
  },
};
