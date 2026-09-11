import { client } from "../bot.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} from "discord.js";
import { sendErrorToChannel } from "../utils/errorLogger.js";

// Role IDs allowed to send links or attachments
const LEVEL_2_ROLE_ID = "1547324129189822484";
const BOOSTER_ROLE_ID = "927097726934601729";
const MOD_ROLE_ID = "920210140093902868";

const ALLOWED_ROLES = [LEVEL_2_ROLE_ID, BOOSTER_ROLE_ID, MOD_ROLE_ID];

// Matches URLs with or without https:// (klipy.com, tenor.com, https://..., etc.)
const URL_REGEX =
  /(?:https?:\/\/|www\.)[^\s]+|(?:^|\s)[a-z0-9-]+\.(?:com|net|org|edu|gov|io|gg|co|xyz|app|me|tv|to|is|so|dev|info|site|online|link|live|gif|media)(?:\/[^\s]*)?(?:\s|$)/i;

async function checkAndFilter(message) {
  try {
    // Ignore bots, webhooks, and DMs
    if (message.author?.bot || message.webhookId || !message.guild) return;

    // Detect URL links, file attachments, or already-resolved embeds
    const hasLink = URL_REGEX.test(message.content || "");
    const hasAttachment = message.attachments && message.attachments.size > 0;
    const hasEmbed = Array.isArray(message.embeds) && message.embeds.length > 0;

    if (!hasLink && !hasAttachment && !hasEmbed) return;

    // Resolve member (may not be cached for very first messages)
    const member =
      message.member ||
      (await message.guild.members
        .fetch({ user: message.author.id, force: false })
        .catch(() => null));
    if (!member) return;

    // Bypass: Administrators, Server Boosters, Mods, Level 2+
    const isAdmin = Boolean(
      member.permissions?.has(PermissionsBitField.Flags.Administrator)
    );
    const hasAllowedRole = ALLOWED_ROLES.some((roleId) =>
      member.roles.cache.has(roleId)
    );

    if (isAdmin || hasAllowedRole) return;

    // Send plain-text warning.
    // We intentionally avoid embeds here because this channel has "Embed Links"
    // denied for users below Level 2 — the permission override can also affect
    // the bot in some channel configurations, causing the embed to be stripped
    // and show as an empty grey box. Plain text is always reliable.
    const deleteButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`delete_embed_warn_${message.author.id}`)
        .setLabel("Dismiss")
        .setEmoji("🗑️")
        .setStyle(ButtonStyle.Secondary)
    );

    try {
      const responseMessage = await message.channel.send({
        content:
          `⚠️ ${message.author} — to send links or attachments you need to be **Level 2** or higher. ` +
          `Keep chatting to level up!`,
        components: [deleteButton],
        allowedMentions: { users: [message.author.id] },
      });

      // Auto-delete warning after 2 minutes
      setTimeout(() => {
        responseMessage.delete().catch(() => {});
      }, 120_000);
    } catch (sendError) {
      console.error("embedFilter: failed to send warning:", sendError);
      sendErrorToChannel(
        sendError,
        `embedFilter: Failed to send warning in #${message.channel?.name} (${message.channel?.id})`
      );
    }
  } catch (error) {
    console.error("embedFilter: error in checkAndFilter:", error);
    sendErrorToChannel(
      error,
      `embedFilter: Error in #${message.channel?.name || "unknown"}`
    );
  }
}

// Only messageCreate is needed — we detect by URL content, not embed presence.
// messageUpdate would double-fire: when Discord resolves a link preview it fires
// messageUpdate, but oldMessage.content already has the URL so we'd have to
// suppress it anyway. messageCreate alone is correct and sufficient.
client.on("messageCreate", checkAndFilter);
