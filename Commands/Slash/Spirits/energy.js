import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import profileSchema from "../../../schema/profile.js";

// Constants
const MAX_ENERGY = 60;
const ENERGY_REGEN_TIME = 6 * 60 * 1000; // 6 minutes in milliseconds

export default {
  name: "energy",
  data: new SlashCommandBuilder()
    .setName("energy")
    .setDescription("Check your current energy level"),
  category: "Spirits",

  run: async ({ client, interaction }) => {
    try {
      await interaction.deferReply();

      // Get user's profile
      const profileData = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      if (!profileData) {
        return interaction.editReply({
          content: "Please use `/start` first to create your profile.",
        });
      }

      const now = Date.now();
      let energy = profileData.energy || 0;
      const lastEnergyUpdate = profileData.lastEnergyUpdate || now;

      // Calculate energy regeneration
      const timePassed = now - lastEnergyUpdate;
      const energyGained = Math.floor(timePassed / ENERGY_REGEN_TIME);

      if (energyGained > 0) {
        energy = Math.min(MAX_ENERGY, energy + energyGained);

        // Update profile with new energy and timestamp
        await profileSchema.findOneAndUpdate(
          { userid: interaction.user.id },
          {
            energy,
            lastEnergyUpdate: now - (timePassed % ENERGY_REGEN_TIME),
          }
        );
      }

      // Calculate time until next energy point
      const timeUntilNext =
        ENERGY_REGEN_TIME - (timePassed % ENERGY_REGEN_TIME);
      const minutesUntilNext = Math.floor(timeUntilNext / 60000);
      const secondsUntilNext = Math.floor((timeUntilNext % 60000) / 1000);

      // Create energy bar
      const filledBars = "█".repeat(Math.floor((energy / MAX_ENERGY) * 10));
      const emptyBars = "░".repeat(10 - filledBars.length);
      const energyBar = filledBars + emptyBars;

      // Create embed
      const embed = new EmbedBuilder()
        .setColor("Random")
        .setTitle("⚡ Energy Status")
        .setDescription(
          `**Current Energy:** ${energy}/${MAX_ENERGY}\n` +
            `**Energy Bar:** ${energyBar}\n\n` +
            (energy < MAX_ENERGY
              ? `Next energy point in: ${minutesUntilNext}m ${secondsUntilNext}s\n`
              : "Energy is full!\n") +
            "\n*Energy regenerates every 6 minutes*"
        )
        .setFooter({
          text: "Energy is used for various spirit activities",
        });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Energy command error:", error);
      return interaction.editReply({
        content: "An error occurred. Please try again later.",
      });
    }
  },
};
