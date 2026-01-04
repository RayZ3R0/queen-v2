import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import Blacklist from "../../../schema/blacklist.js";
import {
  calculatePerceptualHash,
  extractDirectImageUrls,
  isDirectImageUrl,
} from "../../../utils/imageHash.js";
import { clearBlacklistCache } from "../../../events/blacklistDetection.js";

export default {
  name: "blacklist",
  data: new SlashCommandBuilder()
    .setName("blacklist")
    .setDescription("Manage raid/spam blacklist")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup((group) =>
      group
        .setName("add")
        .setDescription("Add content to blacklist")
        .addSubcommand((sub) =>
          sub
            .setName("message-link")
            .setDescription("Blacklist images from a message link")
            .addStringOption((opt) =>
              opt
                .setName("link")
                .setDescription("Discord message link")
                .setRequired(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("reason")
                .setDescription("Reason for blacklisting")
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("message-id")
            .setDescription("Blacklist images from a message ID (current channel)")
            .addStringOption((opt) =>
              opt
                .setName("id")
                .setDescription("Message ID")
                .setRequired(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("reason")
                .setDescription("Reason for blacklisting")
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("text")
            .setDescription("Manually blacklist text/URL pattern")
            .addStringOption((opt) =>
              opt
                .setName("pattern")
                .setDescription("Text or URL to blacklist")
                .setRequired(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("reason")
                .setDescription("Reason for blacklisting")
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("image")
            .setDescription("Manually blacklist an image")
            .addAttachmentOption((opt) =>
              opt
                .setName("attachment")
                .setDescription("Image to blacklist")
                .setRequired(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("reason")
                .setDescription("Reason for blacklisting")
                .setRequired(false)
            )
        )
        .addSubcommand((sub) =>
          sub
            .setName("image-url")
            .setDescription("Blacklist an image from URL")
            .addStringOption((opt) =>
              opt
                .setName("url")
                .setDescription("Direct image URL (must end in .png, .jpg, etc.)")
                .setRequired(true)
            )
            .addStringOption((opt) =>
              opt
                .setName("reason")
                .setDescription("Reason for blacklisting")
                .setRequired(false)
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove an item from blacklist")
        .addStringOption((opt) =>
          opt
            .setName("id")
            .setDescription("Blacklist entry ID (from /blacklist list)")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("View all blacklisted items")
    ),
  category: "Moderation",
  botPermissions: [PermissionFlagsBits.ModerateMembers],

  run: async ({ client, interaction }) => {
    await interaction.deferReply({ ephemeral: true });

    try {
      const subcommandGroup = interaction.options.getSubcommandGroup();
      const subcommand = interaction.options.getSubcommand();

      // Handle "add" subcommand group
      if (subcommandGroup === "add") {
        const reason =
          interaction.options.getString("reason") || "Raid/spam content";

        if (subcommand === "message-link") {
          await handleMessageLink(interaction, reason);
        } else if (subcommand === "message-id") {
          await handleMessageId(interaction, reason);
        } else if (subcommand === "text") {
          await handleText(interaction, reason);
        } else if (subcommand === "image") {
          await handleImage(interaction, reason);
        } else if (subcommand === "image-url") {
          await handleImageUrl(interaction, reason);
        }
      }
      // Handle "remove" subcommand
      else if (subcommand === "remove") {
        await handleRemove(interaction);
      }
      // Handle "list" subcommand
      else if (subcommand === "list") {
        await handleList(interaction);
      }
    } catch (error) {
      console.error("Error in blacklist command:", error);
      await interaction
        .editReply({
          content: `❌ An error occurred: ${error.message}`,
          ephemeral: true,
        })
        .catch(console.error);
    }
  },
};

/**
 * Handle blacklisting from message link
 */
async function handleMessageLink(interaction, reason) {
  const link = interaction.options.getString("link");

  // Parse message link: https://discord.com/channels/GUILD/CHANNEL/MESSAGE
  const linkRegex =
    /https:\/\/(?:discord\.com|discordapp\.com)\/channels\/(\d+)\/(\d+)\/(\d+)/;
  const match = link.match(linkRegex);

  if (!match) {
    throw new Error("Invalid message link format");
  }

  const [, guildId, channelId, messageId] = match;

  if (guildId !== interaction.guild.id) {
    throw new Error("Message link must be from this server");
  }

  // Fetch the message
  const channel = await interaction.guild.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) {
    throw new Error("Channel not found or not a text channel");
  }

  const message = await channel.messages.fetch(messageId);
  if (!message) {
    throw new Error("Message not found");
  }

  // Extract images and direct image URLs
  const items = await extractImagesFromMessage(message);

  if (items.length === 0) {
    throw new Error(
      "No images or direct image URLs found in that message. Use `/blacklist add text` to manually add text patterns."
    );
  }

  // Add to blacklist
  const added = await addItemsToBlacklist(
    interaction.guild.id,
    items,
    interaction.user.id,
    reason
  );

  await interaction.editReply({
    content: `✅ Successfully blacklisted ${added} item(s) from that message.`,
    ephemeral: true,
  });
}

/**
 * Handle blacklisting from message ID
 */
async function handleMessageId(interaction, reason) {
  const messageId = interaction.options.getString("id");

  // Fetch the message from current channel
  const message = await interaction.channel.messages
    .fetch(messageId)
    .catch(() => null);

  if (!message) {
    throw new Error(
      "Message not found in this channel. Make sure to use this command in the same channel as the message."
    );
  }

  // Extract images and direct image URLs
  const items = await extractImagesFromMessage(message);

  if (items.length === 0) {
    throw new Error(
      "No images or direct image URLs found in that message. Use `/blacklist add text` to manually add text patterns."
    );
  }

  // Add to blacklist
  const added = await addItemsToBlacklist(
    interaction.guild.id,
    items,
    interaction.user.id,
    reason
  );

  // Clear cache
  clearBlacklistCache();

  await interaction.editReply({
    content: `✅ Successfully blacklisted ${added} item(s) from that message.`,
    ephemeral: true,
  });
}

/**
 * Handle manual text blacklisting
 */
async function handleText(interaction, reason) {
  const pattern = interaction.options.getString("pattern").trim();

  if (!pattern || pattern.length === 0) {
    throw new Error("Text pattern cannot be empty");
  }

  if (pattern.length > 500) {
    throw new Error("Text pattern too long (max 500 characters)");
  }

  // Determine if it's a URL or text
  const isUrl = pattern.startsWith("http://") || pattern.startsWith("https://");
  const type = isUrl ? "url" : "text";

  // Check if already exists
  const existing = await Blacklist.findOne({
    guildId: interaction.guild.id,
    type: type,
    content: pattern.toLowerCase(), // Store lowercase for case-insensitive matching
  });

  if (existing) {
    throw new Error("This pattern is already blacklisted");
  }

  // Add to blacklist
  await Blacklist.create({
    guildId: interaction.guild.id,
    type: type,
    content: pattern.toLowerCase(),
    addedBy: interaction.user.id,
    reason: reason,
  });

  // Clear cache
  clearBlacklistCache();

  await interaction.editReply({
    content: `✅ Successfully blacklisted ${type}: \`${pattern}\``,
    ephemeral: true,
  });
}

/**
 * Handle manual image blacklisting
 */
async function handleImage(interaction, reason) {
  const attachment = interaction.options.getAttachment("attachment");

  if (!attachment.contentType?.startsWith("image/")) {
    throw new Error("Attachment must be an image");
  }

  // Calculate perceptual hash
  const hash = await calculatePerceptualHash(attachment.url);

  // Check if already exists
  const existing = await Blacklist.findOne({
    guildId: interaction.guild.id,
    type: "image",
    content: hash,
  });

  if (existing) {
    throw new Error("This image is already blacklisted");
  }

  // Add to blacklist
  await Blacklist.create({
    guildId: interaction.guild.id,
    type: "image",
    content: hash,
    imageUrl: attachment.url,
    addedBy: interaction.user.id,
    reason: reason,
  });

  // Clear cache
  clearBlacklistCache();

  await interaction.editReply({
    content: `✅ Successfully blacklisted image`,
    ephemeral: true,
  });
}

/**
 * Handle image URL blacklisting
 */
async function handleImageUrl(interaction, reason) {
  const imageUrl = interaction.options.getString("url").trim();

  // Validate URL format
  try {
    new URL(imageUrl);
  } catch (error) {
    throw new Error("Invalid URL format");
  }

  // Check if it's a direct image URL
  if (!isDirectImageUrl(imageUrl)) {
    throw new Error(
      "URL must be a direct image link ending in .png, .jpg, .jpeg, .gif, or .webp"
    );
  }

  // Try to download and hash the image
  let hash;
  try {
    hash = await calculatePerceptualHash(imageUrl);
  } catch (error) {
    console.error("Error hashing image URL:", error);
    throw new Error(
      `Failed to process image from URL. Please ensure:\n` +
        `- The URL is publicly accessible\n` +
        `- The URL points to a valid image\n` +
        `- The image file is not corrupted`
    );
  }

  // Check if already exists
  const existing = await Blacklist.findOne({
    guildId: interaction.guild.id,
    type: "image",
    content: hash,
  });

  if (existing) {
    throw new Error("This image is already blacklisted");
  }

  // Add to blacklist
  await Blacklist.create({
    guildId: interaction.guild.id,
    type: "image",
    content: hash,
    imageUrl: imageUrl,
    addedBy: interaction.user.id,
    reason: reason,
  });

  // Clear cache
  clearBlacklistCache();

  await interaction.editReply({
    content: `✅ Successfully blacklisted image from URL`,
    ephemeral: true,
  });
}

/**
 * Handle removing from blacklist
 */
async function handleRemove(interaction) {
  const id = interaction.options.getString("id");

  // If ID is short (6 chars), find by matching suffix
  let entry;
  if (id.length === 6) {
    const allEntries = await Blacklist.find({
      guildId: interaction.guild.id,
    });
    
    entry = allEntries.find(e => e._id.toString().endsWith(id));
    
    if (!entry) {
      throw new Error("Blacklist entry not found. Make sure you're using the 6-character ID from `/blacklist list`");
    }
    
    await Blacklist.findByIdAndDelete(entry._id);
  } else {
    // Full ID provided
    entry = await Blacklist.findOneAndDelete({
      _id: id,
      guildId: interaction.guild.id,
    });
    
    if (!entry) {
      throw new Error("Blacklist entry not found");
    }
  }

  // Clear cache
  clearBlacklistCache();

  await interaction.editReply({
    content: `✅ Removed blacklist entry (Type: ${entry.type}, Triggers: ${entry.triggerCount})`,
    ephemeral: true,
  });
}

/**
 * Handle listing blacklist
 */
async function handleList(interaction) {
  const entries = await Blacklist.find({
    guildId: interaction.guild.id,
  })
    .sort({ addedAt: -1 })
    .limit(50);

  if (entries.length === 0) {
    await interaction.editReply({
      content: "No blacklisted items found.",
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("🚫 Blacklist")
    .setColor("Red")
    .setDescription(
      `Showing ${entries.length} blacklisted item(s)\nUse \`/blacklist remove <id>\` to remove an entry`
    )
    .setTimestamp();

  // Group by type
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

  await interaction.editReply({ embeds: [embed], ephemeral: true });
}

/**
 * Extract images and direct image URLs from a message
 */
async function extractImagesFromMessage(message) {
  const items = [];

  // Extract attached images
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

  // Extract direct image URLs from content
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
    // Check if already exists
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
