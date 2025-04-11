import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getAffectionLevel } from "../../../utils/spirits/emotionSystem.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "profile",
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View your spirit profile")
    .addUserOption((option) =>
      option.setName("user").setDescription("User to view profile of")
    ),
  category: "Spirits",
  run: async ({ client, interaction }) => {
    try {
      const user = interaction.options.getUser("user") || interaction.user;
      const userProfile = await profileSchema.findOne({ userid: user.id });

      if (!userProfile) {
        return interaction.reply({
          content: "This user hasn't started their spirit journey yet!",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Spirit Profile`)
        .setColor(userProfile.color || "#ff0000");

      if (userProfile.image) {
        embed.setThumbnail(userProfile.image);
      }

      // Add selected spirit info
      if (userProfile.selected && userProfile.selected !== "None") {
        const affectionLevel = getAffectionLevel(userProfile.affinity || 0);
        embed.addFields(
          {
            name: "Selected Spirit",
            value: userProfile.selected,
            inline: true,
          },
          {
            name: "Affection Level",
            value: `${affectionLevel.title} (${
              userProfile.affinity || 0
            } points)`,
            inline: true,
          }
        );

        // Add date streak if exists
        if (userProfile.dateStreak > 0) {
          embed.addFields({
            name: "Dating Streak",
            value: `${userProfile.dateStreak} day${
              userProfile.dateStreak > 1 ? "s" : ""
            }`,
            inline: true,
          });
        }
      }

      // Add spirit collection info
      if (userProfile.spirits?.length > 0) {
        const totalSpirits = userProfile.spirits.length;
        const maxAffinity = userProfile.achievements?.maxAffinity || 0;

        embed.addFields(
          {
            name: "Spirit Collection",
            value: `${totalSpirits} Spirit${totalSpirits > 1 ? "s" : ""}`,
            inline: true,
          },
          {
            name: "Highest Affection",
            value: `${maxAffinity} points`,
            inline: true,
          }
        );

        // Add top 3 spirits by affinity
        const topSpirits = userProfile.spirits
          .sort((a, b) => b.affinity - a.affinity)
          .slice(0, 3);

        if (topSpirits.length > 0) {
          embed.addFields({
            name: "Most Bonded Spirits",
            value: topSpirits
              .map(
                (spirit, index) =>
                  `${index + 1}. ${spirit.name} (${spirit.affinity} affinity)`
              )
              .join("\n"),
          });
        }
      }

      // Add basic stats
      embed.addFields(
        {
          name: "Level",
          value: `${userProfile.level}`,
          inline: true,
        },
        {
          name: "Spirit Coins",
          value: `${userProfile.balance}`,
          inline: true,
        },
        {
          name: "Energy",
          value: `${userProfile.energy}/60`,
          inline: true,
        }
      );

      // Add total interactions if any exist
      const totalInteractions =
        (userProfile.totalDates || 0) +
        (userProfile.totalGifts || 0) +
        (userProfile.totalChats || 0);

      if (totalInteractions > 0) {
        embed.addFields({
          name: "Total Interactions",
          value: [
            userProfile.totalDates ? `${userProfile.totalDates} dates` : null,
            userProfile.totalGifts ? `${userProfile.totalGifts} gifts` : null,
            userProfile.totalChats ? `${userProfile.totalChats} chats` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        });
      }

      // Add achievements if any notable ones exist
      const achievements = [];
      if (userProfile.achievements?.perfectDates > 0) {
        achievements.push(
          `${userProfile.achievements.perfectDates} perfect dates`
        );
      }
      if (userProfile.achievements?.perfectGifts > 0) {
        achievements.push(
          `${userProfile.achievements.perfectGifts} perfect gifts`
        );
      }
      if (userProfile.achievements?.maxDateStreak > 1) {
        achievements.push(
          `Longest date streak: ${userProfile.achievements.maxDateStreak} days`
        );
      }

      if (achievements.length > 0) {
        embed.addFields({
          name: "Achievements",
          value: achievements.join("\n"),
        });
      }

      // Add bio if it exists and isn't the default
      if (userProfile.bio && userProfile.bio !== "None") {
        embed.setDescription(userProfile.bio);
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in profile command:", error);
      return interaction.reply({
        content: "An error occurred while fetching the profile.",
        ephemeral: true,
      });
    }
  },
};
