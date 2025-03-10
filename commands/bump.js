import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import bumpSchema from "../schema/bump.js";

export default {
  data: new SlashCommandBuilder()
    .setName("bumpstatus")
    .setDescription(
      "Check when the server was last bumped and when it can be bumped again"
    ),

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;
      const bumpData = await bumpSchema.findOne({ guildId: guildId });

      const embed = new EmbedBuilder()
        .setColor(0x00ffff)
        .setTitle("🔔 Server Bump Status")
        .setTimestamp();

      if (!bumpData || !bumpData.lastBumped) {
        embed.setDescription(
          "This server hasn't been bumped yet, or the last bump wasn't recorded."
        );
        embed.setFooter({
          text: "Use /bump to bump the server for the first time!",
        });

        return await interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      }

      const now = new Date();
      const nextBumpTime = new Date(bumpData.nextBumpTime);
      const timeLeft = nextBumpTime - now;

      if (timeLeft <= 0) {
        embed
          .setDescription("✅ The server can be bumped now!")
          .setColor(0x00ff00)
          .addFields(
            {
              name: "Last Bumped",
              value: `<t:${Math.floor(
                bumpData.lastBumped.getTime() / 1000
              )}:R>`,
              inline: true,
            },
            {
              name: "Action Required",
              value: "Use </bump:1234> to bump the server",
              inline: true,
            }
          )
          .setFooter({ text: "Thank you for supporting our server growth!" });
      } else {
        // Format time remaining
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

        embed
          .setDescription("⏳ The server is on cooldown")
          .setColor(0xffaa00)
          .addFields(
            {
              name: "Last Bumped",
              value: `<t:${Math.floor(
                bumpData.lastBumped.getTime() / 1000
              )}:R>`,
              inline: true,
            },
            {
              name: "Next Bump Available",
              value: `<t:${Math.floor(nextBumpTime.getTime() / 1000)}:R>`,
              inline: true,
            },
            {
              name: "Time Remaining",
              value: `${hours}h ${minutes}m`,
              inline: true,
            }
          )
          .setFooter({
            text: "A reminder will be sent when it's time to bump again",
          });
      }

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error fetching bump status:", error);
      await interaction.reply({
        content: "An error occurred while checking the bump status.",
        ephemeral: true,
      });
    }
  },
};
