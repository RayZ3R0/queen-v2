import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { ACHIEVEMENTS } from "../../../utils/spirits/achievementManager.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "achievements",
  data: new SlashCommandBuilder()
    .setName("achievements")
    .setDescription("View your spirit achievements")
    .addStringOption((option) =>
      option
        .setName("category")
        .setDescription("Achievement category to view")
        .setRequired(false)
        .addChoices(
          { name: "Bonding", value: "bonding" },
          { name: "Affection", value: "affection" },
          { name: "Spacequake", value: "spacequake" },
          { name: "Quests", value: "quests" },
          { name: "Collection", value: "collection" }
        )
    ),
  category: "Spirits",
  cooldown: 5,
  run: async ({ client, interaction }) => {
    try {
      const category = interaction.options.getString("category");
      const profile = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      if (!profile?.started) {
        return interaction.reply({
          content:
            "You need to start your spirit journey first using `/start`!",
          ephemeral: true,
        });
      }

      if (!category) {
        // Show achievement overview
        const embed = new EmbedBuilder()
          .setTitle("🏆 Spirit Achievements")
          .setDescription(
            "Complete achievements to earn rewards and show your dedication!"
          )
          .setColor("#ffd700");

        // Calculate completion stats for each category
        Object.entries(ACHIEVEMENTS).forEach(([categoryName, achievements]) => {
          const totalAchievements = Object.keys(achievements).length;
          const completedAchievements = Object.values(achievements).filter(
            (achievement) => profile.achievements?.[achievement.id]
          ).length;

          embed.addFields({
            name: `${getCategoryEmoji(categoryName)} ${capitalizeFirst(
              categoryName
            )}`,
            value: `${completedAchievements}/${totalAchievements} completed\nUse \`/achievements ${categoryName}\` to view details`,
            inline: true,
          });
        });

        // Calculate total completion percentage
        const totalAchievements = Object.values(ACHIEVEMENTS).reduce(
          (acc, category) => acc + Object.keys(category).length,
          0
        );
        const totalCompleted = Object.values(ACHIEVEMENTS).reduce(
          (acc, category) =>
            acc +
            Object.values(category).filter(
              (achievement) => profile.achievements?.[achievement.id]
            ).length,
          0
        );

        embed.setFooter({
          text: `Total Completion: ${Math.floor(
            (totalCompleted / totalAchievements) * 100
          )}%`,
        });

        return interaction.reply({ embeds: [embed] });
      }

      // Show category-specific achievements
      const categoryAchievements = ACHIEVEMENTS[category];
      if (!categoryAchievements) {
        return interaction.reply({
          content: "Invalid achievement category!",
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(
          `${getCategoryEmoji(category)} ${capitalizeFirst(
            category
          )} Achievements`
        )
        .setColor("#ffd700");

      // Add each achievement's status and rewards
      Object.values(categoryAchievements).forEach((achievement) => {
        const completed = profile.achievements?.[achievement.id];
        const status = completed ? "✅ Completed" : "❌ Incomplete";

        // Format rewards
        const rewards = Object.entries(achievement.reward)
          .map(([type, amount]) => {
            switch (type) {
              case "coins":
                return `${amount} Spirit Coins`;
              case "affinity":
                return `${amount} Affinity`;
              case "energy":
                return `${amount} Energy`;
              case "seasonXP":
                return `${amount} Season XP`;
              case "title":
                return `Title: ${amount}`;
              default:
                return `${amount} ${type}`;
            }
          })
          .join(", ");

        embed.addFields({
          name: `${achievement.title}`,
          value: `${status}\n${achievement.description}\nRewards: ${rewards}`,
        });
      });

      // Add completion stats
      const totalInCategory = Object.keys(categoryAchievements).length;
      const completedInCategory = Object.values(categoryAchievements).filter(
        (achievement) => profile.achievements?.[achievement.id]
      ).length;

      embed.setFooter({
        text: `Category Completion: ${completedInCategory}/${totalInCategory}`,
      });

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in achievements command:", error);
      return interaction.reply({
        content: "An error occurred while fetching achievements.",
        ephemeral: true,
      });
    }
  },
};

// Helper functions
const getCategoryEmoji = (category) => {
  switch (category) {
    case "bonding":
      return "💝";
    case "affection":
      return "❤️";
    case "spacequake":
      return "⚡";
    case "quests":
      return "📜";
    case "collection":
      return "✨";
    default:
      return "🏆";
  }
};

const capitalizeFirst = (str) =>
  str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
