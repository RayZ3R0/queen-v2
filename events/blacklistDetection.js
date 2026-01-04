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
const DEBUG_CHANNEL_ID = "1009408632317804544";
const DEBUG_ENABLED = false; // Set to true to enable debug logging

// Debug function
async function sendDebug(message, data = {}) {
  if (!DEBUG_ENABLED) return; // Skip if debugging is disabled
  
  const debugMsg = `[BLACKLIST DEBUG] ${message}`;
  console.log(debugMsg, data);
  
  try {
    const debugChannel = client.channels.cache.get(DEBUG_CHANNEL_ID);
    if (debugChannel) {
      const embed = new EmbedBuilder()
        .setColor("Yellow")
        .setTitle("🔍 Blacklist Debug")
        .setDescription(message)
        .setTimestamp();
      
      if (Object.keys(data).length > 0) {
        const dataStr = JSON.stringify(data, null, 2);
        if (dataStr.length < 1000) {
          embed.addFields({ name: "Data", value: `\`\`\`json\n${dataStr}\`\`\`` });
        } else {
          embed.addFields({ name: "Data", value: `\`\`\`\n${dataStr.substring(0, 997)}...\`\`\`` });
        }
      }
      
      await debugChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error("Error sending debug message:", error);
  }
}

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
    await sendDebug("Using cached blacklist", {
      textCount: blacklistCache.data.text.length,
      urlCount: blacklistCache.data.url.length,
      imageCount: blacklistCache.data.image.length,
    });
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

  await sendDebug("Loaded blacklist from database", {
    totalEntries: entries.length,
    textCount: data.text.length,
    urlCount: data.url.length,
    imageCount: data.image.length,
  });

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

  await sendDebug("Checking message for blacklist violations", {
    author: message.author.tag,
    authorId: message.author.id,
    channelId: message.channel.id,
    contentLength: message.content?.length || 0,
    hasAttachments: message.attachments.size > 0,
    attachmentCount: message.attachments.size,
  });

  // 1. Check text patterns (case-insensitive exact match)
  if (message.content) {
    const contentLower = message.content.toLowerCase();

    await sendDebug("Checking text patterns", {
      messageContent: message.content.substring(0, 100),
      contentLower: contentLower.substring(0, 100),
      blacklistTextCount: blacklist.text.length,
    });

    for (const entry of blacklist.text) {
      if (contentLower === entry.content) {
        await sendDebug("TEXT MATCH FOUND!", {
          matched: entry.content,
          messageContent: message.content,
        });
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

    await sendDebug("Checking URLs", {
      urlsFound: urls.length,
      urls: urls,
      blacklistUrlCount: blacklist.url.length,
    });

    for (const url of urls) {
      // Skip direct image URLs (they're handled separately)
      if (isDirectImageUrl(url)) {
        await sendDebug("Skipping direct image URL (will check later)", { url });
        continue;
      }

      const urlLower = url.toLowerCase();
      for (const entry of blacklist.url) {
        if (urlLower === entry.content) {
          await sendDebug("URL MATCH FOUND!", {
            matched: entry.content,
            url: url,
          });
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
    await sendDebug("Checking image attachments", {
      attachmentCount: message.attachments.size,
      blacklistImageCount: blacklist.image.length,
    });

    for (const attachment of message.attachments.values()) {
      if (attachment.contentType?.startsWith("image/")) {
        try {
          await sendDebug("Hashing attachment", {
            name: attachment.name,
            url: attachment.url,
          });
          const hash = await calculatePerceptualHash(attachment.url);
          await sendDebug("Attachment hash calculated", { hash });

          for (const entry of blacklist.image) {
            const similar = areImagesSimilar(hash, entry.content);
            await sendDebug("Comparing with blacklisted image", {
              messageHash: hash,
              blacklistHash: entry.content,
              similar: similar,
            });

            if (similar) {
              await sendDebug("IMAGE MATCH FOUND!", {
                attachmentName: attachment.name,
                hash: hash,
              });
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
          await sendDebug("Error checking attachment", {
            error: error.message,
            attachment: attachment.name,
          });
        }
        if (violations.length > 0) break;
      }
    }
  }

  // 4. Check direct image URLs in message content
  if (message.content && violations.length === 0) {
    const imageUrls = extractDirectImageUrls(message.content);

    await sendDebug("Checking direct image URLs", {
      imageUrlsFound: imageUrls.length,
      imageUrls: imageUrls,
    });

    for (const url of imageUrls) {
      try {
        await sendDebug("Hashing image URL", { url });
        const hash = await calculatePerceptualHash(url);
        await sendDebug("Image URL hash calculated", { hash });

        for (const entry of blacklist.image) {
          const similar = areImagesSimilar(hash, entry.content);
          await sendDebug("Comparing URL image with blacklisted image", {
            messageHash: hash,
            blacklistHash: entry.content,
            similar: similar,
          });

          if (similar) {
            await sendDebug("IMAGE URL MATCH FOUND!", {
              url: url,
              hash: hash,
            });
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
        await sendDebug("Error checking image URL", {
          error: error.message,
          url: url,
        });
      }
      if (violations.length > 0) break;
    }
  }

  await sendDebug("Check complete", {
    violationsFound: violations.length,
    violationType: violations.length > 0 ? violations[0].type : null,
  });

  return violations;
}

/**
 * Handle blacklist violation
 */
async function handleViolation(message, violations) {
  if (violations.length === 0) return;

  const violation = violations[0]; // Use first violation
  const { entry, matched, type, attachmentName } = violation;

  await sendDebug("HANDLING VIOLATION", {
    type: type,
    matched: matched?.substring(0, 100),
    reason: entry.reason,
    userId: message.author.id,
    userName: message.author.tag,
  });

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

      await sendDebug("Mod notification sent successfully");
    }

    await sendDebug("Violation handled successfully", {
      deleted: true,
      timedOut: true,
      dmSent: "attempted",
    });
  } catch (error) {
    console.error("Error handling blacklist violation:", error);
    await sendDebug("ERROR handling violation", {
      error: error.message,
      stack: error.stack,
    });
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

    await sendDebug("Processing message for blacklist check", {
      author: message.author.tag,
      authorId: message.author.id,
      channelId: message.channel.id,
      guildId: message.guild.id,
    });

    // Check blacklist
    const violations = await checkBlacklist(message);

    if (violations.length > 0) {
      // Ignore messages from mods/admins (but only log if they triggered a violation)
      if (message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await sendDebug("Ignoring admin message with violation", { 
          userId: message.author.id,
          violationType: violations[0].type 
        });
        return;
      }
      if (message.member.roles.cache.has(MOD_ROLE_ID)) {
        await sendDebug("Ignoring mod message with violation", { 
          userId: message.author.id,
          violationType: violations[0].type 
        });
        return;
      }

      await handleViolation(message, violations);
    } else {
      await sendDebug("No violations found", { messageId: message.id });
    }
  } catch (error) {
    console.error("Error in blacklist detection:", error);
    await sendDebug("ERROR in main event handler", {
      error: error.message,
      stack: error.stack,
    });
  }
});

export default (client) => {
  console.log("✅ Blacklist detection event loaded");
};
