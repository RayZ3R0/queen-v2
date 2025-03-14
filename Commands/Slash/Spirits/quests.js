import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import {
  generateDailyQuests,
  createQuestEmbed,
  calculateQuestRewards,
} from "../../../utils/spirits/questManager.js";
import profileSchema from "../../../schema/profile.js";
import questSchema from "../../../schema/quests.js";

export default {
  name: "quests",
  data: new SlashCommandBuilder()
    .setName("quests")
    .setDescription("View and manage your daily spirit quests")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View your current daily quests")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("claim")
        .setDescription("Claim rewards from completed quests")
    ),
  category: "Spirits",
  cooldown: 5,
  run: async ({ client, interaction }) => {
    try {
      const subcommand = interaction.options.getSubcommand();

      // Defer the reply immediately
      await interaction.deferReply();

      // Find user profile
      const userProfile = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      if (!userProfile?.selected || userProfile.selected === "None") {
        return interaction.editReply({
          content: "You need to select a spirit first using `/select`!",
          ephemeral: true,
        });
      }

      // Find or create quest data
      let questData = await questSchema.findOne({
        userid: interaction.user.id,
      });

      // Handle quest reset or initialization
      if (!questData || questData.shouldResetQuests()) {
        const newQuests = generateDailyQuests(userProfile.selected);
        if (!questData) {
          questData = new questSchema({
            userid: interaction.user.id,
            quests: newQuests,
          });
          await questData.save();
        } else {
          questData = await questData.resetQuests(newQuests);
        }
      }

      switch (subcommand) {
        case "view": {
          const embed = createQuestEmbed(
            questData.quests,
            userProfile.selected
          );

          // Add streak info if exists
          if (questData.streak > 0) {
            embed.addFields({
              name: "Quest Streak",
              value: `${questData.streak} day${
                questData.streak !== 1 ? "s" : ""
              }\nBonus Multiplier: ${questData.getStreakBonus().toFixed(2)}x`,
            });
          }

          // Add completion status
          const completedQuests = questData.quests.filter(
            (q) => q.completed
          ).length;
          embed.addFields({
            name: "Daily Progress",
            value: `${completedQuests}/${questData.quests.length} quests completed`,
          });

          return interaction.editReply({ embeds: [embed] });
        }

        case "claim": {
          const completedQuests = questData.quests.filter(
            (q) => q.completed && !q.rewardsClaimed
          );

          if (completedQuests.length === 0) {
            return interaction.editReply({
              content: "You have no completed quests to claim rewards from!",
              ephemeral: true,
            });
          }

          const streakBonus = questData.getStreakBonus();
          let totalRewards = {
            coins: 0,
            affinity: 0,
            seasonXP: 0,
          };

          // Calculate rewards first
          for (const quest of completedQuests) {
            const rewards = calculateQuestRewards(quest);
            for (const [key, value] of Object.entries(rewards)) {
              totalRewards[key] += Math.floor(value * streakBonus);
            }
          }

          try {
            // Update user profile in one operation
            await profileSchema.findOneAndUpdate(
              { userid: interaction.user.id },
              {
                $inc: {
                  balance: totalRewards.coins,
                  affinity: totalRewards.affinity,
                },
              },
              { new: true }
            );

            // Mark quests as claimed
            for (const quest of completedQuests) {
              await questData.claimRewards(quest.id);
            }

            // Update quest completion status
            if (
              questData.quests.every((q) => q.completed && q.rewardsClaimed)
            ) {
              questData.questsCompleted = questData.quests.length;
              await questData.save();
            }

            // Create and send reward embed
            const rewardEmbed = new EmbedBuilder()
              .setTitle("Quest Rewards Claimed!")
              .setDescription(
                `You've claimed rewards for ${
                  completedQuests.length
                } completed quest${completedQuests.length !== 1 ? "s" : ""}!`
              )
              .addFields(
                {
                  name: "Rewards Earned",
                  value: `• ${totalRewards.coins} Spirit Coins\n• ${totalRewards.affinity} Affinity\n• ${totalRewards.seasonXP} Season XP`,
                },
                {
                  name: "Streak Bonus",
                  value: `${((streakBonus - 1) * 100).toFixed(
                    0
                  )}% bonus applied`,
                }
              )
              .setColor("#ffd700")
              .setFooter({
                text: "Complete all daily quests to maintain your streak!",
              });

            return interaction.editReply({ embeds: [rewardEmbed] });
          } catch (error) {
            console.error("Error claiming rewards:", error);
            return interaction.editReply({
              content:
                "An error occurred while claiming rewards. Please try again.",
              ephemeral: true,
            });
          }
        }
      }
    } catch (error) {
      console.error("Error in quests command:", error);

      // Ensure we handle the error response properly
      if (!interaction.deferred) {
        await interaction.reply({
          content: "An error occurred while processing the quests command.",
          ephemeral: true,
        });
      } else {
        await interaction.editReply({
          content: "An error occurred while processing the quests command.",
          ephemeral: true,
        });
      }
    }
  },
};
