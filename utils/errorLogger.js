import { EmbedBuilder } from "discord.js";
import { client } from "../bot.js";

const ERROR_CHANNEL_ID = "1009408632317804544";
const recentErrors = new Map();

/**
 * Sends an error to channel 1009408632317804544 with details.
 * Deduplicates identical errors sent within 5 seconds.
 * @param {Error|any} error - The error to log
 * @param {string} [context=""] - Where or why the error occurred
 */
export async function sendErrorToChannel(error, context = "") {
  try {
    if (!client || !client.isReady()) return;

    const errorStack = error?.stack || error?.message || String(error);
    const dedupeKey = `${context}:${errorStack.slice(0, 150)}`;
    const now = Date.now();

    if (recentErrors.has(dedupeKey) && now - recentErrors.get(dedupeKey) < 5000) {
      return;
    }
    recentErrors.set(dedupeKey, now);

    // Prevent map from growing indefinitely
    if (recentErrors.size > 100) {
      for (const [k, time] of recentErrors.entries()) {
        if (now - time > 60000) recentErrors.delete(k);
      }
    }

    const channel =
      client.channels.cache.get(ERROR_CHANNEL_ID) ||
      (await client.channels.fetch(ERROR_CHANNEL_ID).catch(() => null));

    if (!channel || !channel.isTextBased()) return;

    const trimmedError =
      errorStack.length > 3900 ? errorStack.slice(0, 3900) + "..." : errorStack;

    const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle(`🚨 Error Detected${context ? `: ${context}` : ""}`)
      .setDescription(`\`\`\`js\n${trimmedError}\n\`\`\``)
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch((err) => {
      console.error("Failed to send error embed to Discord channel:", err);
    });
  } catch (err) {
    console.error("Error in sendErrorToChannel:", err);
  }
}

export default sendErrorToChannel;
