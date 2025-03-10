import {
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  WebhookClient,
  ChannelType,
  AttachmentBuilder
} from "discord.js";
import chalk from "chalk";
import winston from "winston";
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
    const logChannel = client.channels.cache.get("901841617449799680");
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle(`Message Deleted in #${message.channel.name}`)
      .setAuthor({
        name: message.author.username,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .setFooter({ text: message.id })
      .setTimestamp();

    if (message.content) embed.setDescription(`\`\`\`${message.content}\`\`\``);

    if (message.attachments.size > 0) {
      const attachmentData = message.attachments.first();
      const attachment = new AttachmentBuilder(attachmentData.url, {
        name: "image.png",
      });
      embed.setImage("attachment://image.png");
      await logChannel.send({ embeds: [embed], files: [attachment] });
    } else {
      await logChannel.send({ embeds: [embed] });
    }
  } catch (err) {
    logger.error("Error in messageDelete event: " + (err.stack || err));
  }
});

// --------------------- Event: Message Update --------------------- //
// --------------------- Event: Message Update --------------------- //
const webhook = new WebhookClient({ url: process.env.WEBHOOK });
client.on("messageUpdate", async (oldMessage, newMessage) => {
  try {
    // Check that the message's author exists (it might be null for partial messages)
    if (!oldMessage.author) return;

    // Skip bot messages and DMs.
    if (oldMessage.author.bot || oldMessage.channel.type === ChannelType.DM)
      return;

    const embed = new EmbedBuilder()
      .setTitle(`Message Edited in #${oldMessage.channel.name}`)
      .setAuthor({
        name: oldMessage.author.username,
        iconURL: oldMessage.author.displayAvatarURL({ dynamic: true }),
      })
      .setColor(getRandomColor())
      .setDescription(
        `**Previous Message:**\n\`\`\`${oldMessage.content || "N/A"}\`\`\`\n` +
          `**New Message:**\n\`\`\`${newMessage.content || "N/A"}\`\`\``
      )
      .setTimestamp();
    await webhook.send({ embeds: [embed] });
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

    // Build a basic summary embed
    let summaryEmbed = new EmbedBuilder()
      .setColor(getRandomColor())
      .setTitle("Bulk Message Delete")
      .setDescription(`Number of messages deleted: **${messages.size}**`)
      .setTimestamp();

    // Gather details for each deleted message:
    // (Author tag, channel, sent time, and content; includes a divider between messages)
    let messageDetails = [];
    // Sort messages by creation time (ascending)
    messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    messages.forEach((msg) => {
      let detail =
        `**Author:** ${msg.author.tag} (${msg.author.id})\n` +
        `**Channel:** ${msg.channel.name} (${msg.channel.id})\n` +
        `**Time:** ${new Date(msg.createdTimestamp).toLocaleString()}\n` +
        `**Content:** ${msg.content ? msg.content : "[No Text Content]"}\n`;
      messageDetails.push(detail);
    });
    const allDetails = messageDetails.join("\n-----------------\n");

    // Discord embed field value limit is 1024 characters.
    const maxEmbedField = 1024;
    let detailsToShow;
    if (allDetails.length <= maxEmbedField) {
      detailsToShow = allDetails;
    } else {
      detailsToShow = allDetails.slice(0, maxEmbedField - 3) + "...";
    }
    summaryEmbed.addFields({
      name: "Deleted Message Details",
      value: detailsToShow,
    });

    // If the full details exceed the embed limit, attach a text file containing all details.
    let attachments = [];
    if (allDetails.length > maxEmbedField) {
      attachments.push(
        new AttachmentBuilder(Buffer.from(allDetails, "utf8"), {
          name: "bulk-deleted-messages.txt",
        })
      );
    }

    await logChannel.send({ embeds: [summaryEmbed], files: attachments });
  } catch (error) {
    logger.error("Error in messageDeleteBulk event: " + (error.stack || error));
  }
});
