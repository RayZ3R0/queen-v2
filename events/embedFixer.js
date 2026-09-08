import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from "discord.js";
import { client } from "../bot.js";
import {
  ALLOWED_CHANNELS,
  sanitizeUsername,
  processMessageContent,
} from "../utils/embedFixerUtils.js";

// Cache for channel webhooks to avoid hammering Discord API
const webhookCache = new Map();

client.on("messageCreate", async (message) => {
  try {
    // 1. Ignore bot messages, webhook messages, or messages outside a guild
    if (message.author.bot || message.webhookId || !message.guild) return;

    // 2. Channel restriction: only in 912942764000419850 and 901338500383789056 (including their threads)
    const channel = message.channel;
    const channelId = channel.isThread?.() ? channel.parentId : channel.id;
    if (
      !ALLOWED_CHANNELS.includes(channel.id) &&
      !ALLOWED_CHANNELS.includes(channelId)
    ) {
      return;
    }

    // 3. Check for fixable URLs
    const processed = processMessageContent(message.content);
    if (!processed) return;

    const { fixedContent } = processed;

    // 4. Build reply reference context if the original message was replying to someone
    let replyHeader = "";
    if (message.reference?.messageId) {
      try {
        const refMsg = await message.channel.messages.fetch(
          message.reference.messageId
        );
        if (refMsg) {
          replyHeader = `-# ↩️ Replying to <@${refMsg.author.id}> ([jump](${refMsg.url}))\n`;
        }
      } catch {
        // Referenced message could be deleted or inaccessible
      }
    }

    // 5. Build delete button so original author or moderators can remove the fixed message
    const deleteButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`delete_embed_fix_${message.author.id}`)
        .setLabel("Delete")
        .setEmoji("🗑️")
        .setStyle(ButtonStyle.Secondary)
    );

    const finalContent = `${replyHeader}${fixedContent}`;
    const files = [...message.attachments.values()];

    // 6. Attempt to use a webhook for seamless replace (like embed-fixer)
    const targetChannel = channel.isThread?.() ? channel.parent : channel;
    if (targetChannel && targetChannel.isTextBased()) {
      let webhook = webhookCache.get(targetChannel.id);

      if (!webhook) {
        const webhooks = await targetChannel.fetchWebhooks().catch(() => null);
        webhook = webhooks?.find((wh) => wh.owner?.id === client.user.id);

        if (
          !webhook &&
          targetChannel
            .permissionsFor(client.user)
            ?.has(PermissionFlagsBits.ManageWebhooks)
        ) {
          webhook = await targetChannel
            .createWebhook({
              name: "Queen Embed Fixer",
              avatar: client.user.displayAvatarURL(),
              reason: "Auto-fixing social media embeds",
            })
            .catch(() => null);
        }

        if (webhook) {
          webhookCache.set(targetChannel.id, webhook);
        }
      }

      if (webhook) {
        try {
          const sendOptions = {
            content: finalContent,
            username: sanitizeUsername(
              message.member?.displayName ||
                message.author.displayName ||
                message.author.username
            ),
            avatarURL: message.author.displayAvatarURL({ dynamic: true }),
            files,
            components: [deleteButton],
            allowedMentions: { parse: ["users"] },
          };

          if (channel.isThread?.()) {
            sendOptions.threadId = channel.id;
          }

          await webhook.send(sendOptions);
          await message.delete().catch(() => {});
          return;
        } catch (webhookError) {
          console.error(
            "Failed to send webhook for embed fixer, using reply fallback:",
            webhookError
          );
          // If webhook was deleted remotely, invalidate cache
          webhookCache.delete(targetChannel.id);
        }
      }
    }

    // 7. Fallback if webhook is unavailable or lacks permissions: reply and suppress original embeds
    await message
      .reply({
        content: finalContent,
        files,
        components: [deleteButton],
        allowedMentions: { repliedUser: false },
      })
      .catch(console.error);

    await message.suppressEmbeds(true).catch(() => {});
  } catch (error) {
    console.error("Error in embedFixer event handler:", error);
  }
});

export default async (bot) => {
  // Event file loaded via eventHandler.js
};
