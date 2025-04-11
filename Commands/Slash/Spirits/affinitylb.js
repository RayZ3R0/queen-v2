import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getAffectionLevel } from "../../../utils/spirits/emotionSystem.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "affinitylb",
  data: new SlashCommandBuilder()
    .setName("affinitylb")
    .setDescription("View the spirit affinity leaderboard")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Type of leaderboard to view")
        .setRequired(true)
        .addChoices(
          { name: "Overall Affinity", value: "overall" },
          { name: "Dating Streak", value: "streak" },
          { name: "Total Dates", value: "dates" },
          { name: "Perfect Gifts", value: "gifts" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("spirit")
        .setDescription("Show leaderboard for a specific spirit")
        .addChoices(
          { name: "Tohka Yatogami", value: "Tohka Yatogami" },
          { name: "Kurumi Tokisaki", value: "Kurumi Tokisaki" },
          { name: "Yoshino", value: "Yoshino" },
          { name: "Kotori Itsuka", value: "Kotori Itsuka" },
          { name: "Origami Tobiichi", value: "Origami Tobiichi" }
        )
    ),
  category: "Spirits",
  cooldown: 30,
  run: async ({ client, interaction }) => {
    try {
      const type = interaction.options.getString("type");
      const spirit = interaction.options.getString("spirit");
      let title, sortField, valueFormatter;

      // Configure leaderboard based on type
      switch (type) {
        case "overall":
          title = spirit
            ? `Top Affection - ${spirit}`
            : "Top Overall Spirit Affection";
          sortField = spirit ? "spirits.affinity" : "affinity";
          valueFormatter = (profile) => {
            const affinity = spirit
              ? profile.spirits.find((s) => s.name === spirit)?.affinity || 0
              : profile.affinity;
            const level = getAffectionLevel(affinity);
            return `${level.title} (${affinity} points)`;
          };
          break;

        case "streak":
          title = "Top Dating Streaks";
          sortField = "dateStreak";
          valueFormatter = (profile) =>
            `${profile.dateStreak} day${profile.dateStreak !== 1 ? "s" : ""}`;
          break;

        case "dates":
          title = "Most Total Dates";
          sortField = "totalDates";
          valueFormatter = (profile) =>
            `${profile.totalDates} date${profile.totalDates !== 1 ? "s" : ""}`;
          break;

        case "gifts":
          title = "Most Perfect Gifts";
          sortField = "achievements.perfectGifts";
          valueFormatter = (profile) =>
            `${profile.achievements?.perfectGifts || 0} perfect gift${
              profile.achievements?.perfectGifts !== 1 ? "s" : ""
            }`;
          break;
      }

      // Build query
      let query = {};
      if (spirit) {
        query = { "spirits.name": spirit };
      }

      // Get sorted profiles
      const profiles = await profileSchema
        .find(query)
        .sort({ [sortField]: -1 })
        .limit(10);

      if (profiles.length === 0) {
        return interaction.reply({
          content: "No data found for this leaderboard!",
          ephemeral: true,
        });
      }

      // Create leaderboard embed
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor("#ffd700")
        .setDescription(
          await Promise.all(
            profiles.map(async (profile, index) => {
              const user = await client.users.fetch(profile.userid);
              const value = valueFormatter(profile);
              const medal =
                index === 0
                  ? "🥇"
                  : index === 1
                  ? "🥈"
                  : index === 2
                  ? "🥉"
                  : "▪️";
              return `${medal} **${index + 1}.** ${user.username} - ${value}`;
            })
          ).then((lines) => lines.join("\n"))
        )
        .setFooter({
          text: `Updated ${new Date().toLocaleString()}`,
        });

      // Add user's rank if not in top 10
      const userId = interaction.user.id;
      if (!profiles.some((p) => p.userid === userId)) {
        let userRank;
        if (spirit) {
          userRank = await profileSchema.countDocuments({
            "spirits.name": spirit,
            "spirits.affinity": {
              $gt:
                profiles
                  .find((p) => p.spirits.find((s) => s.name === spirit))
                  ?.spirits.find((s) => s.name === spirit)?.affinity || 0,
            },
          });
        } else {
          userRank = await profileSchema.countDocuments({
            [sortField]: { $gt: profiles[profiles.length - 1][sortField] },
          });
        }

        const userProfile = await profileSchema.findOne({ userid: userId });
        if (userProfile) {
          embed.addFields({
            name: "Your Ranking",
            value: `#${userRank + 1} - ${valueFormatter(userProfile)}`,
          });
        }
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in affinitylb command:", error);
      return interaction.reply({
        content: "An error occurred while fetching the leaderboard.",
        ephemeral: true,
      });
    }
  },
};
