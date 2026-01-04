import { EmbedBuilder, PermissionFlagsBits } from "discord.js";
import Blacklist from "../../../schema/blacklist.js";
import {
  calculatePerceptualHash,
  extractDirectImageUrls,
  isDirectImageUrl,
} from "../../../utils/imageHash.js";
import { clearBlacklistCache } from "../../../events/blacklistDetection.js";

export default {
  name: "blacklist",
  description: "Manage raid/spam blacklist",
  usage: "add <message-link|message-id|text|image|image-url> <content> [reason] | remove <id> | list",
  cooldown: 3,
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.ModerateMembers],
  category: "Moderation",

  run: async ({ client, message, args, prefix }) => {
    if (!args[0]) {
      return message.reply({
        content: `Usage: \`${prefix}blacklist <add|remove|list> ...\`\n\n` +
          `**Examples:**\n` +
          `\`${prefix}blacklist add message-link <discord message link> [reason]\`\n` +
          `\`${prefix}blacklist add message-id <message ID> [reason]\`\n` +
          `\`${prefix}blacklist add text <pattern> [reason]\`\n` +
          `\`${prefix}blacklist add image <attach image> [reason]\`\n` +
          `\`${prefix}blacklist add image-url <URL> [reason]\`\n` +
          `\`${prefix}blacklist remove <ID>\`\n` +
          `\`${prefix}blacklist list\``,
      });
    }

    const action = args[0].toLowerCase();

    try {
      if (action === "add") {
        await handleAdd(message, args);
      } else if (action === "remove") {
        await handleRemove(message, args);
      } else if (action === "list") {
        await handleList(message);
      } else {
        return message.reply({
          content: `❌ Invalid action. Use \`add\`, \`remove\`, or \`list\``,
        });
      }
    } catch (error) {
      console.error("Error in blacklist command:", error);
      return message.reply({
        content: `❌ Error: ${error.message}`,
      });
    }
  },
};

/**
 * Handle add subcommand
 */
async function handleAdd(message, args) {
  if (!args[1]) {
    return message.reply({
      content: "❌ Please specify what to add: `message-link`, `message-id`, `text`, `image`, or `image-url`",
    });
  }

  const type = args[1].toLowerCase();
  const reason = args.slice(3).join(" ") || "Raid/spam content";

  if (type === "message-link") {
    await handleMessageLink(message, args[2], reason);
  } else if (type === "message-id") {
    await handleMessageId(message, args[2], reason);
  } else if (type === "text") {
    const pattern = args.slice(2).join(" ");
    await handleText(message, pattern, reason);
  } else if (type === "image") {
    await handleImage(message, reason);
  } else if (type === "image-url") {
    await handleImageUrl(message, args[2], reason);
  } else {
    return message.reply({
      content: "❌ Invalid type. Use: `message-link`, `message-id`, `text`, `image`, or `image-url`",
    });
  }
}

/**
 * Handle message link
 */
async function handleMessageLink(message, link, reason) {
  if (!link) {
    return message.reply({ content: "❌ Please provide a message link" });
  }

  const linkRegex =
    /https:\/\/(?:discord\.com|discordapp\.com)\/channels\/(\d+)\/(\d+)\/(\d+)/;
  const match = link.match(linkRegex);

  if (!match) {
    return message.reply({ content: "❌ Invalid message link format" });
  }

  const [, guildId, channelId, messageId] = match;

  if (guildId !== message.guild.id) {
    return message.reply({ content: "❌ Message link must be from this server" });
  }

  const channel = await message.guild.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) {
    return message.reply({ content: "❌ Channel not found or not a text channel" });
  }

  const targetMessage = await channel.messages.fetch(messageId);
  if (!targetMessage) {
    return message.reply({ content: "❌ Message not found" });
  }

  const items = await extractImagesFromMessage(targetMessage);

  if (items.length === 0) {
    return message.reply({
      content: "❌ No images or direct image URLs found in that message.",
    });
  }

  const added = await addItemsToBlacklist(
    message.guild.id,
    items,
    message.author.id,
    reason
  );

  clearBlacklistCache();

  return message.reply({
    content: `✅ Successfully blacklisted ${added} item(s) from that message.`,
  });
}

/**
 * Handle message ID
 */
async function handleMessageId(message, messageId, reason) {
  if (!messageId) {
    return message.reply({ content: "❌ Please provide a message ID" });
  }

  const targetMessage = await message.channel.messages
    .fetch(messageId)
    .catch(() => null);

  if (!targetMessage) {
    return message.reply({ content: "❌ Message not found in this channel" });
  }

  const items = await extractImagesFromMessage(targetMessage);

  if (items.length === 0) {
    return message.reply({
      content: "❌ No images or direct image URLs found in that message.",
    });
  }

  const added = await addItemsToBlacklist(
    message.guild.id,
    items,
    message.author.id,
    reason
  );

  clearBlacklistCache();

  return message.reply({
    content: `✅ Successfully blacklisted ${added} item(s) from that message.`,
  });
}

/**
 * Handle text
 */
async function handleText(message, pattern, reason) {
  if (!pattern || pattern.trim().length === 0) {
    return message.reply({ content: "❌ Text pattern cannot be empty" });
  }

  if (pattern.length > 500) {
    return message.reply({ content: "❌ Text pattern too long (max 500 characters)" });
  }

  const isUrl = pattern.startsWith("http://") || pattern.startsWith("https://");
  const type = isUrl ? "url" : "text";

  const existing = await Blacklist.findOne({
    guildId: message.guild.id,
    type: type,
    content: pattern.toLowerCase(),
  });

  if (existing) {
    return message.reply({ content: "❌ This pattern is already blacklisted" });
  }

  await Blacklist.create({
    guildId: message.guild.id,
    type: type,
    content: pattern.toLowerCase(),
    addedBy: message.author.id,
    reason: reason,
  });

  clearBlacklistCache();

  return message.reply({
    content: `✅ Successfully blacklisted ${type}: \`${pattern}\``,
  });
}

/**
 * Handle image attachment
 */
async function handleImage(message, reason) {
  const attachment = message.attachments.first();

  if (!attachment) {
    return message.reply({ content: "❌ Please attach an image to blacklist" });
  }

  if (!attachment.contentType?.startsWith("image/")) {
    return message.reply({ content: "❌ Attachment must be an image" });
  }

  const hash = await calculatePerceptualHash(attachment.url);

  const existing = await Blacklist.findOne({
    guildId: message.guild.id,
    type: "image",
    content: hash,
  });

  if (existing) {
    return message.reply({ content: "❌ This image is already blacklisted" });
  }

  await Blacklist.create({
    guildId: message.guild.id,
    type: "image",
    content: hash,
    imageUrl: attachment.url,
    addedBy: message.author.id,
    reason: reason,
  });

  clearBlacklistCache();

  return message.reply({
    content: `✅ Successfully blacklisted image`,
  });
}

/**
 * Handle image URL
 */
async function handleImageUrl(message, imageUrl, reason) {
  if (!imageUrl) {
    return message.reply({ content: "❌ Please provide an image URL" });
  }

  try {
    new URL(imageUrl);
  } catch (error) {
    return message.reply({ content: "❌ Invalid URL format" });
  }

  if (!isDirectImageUrl(imageUrl)) {
    return message.reply({
      content: "❌ URL must be a direct image link ending in .png, .jpg, .jpeg, .gif, or .webp",
    });
  }

  let hash;
  try {
    hash = await calculatePerceptualHash(imageUrl);
  } catch (error) {
    console.error("Error hashing image URL:", error);
    return message.reply({
      content: "❌ Failed to process image from URL. Ensure it's publicly accessible and valid.",
    });
  }

  const existing = await Blacklist.findOne({
    guildId: message.guild.id,
    type: "image",
    content: hash,
  });

  if (existing) {
    return message.reply({ content: "❌ This image is already blacklisted" });
  }

  await Blacklist.create({
    guildId: message.guild.id,
    type: "image",
    content: hash,
    imageUrl: imageUrl,
    addedBy: message.author.id,
    reason: reason,
  });

  clearBlacklistCache();

  return message.reply({
    content: `✅ Successfully blacklisted image from URL`,
  });
}

/**
 * Handle remove
 */
async function handleRemove(message, args) {
  const id = args[1];

  if (!id) {
    return message.reply({ content: "❌ Please provide a blacklist entry ID" });
  }

  const entry = await Blacklist.findOneAndDelete({
    _id: id,
    guildId: message.guild.id,
  });

  if (!entry) {
    return message.reply({ content: "❌ Blacklist entry not found" });
  }

  clearBlacklistCache();

  return message.reply({
    content: `✅ Removed blacklist entry (Type: ${entry.type}, Triggers: ${entry.triggerCount})`,
  });
}

/**
 * Handle list
 */
async function handleList(message) {
  const entries = await Blacklist.find({
    guildId: message.guild.id,
  })
    .sort({ addedAt: -1 })
    .limit(50);

  if (entries.length === 0) {
    return message.reply({ content: "No blacklisted items found." });
  }

  const embed = new EmbedBuilder()
    .setTitle("🚫 Blacklist")
    .setColor("Red")
    .setDescription(
      `Showing ${entries.length} blacklisted item(s)\nUse \`blacklist remove <id>\` to remove an entry`
    )
    .setTimestamp();

  const byType = {
    text: entries.filter((e) => e.type === "text"),
    url: entries.filter((e) => e.type === "url"),
    image: entries.filter((e) => e.type === "image"),
  };

  if (byType.text.length > 0) {
    const textList = byType.text
      .slice(0, 10)
      .map(
        (e) =>
          `\`${e._id.toString().slice(-6)}\` - \`${e.content.slice(0, 50)}${e.content.length > 50 ? "..." : ""}\` (${e.triggerCount} triggers)`
      )
      .join("\n");
    embed.addFields({
      name: `📝 Text Patterns (${byType.text.length})`,
      value: textList,
      inline: false,
    });
  }

  if (byType.url.length > 0) {
    const urlList = byType.url
      .slice(0, 10)
      .map(
        (e) =>
          `\`${e._id.toString().slice(-6)}\` - \`${e.content.slice(0, 50)}${e.content.length > 50 ? "..." : ""}\` (${e.triggerCount} triggers)`
      )
      .join("\n");
    embed.addFields({
      name: `🔗 URLs (${byType.url.length})`,
      value: urlList,
      inline: false,
    });
  }

  if (byType.image.length > 0) {
    const imageList = byType.image
      .slice(0, 10)
      .map(
        (e) =>
          `\`${e._id.toString().slice(-6)}\` - Hash: \`${e.content.slice(0, 16)}...\` (${e.triggerCount} triggers)`
      )
      .join("\n");
    embed.addFields({
      name: `🖼️ Images (${byType.image.length})`,
      value: imageList,
      inline: false,
    });
  }

  return message.reply({ embeds: [embed] });
}

/**
 * Extract images and direct image URLs from a message
 */
async function extractImagesFromMessage(message) {
  const items = [];

  for (const attachment of message.attachments.values()) {
    if (attachment.contentType?.startsWith("image/")) {
      try {
        const hash = await calculatePerceptualHash(attachment.url);
        items.push({
          type: "image",
          content: hash,
          imageUrl: attachment.url,
        });
      } catch (error) {
        console.error("Error hashing attachment:", error);
      }
    }
  }

  if (message.content) {
    const imageUrls = extractDirectImageUrls(message.content);
    for (const url of imageUrls) {
      try {
        const hash = await calculatePerceptualHash(url);
        items.push({
          type: "image",
          content: hash,
          imageUrl: url,
        });
      } catch (error) {
        console.error("Error hashing image URL:", error);
      }
    }
  }

  return items;
}

/**
 * Add multiple items to blacklist
 */
async function addItemsToBlacklist(guildId, items, userId, reason) {
  let added = 0;

  for (const item of items) {
    const existing = await Blacklist.findOne({
      guildId: guildId,
      type: item.type,
      content: item.content,
    });

    if (!existing) {
      await Blacklist.create({
        guildId: guildId,
        type: item.type,
        content: item.content,
        imageUrl: item.imageUrl,
        addedBy: userId,
        reason: reason,
      });
      added++;
    }
  }

  return added;
}
