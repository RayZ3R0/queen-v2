import { EmbedBuilder } from "discord.js";
import { client } from "../bot.js";
import HoneypotViolation from "../schema/honeypotViolation.js";

// Track button clicks to prevent spam
const clickCooldowns = new Map();
const COOLDOWN_DURATION = 5000; // 5 seconds between clicks

/**
 * Handle honeypot verification button interactions
 */
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isButton()) return;

    // Only handle honeypot verification buttons
    if (!interaction.customId.startsWith("honeypot_verify_")) return;

    // Defer reply immediately to prevent other handlers from intercepting
    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate().catch(() => {});
    }

    // Parse button data: honeypot_verify_{violationId}_{color}
    const parts = interaction.customId.split("_");
    if (parts.length !== 4) return;

    const violationId = parts[2];
    const clickedColor = parts[3];

    // Check cooldown
    const cooldownKey = `${interaction.user.id}_${violationId}`;
    const now = Date.now();
    const lastClick = clickCooldowns.get(cooldownKey);

    if (lastClick && now - lastClick < COOLDOWN_DURATION) {
      await interaction.editReply({
        content: "⏳ Please wait a moment before trying again.",
      }).catch(() => {});
      return;
    }

    clickCooldowns.set(cooldownKey, now);

    // Fetch violation record
    const violation = await HoneypotViolation.findById(violationId);

    if (!violation) {
      await interaction.editReply({
        content: "❌ Verification session not found or already completed.",
      }).catch(() => {});
      return;
    }

    // Check if already verified
    if (violation.verified) {
      await interaction.editReply({
        content: "✅ You have already been verified and unmuted.",
      }).catch(() => {});
      return;
    }

    // Check if correct button
    const isCorrect = clickedColor === violation.correctButton;

    if (isCorrect) {
      // Correct button clicked!
      console.log(`[HONEYPOT] User ${interaction.user.tag} clicked correct button, removing timeout...`);

      // Remove timeout
      try {
        const guild = client.guilds.cache.get(violation.guildId);
        if (guild) {
          const member = await guild.members.fetch(violation.userId);
          if (member && member.communicationDisabledUntil) {
            await member.timeout(null, "Honeypot verification passed");
            console.log(`[HONEYPOT] Removed timeout from ${interaction.user.tag}`);
          }
        }
      } catch (timeoutError) {
        console.error("[HONEYPOT] Error removing timeout:", timeoutError);
      }

      // Update violation record
      await HoneypotViolation.findByIdAndUpdate(violationId, {
        verified: true,
        verifiedAt: new Date(),
      });

      // Success message
      const successEmbed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("✅ Verification Successful")
        .setDescription(
          `You have been verified as a human and your timeout has been removed.\n\n` +
            `You can now participate in the server again. Please read the channel descriptions carefully to avoid restricted areas.`
        )
        .setTimestamp();

      await interaction.editReply({
        embeds: [successEmbed],
        components: [], // Remove buttons
      }).catch(() => {});
    } else {
      // Wrong button clicked
      console.log(`[HONEYPOT] User ${interaction.user.tag} clicked wrong button (${clickedColor} instead of ${violation.correctButton})`);

      const failEmbed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("❌ Verification Failed")
        .setDescription(
          `You clicked the wrong button.\n\n` +
            `Your 7-day timeout remains in effect. If you believe this is a mistake, please contact the server moderators.`
        )
        .setTimestamp();

      await interaction.editReply({
        embeds: [failEmbed],
        components: [], // Remove buttons
      }).catch(() => {});
    }
  } catch (error) {
    console.error("[HONEYPOT] Error in verification handler:", error);
    // Try to send error message, but don't fail if interaction already handled
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ An error occurred during verification. Please contact a moderator.",
          ephemeral: true,
        });
      } else {
        await interaction.editReply({
          content: "❌ An error occurred during verification. Please contact a moderator.",
        });
      }
    } catch (replyError) {
      // Silently fail if we can't reply
    }
  }
});

export default (client) => {
  console.log("✅ Honeypot verification handler loaded");
};
