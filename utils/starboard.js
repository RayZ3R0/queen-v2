import { EmbedBuilder } from "discord.js";

/**
 * Custom error for starboard handling.
 */
class SimplyError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "SimplyError";
  }
}

/**
 * Builds and returns a starboard embed based on the provided message.
 * @param {import("discord.js").Message} msg The source message.
 * @param {object} options Starboard options.
 * @returns {EmbedBuilder}
 */
function buildStarboardEmbed(msg, options) {
  const attachment = msg.attachments.first();
  const imageUrl = attachment ? attachment.url : null;
  return new EmbedBuilder()
    .setAuthor({ name: msg.author.tag, iconURL: msg.author.displayAvatarURL() })
    .setColor(options.embedColor || "#FFC83D")
    .setDescription(msg.content)
    .setTitle("Jump to message")
    .setURL(msg.url)
    .setImage(imageUrl)
    .setFooter({ text: `⭐ | ID: ${msg.id}` });
}

/**
 * Starboard function for handling starboard events.
 *
 * @param {import("discord.js").Client} client The Discord client.
 * @param {import("discord.js").MessageReaction | import("discord.js").Message} payload The reaction object or message (for deletion).
 * @param {object} options Starboard options.
 *
 * --- options ---
 * min => Number (minimum star count, defaults to 2)
 * emoji => String (Emoji ID to filter on)
 * chid => String (Channel ID for the starboard)
 * embedColor => HexColor (Color for the embed)
 * event => {string} (One of: "messageReactionAdd", "messageReactionRemove", "messageDelete")
 */
export default async function starboard(client, payload, options = {}) {
  try {
    // Validate minimum stars
    const minVal = Number(options.min || 2);
    if (isNaN(minVal))
      throw new SimplyError(
        "MIN_IS_NAN",
        `Minimum stars number is not a number. You specified ${options.min}.`
      );
    if (minVal === 0)
      throw new SimplyError(
        "MIN_IS_ZERO",
        "Minimum stars number should not be 0."
      );

    const eventType = options.event;
    if (!eventType)
      throw new SimplyError(
        "EVENT_NOT_SPECIFIED",
        "Starboard requires you to specify an event. Options: messageReactionAdd, messageReactionRemove, messageDelete"
      );

    // Retrieve starboard channel.
    const starboardChannel = client.channels.cache.get(options.chid);
    if (!starboardChannel)
      throw new SimplyError(
        "INVALID_CHANNEL_ID",
        `Channel ID ${options.chid} is not valid or missing VIEW_CHANNEL permission.`
      );

    // Helper for fetching recent starboard messages.
    const fetchStarboardMessages = async () => {
      return await starboardChannel.messages.fetch({ limit: 100 });
    };

    // -- Process messageReactionAdd event --
    if (eventType === "messageReactionAdd") {
      await payload.fetch();
      if (
        payload.emoji.id === options.emoji ||
        payload.emoji.name === "⭐" ||
        payload.emoji.name === "🌟"
      ) {
        const starCount = payload.count || 1;
        if (starCount < minVal) return;

        const sourceMsg = await payload.message.fetch();
        // Do not process if the source message already has an embed.
        if (sourceMsg.embeds.length !== 0) return;

        const embed = buildStarboardEmbed(sourceMsg, options);
        const starEmoji = client.emojis.cache.get(options.emoji) || "⭐";
        const messages = await fetchStarboardMessages();

        // Unique identification via the footer text.
        const existingMsg = messages.find((msg) => {
          const footer = msg.embeds[0]?.footer?.text;
          return footer === `⭐ | ID: ${sourceMsg.id}`;
        });

        if (existingMsg) {
          await existingMsg.edit({
            content: `**${starEmoji} ${starCount}**`,
            embeds: [embed],
          });
        } else {
          await starboardChannel.send({
            content: `**${starEmoji} ${starCount}**`,
            embeds: [embed],
          });
        }
      }
    }
    // -- Process messageReactionRemove event --
    else if (eventType === "messageReactionRemove") {
      await payload.fetch();
      if (
        payload.emoji.id === options.emoji ||
        payload.emoji.name === "⭐" ||
        payload.emoji.name === "🌟"
      ) {
        const sourceMsg = await payload.message.fetch();
        const embed = buildStarboardEmbed(sourceMsg, options);
        const starEmoji = client.emojis.cache.get(options.emoji) || "⭐";
        const messages = await fetchStarboardMessages();

        const existingMsg = messages.find((msg) => {
          const footer = msg.embeds[0]?.footer?.text;
          return footer === `⭐ | ID: ${sourceMsg.id}`;
        });

        if (existingMsg) {
          const newCount = payload.count || 0;
          if (newCount < minVal) {
            await existingMsg.delete();
          } else {
            await existingMsg.edit({
              content: `**${starEmoji} ${newCount}**`,
              embeds: [embed],
            });
          }
        }
      }
    }
    // -- Process messageDelete event --
    else if (eventType === "messageDelete") {
      // In this case, payload is a Message.
      const deletedMsg = payload;
      const messages = await fetchStarboardMessages();
      const existingMsg = messages.find((msg) => {
        const footer = msg.embeds[0]?.footer?.text;
        return footer === `⭐ | ID: ${deletedMsg.id}`;
      });
      if (existingMsg) {
        await existingMsg.delete();
      }
    } else {
      throw new Error(
        "Invalid event. Available events: messageReactionAdd, messageReactionRemove, messageDelete"
      );
    }
  } catch (err) {
    console.error(`Error Occurred in starboard function: ${err.stack}`);
  }
}
