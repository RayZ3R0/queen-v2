import {
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  WebhookClient,
  ChannelType,
  AttachmentBuilder,
  AuditLogEvent,
} from "discord.js";
import chalk from "chalk";
import winston from "winston";
import axios from "axios";
import archiver from "archiver";
import { createWriteStream, promises as fs } from "fs";
import { join } from "path";
import { client } from "../bot.js"; // Ensure your bot.js exports your initialized client

// --------------------- Logger Setup --------------------- //
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "antiCrashLog.log" }),
  ],
  format: winston.format.printf(
    (log) => `[${log.level.toLowerCase()}] - ${log.message}`
  ),
});

// --------------------- Anti-Crash Handlers --------------------- //
process.on("unhandledRejection", (reason, promise) => {
  logger.error(
    chalk.blueBright("[antiCrash] ") +
      chalk.red("Unhandled rejection detected.")
  );
  logger.error(reason.stack || reason);
});
process.on("uncaughtException", (err, origin) => {
  logger.error(
    chalk.blueBright("[antiCrash] ") + chalk.red("Uncaught exception detected.")
  );
  logger.error(err.stack || err);
});
process.on("uncaughtExceptionMonitor", (err, origin) => {
  logger.error(
    chalk.blueBright("[antiCrash] ") +
      chalk.red("Uncaught exception (Monitor) detected.")
  );
  logger.error(err.stack || err);
});

// --------------------- Helper Functions --------------------- //
/**
 * Generates a random hexadecimal color.
 */
// Updated getRandomColor function:
const getRandomColor = () =>
  `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0")}`;

// --------------------- Event: Channel Create --------------------- //
client.on("channelCreate", async (channel) => {
  try {
    const embed = new EmbedBuilder()
      .setTitle("Channel Created")
      .setDescription(`**${channel.name}**`)
      .setTimestamp()
      .setColor(getRandomColor())
      .setFooter({ text: channel.id });
    logger.info(`channelCreate: ${channel.name}`);
    const logChannel = client.channels.cache.get("901841601603731456");
    if (logChannel) await logChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error("Error in channelCreate event: " + (err.stack || err));
  }
});

// --------------------- Event: Channel Delete --------------------- //
client.on("channelDelete", async (channel) => {
  try {
    const embed = new EmbedBuilder()
      .setTitle("Channel Deleted")
      .setDescription(`**${channel.name}**`)
      .setTimestamp()
      .setColor(getRandomColor())
      .setFooter({ text: channel.id });
    logger.info(`channelDelete: ${channel.name}`);
    const logChannel = client.channels.cache.get("901841601603731456");
    if (logChannel) await logChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error("Error in channelDelete event: " + (err.stack || err));
  }
});

// --------------------- Event: Channel Pins Update --------------------- //
client.on("channelPinsUpdate", async (channel, time) => {
  try {
    logger.info(`channelPinsUpdate: ${channel.name} at ${time}`);
    const embed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setDescription(
        `Channel pins updated:\n**Channel:** ${channel.name}\n**Time:** ${time}`
      )
      .setTimestamp();
    const logChannel = client.channels.cache.get("901841601603731456");
    if (logChannel) await logChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error("Error in channelPinsUpdate event: " + (err.stack || err));
  }
});

// --------------------- Event: Emoji Create --------------------- //
client.on("emojiCreate", async (emoji) => {
  try {
    const imageUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${
      emoji.animated ? "gif" : "png"
    }?size=64`;
    const embed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle(`Emoji Created: ${emoji.toString()}`)
      .setDescription(`**Name:** ${emoji.name}\n**ID:** ${emoji.id}`)
      .setThumbnail(imageUrl)
      .setTimestamp();
    const logChannel = client.channels.cache.get("902045721983844382");
    if (logChannel) await logChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error("Error in emojiCreate event: " + (err.stack || err));
  }
});

// --------------------- Event: Emoji Delete --------------------- //
client.on("emojiDelete", async (emoji) => {
  try {
    const imageUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${
      emoji.animated ? "gif" : "png"
    }?size=64`;
    const embed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle("Emoji Deleted")
      .setDescription(`**Name:** ${emoji.name}\n**ID:** ${emoji.id}`)
      .setThumbnail(imageUrl)
      .setTimestamp();
    const logChannel = client.channels.cache.get("902045721983844382");
    if (logChannel) await logChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error("Error in emojiDelete event: " + (err.stack || err));
  }
});

// --------------------- Event: Emoji Update --------------------- //
client.on("emojiUpdate", async (oldEmoji, newEmoji) => {
  try {
    const embed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle("Emoji Updated")
      .setDescription(
        `**Before:** ${oldEmoji.name}\n**After:** ${newEmoji.name}`
      )
      .setThumbnail(
        `https://cdn.discordapp.com/emojis/${newEmoji.id}.${
          newEmoji.animated ? "gif" : "png"
        }?size=64`
      )
      .setTimestamp()
      .setFooter({ text: newEmoji.id });
    const logChannel = client.channels.cache.get("902045721983844382");
    if (logChannel) await logChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error("Error in emojiUpdate event: " + (err.stack || err));
  }
});

// --------------------- Event: Guild Member Add --------------------- //
client.on("guildMemberAdd", async (member) => {
  try {
    if (member.user.bot) return;
    const embed = new EmbedBuilder()
      .setColor("#ff0000")
      .setTitle(`**${member.displayName}** welcome to ${member.guild.name}!`)
      .setDescription(`<@${member.id}>, welcome to the server!`)
      .addFields({
        name: "\u200b",
        value:
          "- Head over to the rules channel and read all the rules.\n" +
          "- Check out the roles channel to get some roles.\n" +
          "- Start chatting in the general channel.\n" +
          "- Visit the support channel for help.",
      })
      .setImage("https://i.imgur.com/5bpI2IG.png")
      .setThumbnail(member.displayAvatarURL({ dynamic: true, size: 1024 }))
      .setTimestamp();
    const welcomeChannel = client.channels.cache.get("775700237481410560");
    if (welcomeChannel) await welcomeChannel.send({ embeds: [embed] });

    // Add default roles (update role IDs as needed)
    const roleIds = [
      "747480425114632294",
      "956474792834400286",
      "901444353552166972",
      "901443526976503819",
      "901444030490083338",
      "901444119468068865",
      "911536167365799937",
      "1252591088410034257",
    ];
    for (const roleId of roleIds) {
      try {
        await member.roles.add(roleId);
      } catch (err) {
        logger.error(
          `Error adding role ${roleId} to member ${member.id}: ${err}`
        );
      }
    }
  } catch (err) {
    logger.error("Error in guildMemberAdd event: " + (err.stack || err));
  }
});

// --------------------- Event: Guild Member Remove --------------------- //
client.on("guildMemberRemove", async (member) => {
  try {
    if (member.user.bot) return;
    const embed = new EmbedBuilder()
      .setColor("#ff0000")
      .setTitle(`**${member.displayName}** has left ${member.guild.name}`)
      .setImage("https://i.imgur.com/O2r9YJr.png")
      .setTimestamp();
    const logChannel = client.channels.cache.get("901354934795141140");
    if (logChannel) await logChannel.send({ embeds: [embed] });
  } catch (err) {
    logger.error("Error in guildMemberRemove event: " + (err.stack || err));
  }
});

// --------------------- Helper Functions --------------------- //
/**
 * Escapes special regex characters from a string.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --------------------- Event: Guild Update --------------------- //
client.on("guildUpdate", async (oldGuild, newGuild) => {
  try {
    const oldName = oldGuild.name;
    const newName = newGuild.name;
    const newIcon = newGuild.iconURL({ dynamic: true, size: 1024 });
    const oldIcon = oldGuild.iconURL({ dynamic: true, size: 1024 });
    const logChannel = client.channels.cache.get("902045721983844382");

    if (oldName !== newName && logChannel) {
      const embed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle("Guild Name Changed")
        .addFields(
          { name: "Previous Name", value: oldName, inline: true },
          { name: "New Name", value: newName, inline: true }
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }

    if (oldIcon !== newIcon && logChannel) {
      const embed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle("Guild Icon Changed")
        .setThumbnail(oldIcon)
        .setImage(newIcon)
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
  } catch (err) {
    logger.error("Error in guildUpdate event: " + (err.stack || err));
  }
});

// --------------------- Event: Message Delete --------------------- //
client.on("messageDelete", async (message) => {
  try {
    // Filter: Skip if no author (partial), bot messages, or DMs
    if (!message.author || message.author.bot || message.channel.type === ChannelType.DM) return;
    
    const logChannel = client.channels.cache.get("901841617449799680");
    if (!logChannel) return;

    const messageAge = Date.now() - message.createdTimestamp;
    const ageString = messageAge < 60000 
      ? `${Math.floor(messageAge / 1000)}s ago`
      : messageAge < 3600000
      ? `${Math.floor(messageAge / 60000)}m ago`
      : `${Math.floor(messageAge / 3600000)}h ago`;

    const embed = new EmbedBuilder()
      .setColor("#ff6b6b")
      .setAuthor({
        name: `${message.author.tag} (${message.author.id})`,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .setDescription(
        `**Message deleted in** ${message.channel}\n` +
        `**Author:** ${message.author} (\`${message.author.id}\`)\n` +
        `**Message Age:** ${ageString}\n` +
        `**Sent:** <t:${Math.floor(message.createdTimestamp / 1000)}:F>`
      )
      .setFooter({ text: `Message ID: ${message.id}` })
      .setTimestamp();

    // Add content if exists
    if (message.content) {
      const content = message.content.length > 1024 
        ? message.content.substring(0, 1021) + "..."
        : message.content;
      embed.addFields({ name: "Content", value: `\`\`\`${content}\`\`\`` });
    }

    // Handle stickers
    if (message.stickers.size > 0) {
      const stickerNames = message.stickers.map(s => s.name).join(", ");
      if (stickerNames.length > 0) {
        embed.addFields({ name: "Stickers", value: stickerNames });
      }
    }

    // Handle embeds
    if (message.embeds.length > 0) {
      const embedInfo = message.embeds.map((e, i) => 
        `Embed ${i + 1}: ${e.title || e.description?.substring(0, 50) || "[No title]"}`
      ).join("\n");
      if (embedInfo.length > 0) {
        embed.addFields({ name: `Embeds (${message.embeds.length})`, value: embedInfo });
      }
    }

    // Download and attach ALL attachments
    const attachmentFiles = [];
    if (message.attachments.size > 0) {
      const attachmentNames = message.attachments.map(a => a.name).join("\n");
      if (attachmentNames.length > 0 && attachmentNames.length <= 1024) {
        embed.addFields({ 
          name: `Attachments (${message.attachments.size})`, 
          value: attachmentNames
        });
      } else if (attachmentNames.length > 1024) {
        embed.addFields({ 
          name: `Attachments (${message.attachments.size})`, 
          value: attachmentNames.substring(0, 1021) + "..."
        });
      }

      for (const attachment of message.attachments.values()) {
        try {
          const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
          const buffer = Buffer.from(response.data);
          attachmentFiles.push(new AttachmentBuilder(buffer, { name: attachment.name }));
        } catch (err) {
          logger.error(`Failed to download attachment ${attachment.name}: ${err.message}`);
        }
      }
    }

    // Try to get context messages for jump link
    try {
      const messages = await message.channel.messages.fetch({ limit: 1 });
      if (messages.size > 0) {
        const contextMsg = messages.first();
        embed.addFields({ 
          name: "Context", 
          value: `[Jump to channel area](https://discord.com/channels/${message.guild.id}/${message.channel.id}/${contextMsg.id})` 
        });
      }
    } catch (err) {
      // Context fetch failed, continue without it
    }

    await logChannel.send({ embeds: [embed], files: attachmentFiles });
  } catch (err) {
    logger.error("Error in messageDelete event: " + (err.stack || err));
  }
});

// --------------------- Event: Message Update --------------------- //
client.on("messageUpdate", async (oldMessage, newMessage) => {
  try {
    // Filter: Skip if no author (partial), bot messages, or DMs
    if (!oldMessage.author || oldMessage.author.bot || oldMessage.channel.type === ChannelType.DM) return;
    
    // Only log if content actually changed (ignore embed updates, pins, etc.)
    if (oldMessage.content === newMessage.content) return;
    
    const logChannel = client.channels.cache.get("901841617449799680");
    if (!logChannel) return;

    const maxLength = 1024;
    const oldContent = oldMessage.content || "[No content]";
    const newContent = newMessage.content || "[No content]";
    
    const embed = new EmbedBuilder()
      .setColor("#ffa500")
      .setAuthor({
        name: `${oldMessage.author.tag} (${oldMessage.author.id})`,
        iconURL: oldMessage.author.displayAvatarURL({ dynamic: true }),
      })
      .setDescription(
        `**Message edited in** ${newMessage.channel}\n` +
        `**Author:** ${newMessage.author}\n` +
        `**Original:** <t:${Math.floor(oldMessage.createdTimestamp / 1000)}:F>\n` +
        `**Edited:** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
        `**[Jump to Message](https://discord.com/channels/${newMessage.guild.id}/${newMessage.channel.id}/${newMessage.id})**`
      )
      .setFooter({ text: `Message ID: ${newMessage.id}` })
      .setTimestamp();

    // Check if we need to use a file
    const totalLength = oldContent.length + newContent.length;
    
    if (totalLength > maxLength * 2) {
      // Create a formatted text file
      const fileContent = 
        `Message Edit Log\n` +
        `================\n\n` +
        `Author: ${oldMessage.author.tag} (${oldMessage.author.id})\n` +
        `Channel: #${newMessage.channel.name}\n` +
        `Message ID: ${newMessage.id}\n` +
        `Original Time: ${new Date(oldMessage.createdTimestamp).toLocaleString()}\n` +
        `Edit Time: ${new Date().toLocaleString()}\n` +
        `Jump Link: https://discord.com/channels/${newMessage.guild.id}/${newMessage.channel.id}/${newMessage.id}\n\n` +
        `BEFORE:\n` +
        `${"-".repeat(80)}\n` +
        `${oldContent}\n\n` +
        `AFTER:\n` +
        `${"-".repeat(80)}\n` +
        `${newContent}`;
      
      const attachment = new AttachmentBuilder(Buffer.from(fileContent, 'utf-8'), {
        name: `message-edit-${newMessage.id}.txt`
      });
      
      embed.addFields({ 
        name: "Content", 
        value: "Message too long - see attached file" 
      });
      
      await logChannel.send({ embeds: [embed], files: [attachment] });
    } else {
      // Display inline with truncation if needed
      const beforeText = oldContent.length > maxLength 
        ? oldContent.substring(0, maxLength - 3) + "..."
        : oldContent;
      const afterText = newContent.length > maxLength 
        ? newContent.substring(0, maxLength - 3) + "..."
        : newContent;
      
      embed.addFields(
        { name: "Before", value: `\`\`\`${beforeText}\`\`\`` },
        { name: "After", value: `\`\`\`${afterText}\`\`\`` }
      );
      
      await logChannel.send({ embeds: [embed] });
    }
  } catch (err) {
    logger.error("Error in messageUpdate event: " + (err.stack || err));
  }
});

// --------------------- Event: Message Delete Bulk --------------------- //
client.on("messageDeleteBulk", async (messages) => {
  try {
    logger.info(`Bulk deletion of ${messages.size} messages detected.`);
    const logChannel = client.channels.cache.get("901841617449799680");
    if (!logChannel) return;

    // Get first message for channel reference
    const firstMessage = messages.first();
    if (!firstMessage) return;

    // Try to get audit log to find who performed the bulk delete
    let executor = null;
    try {
      const auditLogs = await firstMessage.guild.fetchAuditLogs({
        type: AuditLogEvent.MessageBulkDelete,
        limit: 1,
      });
      const bulkDeleteLog = auditLogs.entries.first();
      if (bulkDeleteLog && Date.now() - bulkDeleteLog.createdTimestamp < 5000) {
        executor = bulkDeleteLog.executor;
      }
    } catch (err) {
      logger.error(`Failed to fetch audit logs: ${err.message}`);
    }

    // Build summary embed
    const summaryEmbed = new EmbedBuilder()
      .setColor("#dc143c")
      .setTitle("🗑️ Bulk Message Deletion")
      .setDescription(
        `**Channel:** ${firstMessage.channel}\n` +
        `**Messages Deleted:** ${messages.size}\n` +
        `**Performed by:** ${executor ? `${executor.tag} (${executor.id})` : "Unknown"}\n` +
        `**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`
      )
      .setTimestamp();

    // Count message statistics
    const authorCount = new Map();
    const withAttachments = [];
    const withEmbeds = [];
    const withStickers = [];
    
    messages.forEach(msg => {
      if (msg.author) {
        authorCount.set(msg.author.id, (authorCount.get(msg.author.id) || 0) + 1);
      }
      if (msg.attachments.size > 0) withAttachments.push(msg);
      if (msg.embeds.length > 0) withEmbeds.push(msg);
      if (msg.stickers.size > 0) withStickers.push(msg);
    });

    // Add statistics
    const topAuthors = Array.from(authorCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => `<@${id}>: ${count}`)
      .join("\n");
    
    if (topAuthors) {
      summaryEmbed.addFields({ name: "Top Authors", value: topAuthors, inline: true });
    }
    
    summaryEmbed.addFields(
      { name: "With Attachments", value: `${withAttachments.length}`, inline: true },
      { name: "With Embeds", value: `${withEmbeds.length}`, inline: true }
    );

    if (executor) {
      summaryEmbed.setFooter({ 
        text: `Deleted by ${executor.tag}`, 
        iconURL: executor.displayAvatarURL({ dynamic: true }) 
      });
    }

    // Create temporary directory for zip
    const tempDir = join(process.cwd(), 'temp', `bulk-delete-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    try {
      // Sort messages by timestamp
      const sortedMessages = Array.from(messages.values()).sort(
        (a, b) => a.createdTimestamp - b.createdTimestamp
      );

      // Create messages log file
      let messagesLog = `BULK DELETE LOG\n`;
      messagesLog += `${"=".repeat(80)}\n\n`;
      messagesLog += `Channel: #${firstMessage.channel.name} (${firstMessage.channel.id})\n`;
      messagesLog += `Guild: ${firstMessage.guild.name}\n`;
      messagesLog += `Total Messages: ${messages.size}\n`;
      messagesLog += `Deleted by: ${executor ? `${executor.tag} (${executor.id})` : "Unknown"}\n`;
      messagesLog += `Timestamp: ${new Date().toLocaleString()}\n`;
      messagesLog += `${"=".repeat(80)}\n\n`;

      // Process each message
      let attachmentCount = 0;
      for (const [index, msg] of sortedMessages.entries()) {
        messagesLog += `\nMESSAGE ${index + 1}\n`;
        messagesLog += `${"-".repeat(80)}\n`;
        messagesLog += `Author: ${msg.author?.tag || "Unknown"} (${msg.author?.id || "N/A"})\n`;
        messagesLog += `Message ID: ${msg.id}\n`;
        messagesLog += `Timestamp: ${new Date(msg.createdTimestamp).toLocaleString()}\n`;
        messagesLog += `Content: ${msg.content || "[No text content]"}\n`;
        
        if (msg.stickers.size > 0) {
          messagesLog += `Stickers: ${Array.from(msg.stickers.values()).map(s => s.name).join(", ")}\n`;
        }
        
        if (msg.embeds.length > 0) {
          messagesLog += `Embeds: ${msg.embeds.length}\n`;
          msg.embeds.forEach((e, i) => {
            messagesLog += `  Embed ${i + 1}: ${e.title || e.description?.substring(0, 50) || "[No title]"}\n`;
          });
        }

        // Download attachments
        if (msg.attachments.size > 0) {
          messagesLog += `Attachments: ${msg.attachments.size}\n`;
          for (const attachment of msg.attachments.values()) {
            attachmentCount++;
            const safeFilename = `${index + 1}_${attachmentCount}_${attachment.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            messagesLog += `  - ${attachment.name} (saved as: ${safeFilename})\n`;
            
            try {
              const response = await axios.get(attachment.url, { 
                responseType: 'arraybuffer',
                timeout: 10000 
              });
              await fs.writeFile(join(tempDir, safeFilename), Buffer.from(response.data));
            } catch (err) {
              messagesLog += `    [Failed to download: ${err.message}]\n`;
              logger.error(`Failed to download attachment ${attachment.name}: ${err.message}`);
            }
          }
        }
        messagesLog += `\n`;
      }

      // Write messages log
      await fs.writeFile(join(tempDir, 'messages.txt'), messagesLog);

      // Create zip file
      const zipPath = join(process.cwd(), 'temp', `bulk-delete-${Date.now()}.zip`);
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      await new Promise((resolve, reject) => {
        output.on('close', resolve);
        output.on('error', reject);
        archive.on('error', reject);
        
        archive.pipe(output);
        archive.directory(tempDir, false);
        archive.finalize();
      });

      // Send to log channel
      const zipAttachment = new AttachmentBuilder(zipPath, {
        name: `bulk-delete-${firstMessage.channel.name}-${Date.now()}.zip`
      });

      await logChannel.send({ embeds: [summaryEmbed], files: [zipAttachment] });

      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });
      await fs.unlink(zipPath).catch(() => {});
      
    } catch (err) {
      logger.error(`Error creating zip file: ${err.stack || err}`);
      // Cleanup on error
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      
      // Send summary embed without zip
      await logChannel.send({ embeds: [summaryEmbed] });
    }
  } catch (error) {
    logger.error("Error in messageDeleteBulk event: " + (error.stack || error));
  }
});
