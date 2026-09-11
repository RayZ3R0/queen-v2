import { client } from "../bot.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
} from "discord.js";
import { sendErrorToChannel } from "../utils/errorLogger.js";

// Role IDs allowed to send embeds, links, or attachments
const LEVEL_2_ROLE_ID = "1547324129189822484";
const BOOSTER_ROLE_ID = "927097726934601729";
const MOD_ROLE_ID = "920210140093902868";

const ALLOWED_ROLES = [LEVEL_2_ROLE_ID, BOOSTER_ROLE_ID, MOD_ROLE_ID];

// Regex for URLs with or without http(s)://
const URL_REGEX =
  /(?:https?:\/\/|(?:www\.)|(?:\b[a-z0-9-]+\.(?:com|net|org|edu|gov|io|gg|co|xyz|app|me|tv|to|is|so|dev|info|site|online|link|live|gif|media)\b))[^\s]*/i;

async function checkAndFilter(message) {
  try {
    // Ignore bot messages, webhook messages, or messages outside a guild
    if (message.author?.bot || message.webhookId || !message.guild) return;

    // Check if message contains embeds, links, or attachments
    const hasEmbed = Array.isArray(message.embeds) && message.embeds.length > 0;
    const hasLink = URL_REGEX.test(message.content || "");
    const hasAttachment =
      message.attachments && message.attachments.size > 0;

    if (!hasEmbed && !hasLink && !hasAttachment) return;

    // Ensure member is available
    const member =
      message.member ||
      (await message.guild.members.fetch(message.author.id).catch(() => null));
    if (!member) return;

    // Bypass check: Administrators, Server Boosters, Mods, and Level 2 role holders
    const isAdmin = Boolean(
      member.permissions?.has(PermissionsBitField.Flags.Administrator)
    );
    const hasAllowedRole = ALLOWED_ROLES.some((roleId) =>
      member.roles.cache.has(roleId)
    );

    if (isAdmin || hasAllowedRole) {
      return;
    }

    // Send warning message
    const warningEmbed = new EmbedBuilder()
      .setColor("#FFA500")
      .setDescription(
        `Hi ${message.author}, to send embeds, links, or attachments, you need to be **Level 2** or higher. ` +
        `Please continue chatting to increase your level.`
      );

    const deleteButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`delete_embed_warn_${message.author.id}`)
        .setLabel("Delete")
        .setEmoji("🗑️")
        .setStyle(ButtonStyle.Secondary)
    );

    try {
      const responseMessage = await message.channel.send({
        embeds: [warningEmbed],
        components: [deleteButton],
      });

      // Auto-delete the bot's message after 2 minutes
      setTimeout(() => {
        responseMessage.delete().catch(() => {});
      }, 120000); // 2 minutes in milliseconds
    } catch (sendError) {
      console.error("Failed to send warning message in embedFilter:", sendError);
      sendErrorToChannel(
        sendError,
        `embedFilter: Failed to send warning in #${message.channel?.name} (${message.channel?.id})`
      );
    }
  } catch (error) {
    console.error("Error in embedFilter event:", error);
    sendErrorToChannel(
      error,
      `embedFilter: Error processing message in #${message.channel?.name || "unknown"}`
    );
  }
}

client.on("messageCreate", checkAndFilter);

// Also check messageUpdate in case embeds or links are resolved after creation
client.on("messageUpdate", async (oldMessage, newMessage) => {
  // If old message already had embeds/links/attachments, it was already handled
  const oldHadEmbed =
    Array.isArray(oldMessage?.embeds) && oldMessage.embeds.length > 0;
  const oldHadLink = URL_REGEX.test(oldMessage?.content || "");
  const oldHadAttachment =
    oldMessage?.attachments && oldMessage.attachments.size > 0;
  if (oldHadEmbed || oldHadLink || oldHadAttachment) return;

  await checkAndFilter(newMessage);
});


