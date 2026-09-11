import { client } from "../bot.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
} from "discord.js";
import { sendErrorToChannel } from "../utils/errorLogger.js";

// ── Bypass roles (always allowed regardless of channel) ──────────────────────
const BOOSTER_ROLE_ID = "927097726934601729";
const MOD_ROLE_ID     = "920210140093902868";

// ── Level-gated channel rules ─────────────────────────────────────────────────
// Format: { categoryId, requiredRoleId, levelLabel }
// The FIRST matching rule wins. A null categoryId acts as a catch-all fallback.
const CHANNEL_RULES = [
  {
    categoryId:     "747483802741506130", // specific category → Level 5
    requiredRoleId: "1011566110354710650",
    levelLabel:     "Level 5",
  },
  {
    categoryId:     null,                 // every other channel → Level 2
    requiredRoleId: "1547324129189822484",
    levelLabel:     "Level 2",
  },
];

// Matches URLs with or without https:// (e.g. klipy.com, tenor.com, https://...)
const URL_REGEX =
  /(?:https?:\/\/|www\.)[^\s]+|(?:^|\s)[a-z0-9-]+\.(?:com|net|org|edu|gov|io|gg|co|xyz|app|me|tv|to|is|so|dev|info|site|online|link|live|gif|media)(?:\/[^\s]*)?(?:\s|$)/i;

async function checkAndFilter(message) {
  try {
    // Ignore bots, webhooks, and DMs
    if (message.author?.bot || message.webhookId || !message.guild) return;

    // Detect URL links, file attachments, or already-resolved embeds
    const hasLink       = URL_REGEX.test(message.content || "");
    const hasAttachment = message.attachments && message.attachments.size > 0;
    const hasEmbed      = Array.isArray(message.embeds) && message.embeds.length > 0;

    if (!hasLink && !hasAttachment && !hasEmbed) return;

    // Resolve member (may not be cached for very first messages)
    const member =
      message.member ||
      (await message.guild.members
        .fetch({ user: message.author.id, force: false })
        .catch(() => null));
    if (!member) return;

    // Administrators are always bypassed
    if (member.permissions?.has(PermissionsBitField.Flags.Administrator)) return;

    // Boosters and Mods are always bypassed
    if ([BOOSTER_ROLE_ID, MOD_ROLE_ID].some((id) => member.roles.cache.has(id))) return;

    // Determine which rule applies to this channel
    const categoryId = message.channel.parentId ?? null;
    const rule =
      CHANNEL_RULES.find((r) => r.categoryId === categoryId) ??
      CHANNEL_RULES.find((r) => r.categoryId === null);

    if (!rule) return; // no rule configured — do nothing

    // If user has the required level role, allow
    if (member.roles.cache.has(rule.requiredRoleId)) return;

    // ── Send plain-text warning ───────────────────────────────────────────────
    // We avoid embeds: "Embed Links" denied for these users (and sometimes the
    // bot too when it's a blanket channel override) causes embeds to be silently
    // stripped, leaving an empty grey box. Plain text is always reliable.
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
          `⚠️ ${message.author} — to send links or attachments you need to be **${rule.levelLabel}** or higher. ` +
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
// messageUpdate, but oldMessage.content already has the URL so we'd need to
// suppress it anyway. messageCreate alone is correct and sufficient.
client.on("messageCreate", checkAndFilter);
