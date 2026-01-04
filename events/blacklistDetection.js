import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } from "discord.js";
import { client } from "../bot.js";
import Blacklist from "../schema/blacklist.js";
import {
  calculatePerceptualHash,
  areImagesSimilar,
  extractDirectImageUrls,
  isDirectImageUrl,
} from "../utils/imageHash.js";

// Configuration
const TIMEOUT_DURATION = 60000; // 1 minute (60000ms) - change to 86400000 for 24 hours
const MOD_CHANNEL_ID = "965509744859185262";
const APPEAL_CHANNEL_ID = "970640479463022613";
const MOD_ROLE_ID = "920210140093902868";

// Cache for blacklist to reduce database queries
let blacklistCache = {
  lastUpdate: 0,
  data: { text: [], url: [], image: [] },
};
const CACHE_DURATION = 60000; // 1 minute

/**
 * Load blacklist from database with caching
 */
async function loadBlacklist(guildId) {
  const now = Date.now();

  // Use cache if still valid
  if (now - blacklistCache.lastUpdate < CACHE_DURATION) {
    return blacklistCache.data;
  }

  // Fetch from database
  const entries = await Blacklist.find({ guildId });

  const data = {
    text: entries.filter((e) => e.type === "text"),
    url: entries.filter((e) => e.type === "url"),
    image: entries.filter((e) => e.type === "image"),
  };

  // Update cache
  blacklistCache = {
    lastUpdate: now,
    data: data,
  };

  return data;
}

/**
 * Clear blacklist cache (call this when blacklist is modified)
 */
export function clearBlacklistCache() {
  blacklistCache.lastUpdate = 0;
}

/**
 * Check if message contains blacklisted content
 */
async function checkBlacklist(message) {
  const blacklist = await loadBlacklist(message.guild.id);
  const violations = [];

  // 1. Check text patterns (case-insensitive exact match)
  if (message.content) {
    const contentLower = message.content.toLowerCase();

    for (const entry of blacklist.text) {
      if (contentLower === entry.content) {
        violations.push({
          type: "text",
          entry: entry,
          matched: entry.content,
        });
        break; // Only report first match
      }
    }
  }

  // 2. Check URLs (treat as text patterns)
  if (message.content && violations.length === 0) {
    const urlRegex = /https?:\/\/[^\s\[\]()]+/gi;
    const urls = message.content.match(urlRegex) || [];

    for (const url of urls) {
      // Skip direct image URLs (they're handled separately)
      if (isDirectImageUrl(url)) continue;

      const urlLower = url.toLowerCase();
      for (const entry of blacklist.url) {
        if (urlLower === entry.content) {
          violations.push({
            type: "url",
            entry: entry,
            matched: url,
          });
          break;
        }
      }
      if (violations.length > 0) break;
    }
  }

  // 3. Check images (attachments)
  if (violations.length === 0) {
    for (const attachment of message.attachments.values()) {
      if (attachment.contentType?.startsWith("image/")) {
        try {
          const hash = await calculatePerceptualHash(attachment.url);

          for (const entry of blacklist.image) {
            if (areImagesSimilar(hash, entry.content)) {
              violations.push({
                type: "image",
                entry: entry,
                matched: attachment.url,
                attachmentName: attachment.name,
              });
              break;
            }
          }
        } catch (error) {
          console.error("Error checking attachment:", error);
        }
        if (violations.length > 0) break;
      }
    }
  }

  // 4. Check direct image URLs in message content
  if (message.content && violations.length === 0) {
    const imageUrls = extractDirectImageUrls(message.content);

    for (const url of imageUrls) {
      try {
        const hash = await calculatePerceptualHash(url);

        for (const entry of blacklist.image) {
          if (areImagesSimilar(hash, entry.content)) {
            violations.push({
              type: "image",
              entry: entry,
              matched: url,
            });
            break;
          }
        }
      } catch (error) {
        console.error("Error checking image URL:", error);
      }
      if (violations.length > 0) break;
    }
  }

  return violations;
}

/**
 * Handle blacklist violation
 */
async function handleViolation(message, violations) {
  if (violations.length === 0) return;

  const violation = violations[0]; // Use first violation
  const { entry, matched, type, attachmentName } = violation;

  try {
    // 1. Delete the message
    await message.delete().catch(console.error);

    // 2. Update trigger count
    await Blacklist.findByIdAndUpdate(entry._id, {
      $inc: { triggerCount: 1 },
      lastTriggered: new Date(),
    });

    // 3. Send DM with appeal button
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("🚫 Message Removed")
        .setDescription(
          `Your message in **${message.guild.name}** was removed because it contained blacklisted content.\n\n` +
            `**Reason:** ${entry.reason}\n\n` +
            `You have been timed out for ${TIMEOUT_DURATION / 60000} minute(s).\n\n` +
            `If you believe this was a mistake, you can appeal by clicking the button below.`
        )
        .setTimestamp();

      const appealButton = new ButtonBuilder()
        .setCustomId("mod_appeal")
        .setLabel("Appeal Timeout")
        .setStyle(ButtonStyle.Primary);

      const appealRow = new ActionRowBuilder().addComponents(appealButton);

      await message.author.send({
        embeds: [dmEmbed],
        components: [appealRow],
      });
    } catch (error) {
      console.error("Failed to send DM:", error);
    }

    // 4. Timeout the user
    await message.member
      .timeout(TIMEOUT_DURATION, `Blacklist violation: ${entry.reason}`)
      .catch(console.error);

    // 5. Notify mods
    const modChannel = message.guild.channels.cache.get(MOD_CHANNEL_ID);
    if (modChannel) {
      const modEmbed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("🚫 Blacklist Violation Detected")
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .addFields(
          {
            name: "User",
            value: `${message.author} (${message.author.id})`,
            inline: true,
          },
          {
            name: "Channel",
            value: `${message.channel}`,
            inline: true,
          },
          {
            name: "Violation Type",
            value: type.toUpperCase(),
            inline: true,
          },
          {
            name: "Blacklist Reason",
            value: entry.reason,
            inline: false,
          },
          {
            name: "Action Taken",
            value: `Timed out for ${TIMEOUT_DURATION / 60000} minute(s)`,
            inline: false,
          }
        )
        .setTimestamp();

      // Add matched content based on type
      if (type === "text" || type === "url") {
        modEmbed.addFields({
          name: "Matched Content",
          value: `\`\`\`${matched.substring(0, 1000)}\`\`\``,
          inline: false,
        });
      } else if (type === "image") {
        modEmbed.addFields({
          name: "Matched Image",
          value: attachmentName
            ? `Image: ${attachmentName}`
            : "Direct image URL",
          inline: false,
        });
        if (matched) {
          modEmbed.setImage(matched);
        }
      }

      // Add full message content if available
      if (message.content && message.content.length > 0) {
        const contentPreview =
          message.content.length > 500
            ? message.content.substring(0, 497) + "..."
            : message.content;
        modEmbed.addFields({
          name: "Original Message",
          value: `\`\`\`${contentPreview}\`\`\``,
          inline: false,
        });
      }

      await modChannel.send({
        content: `<@&${MOD_ROLE_ID}>`,
        embeds: [modEmbed],
      });
    }
  } catch (error) {
    console.error("Error handling blacklist violation:", error);
  }
}

/**
 * Main event handler
 */
client.on("messageCreate", async (message) => {
  try {
    // Ignore bots
    if (message.author.bot) return;

    // Ignore DMs
    if (!message.guild) return;

    // Ignore messages from mods/admins
    if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
    if (message.member.roles.cache.has(MOD_ROLE_ID)) return;

    // Check blacklist
    const violations = await checkBlacklist(message);

    if (violations.length > 0) {
      await handleViolation(message, violations);
    }
  } catch (error) {
    console.error("Error in blacklist detection:", error);
  }
});

export default (client) => {
  console.log("✅ Blacklist detection event loaded");
};
