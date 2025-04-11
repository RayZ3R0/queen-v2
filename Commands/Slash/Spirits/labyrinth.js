// Migrate users from the old labyrinth command to the new spacequake system
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { generateEncounter } from "../../../utils/spirits/spacequakeSystem.js";
import { emitSpiritAction } from "../../../events/questProgress.js";
import profileSchema from "../../../schema/profile.js";
import spacequakeProgress from "../../../schema/spacequakeProgress.js";

export default {
  name: "labyrinth",
  data: new SlashCommandBuilder()
    .setName("labyrinth")
    .setDescription("⚠️ This command has been replaced by /spacequake"),
  category: "Spirits",
  cooldown: 5,
  run: async ({ client, interaction }) => {
    try {
      const userProfile = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      if (!userProfile) {
        return interaction.reply({
          content:
            "You need to start your spirit journey first using `/start`!",
          ephemeral: true,
        });
      }

      // Create informational embed about the migration
      const embed = new EmbedBuilder()
        .setTitle("🌟 Command Update: Labyrinth has evolved!")
        .setDescription(
          "The labyrinth system has been upgraded to the new **Spacequake System**!\n\n" +
            "Use `/spacequake` to:\n" +
            "• Explore spacequake zones\n" +
            "• Join raid parties\n" +
            "• Complete daily quests\n" +
            "• Earn season rewards\n\n" +
            "Your progress and rewards will continue in the new system."
        )
        .setColor("#ff69b4")
        .addFields({
          name: "Didn't receive daily rewards?",
          value: "Use `/quests` to check your daily spirit missions!",
        })
        .setFooter({
          text: "This command will be removed in a future update",
        });

      // Check if user has the old system's progress
      let progress = await spacequakeProgress.findOne({
        userid: interaction.user.id,
      });

      if (!progress) {
        // Create new progress entry with some bonus rewards for migration
        progress = new spacequakeProgress({
          userid: interaction.user.id,
          seasonLevel: 1,
          seasonXP: 100, // Bonus XP for migrating
        });
        await progress.save();

        embed.addFields({
          name: "Migration Bonus!",
          value:
            "You've received 100 Season XP for updating to the new system!",
        });
      }

      // If user has pending rewards in the old system, add migration note
      const pendingRewards = false; // Replace with actual check if needed
      if (pendingRewards) {
        embed.addFields({
          name: "Pending Rewards",
          value:
            "Your previous labyrinth rewards will be automatically converted to the new system.",
        });
      }

      await interaction.reply({
        embeds: [embed],
        components: [],
      });

      // Emit migration event for tracking
      emitSpiritAction(client, interaction.user.id, "SYSTEM_MIGRATION", {
        from: "labyrinth",
        to: "spacequake",
        bonusApplied: !progress,
      });
    } catch (error) {
      console.error("Error in labyrinth migration command:", error);
      return interaction.reply({
        content: "An error occurred while processing the command.",
        ephemeral: true,
      });
    }
  },
};
