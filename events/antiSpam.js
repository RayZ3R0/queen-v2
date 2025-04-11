import { EmbedBuilder } from "discord.js";
import { client } from "../bot.js";
import { analyzeMessage, cleanupUserData } from "../utils/messageStore.js";
import { analyzeTrust, isUserExempt } from "../utils/trustSystem.js";
import AntiSpam from "../schema/antiSpam.js";

// Channel IDs for logging - Update these with actual channel IDs
const ADMIN_CHANNEL_ID = "902045721983844382";
const LOG_CHANNEL_ID = "938770418599337984";

/**
 * Create and send detailed log embed
 * @param {Object} params Parameters for log creation
 */
async function sendLogEmbed({
  guild,
  user,
  type,
  content,
  channelId,
  spamAnalysis,
  trustAnalysis,
}) {
  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
  const adminChannel = guild.channels.cache.get(ADMIN_CHANNEL_ID);
  if (!logChannel && !adminChannel) return;

  // Basic embed for regular logs
  const logEmbed = new EmbedBuilder()
    .setTitle("🚫 Anti-Spam Detection")
    .setColor("Red")
    .setAuthor({
      name: user.tag,
      iconURL: user.displayAvatarURL({ dynamic: true }),
    })
    .setDescription(`Spam detected from ${user.tag}`)
    .addFields(
      { name: "User ID", value: user.id, inline: true },
      {
        name: "Account Age",
        value: `${trustAnalysis.accountAgeDays} days`,
        inline: true,
      },
      {
        name: "Trust Score",
        value: `${trustAnalysis.trustScore}/100`,
        inline: true,
      },
      { name: "Detection Type", value: type },
      { name: "Channel", value: `<#${channelId}>` }
    )
    .setTimestamp();

  // Send basic log to log channel
  if (logChannel) {
    await logChannel.send({ embeds: [logEmbed] });
  }

  // Create detailed embed for admin channel
  const adminEmbed = new EmbedBuilder()
    .setTitle("🚨 Detailed Spam Analysis")
    .setColor("Red")
    .setAuthor({
      name: user.tag,
      iconURL: user.displayAvatarURL({ dynamic: true }),
    })
    .setDescription("Detailed information about the spam detection")
    .addFields(
      {
        name: "User Information",
        value: `Tag: ${user.tag}\nID: ${user.id}\nAccount Age: ${trustAnalysis.accountAgeDays} days\nServer Age: ${trustAnalysis.serverAgeDays} days\nTrust Score: ${trustAnalysis.trustScore}/100`,
      },
      {
        name: "Detection Details",
        value: `Type: ${type}\nChannel: <#${channelId}>\nUnique Channels: ${spamAnalysis.uniqueChannels}\nDuplicate Messages: ${spamAnalysis.duplicateCount}`,
      }
    );

  // Add specific details based on spam type
  if (type === "LINK_SPAM" && content.includes("[")) {
    adminEmbed.addFields({
      name: "Suspicious Link Analysis",
      value: "Detected markdown-style link hiding attempt",
    });
  }

  if (spamAnalysis.deceptiveLink) {
    adminEmbed.addFields({
      name: "⚠️ Deceptive Link Warning",
      value: "Attempted to hide malicious URL using whitelisted domain",
    });
  }

  // Add message content with proper formatting
  adminEmbed.addFields({
    name: "Message Content",
    value: content.length > 1024 ? content.substring(0, 1021) + "..." : content,
  });

  // Send detailed log to admin channel
  if (adminChannel) {
    await adminChannel.send({ embeds: [adminEmbed] });
  }
}

/**
 * Handle spam offense with progressive actions
 * @param {Message} message Discord message object
 * @param {Document} spamRecord MongoDB document
 * @param {Object} trustAnalysis Trust analysis results
 */
async function handleSpamOffense(message, spamRecord, trustAnalysis) {
  const { member, guild, author } = message;
  const warnings = spamRecord.warnings;

  let action = "";
  let duration = 0;

  // Apply stricter thresholds for new/untrusted users
  const multiplier = trustAnalysis.thresholdMultiplier;

  // Progressive action system
  if (warnings <= 3 * multiplier) {
    // First offense - Warning
    action = "warned";
    const warningEmbed = new EmbedBuilder()
      .setColor("Yellow")
      .setTitle("⚠️ Warning")
      .setDescription(
        "Please avoid sending similar messages across multiple channels."
      )
      .addFields({ name: "Warning Count", value: `${warnings}` });

    await author.send({ embeds: [warningEmbed] }).catch(() => {});
  } else if (warnings <= 5 * multiplier) {
    // Second offense - Temporary mute
    action = "muted";
    duration = 5 * 60000; // 5 minutes
    await member
      .timeout(duration, "Anti-spam: Multiple warnings")
      .catch(console.error);

    const muteEmbed = new EmbedBuilder()
      .setColor("Orange")
      .setTitle("🔇 Muted")
      .setDescription("You have been temporarily muted for spamming.")
      .addFields(
        { name: "Duration", value: "5 minutes" },
        { name: "Warning Count", value: `${warnings}` }
      );

    await author.send({ embeds: [muteEmbed] }).catch(() => {});
  } else {
    // Third offense - Kick
    action = "kicked";
    await member.kick("Anti-spam: Excessive warnings").catch(console.error);

    const kickEmbed = new EmbedBuilder()
      .setColor("Red")
      .setTitle("👢 Kicked")
      .setDescription("You have been kicked for excessive spamming.")
      .addFields({ name: "Warning Count", value: `${warnings}` });

    await author.send({ embeds: [kickEmbed] }).catch(() => {});
  }

  // Log the action
  const actionEmbed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("Anti-Spam Action")
    .setDescription(`${author.tag} has been ${action}`)
    .addFields(
      { name: "User ID", value: author.id },
      { name: "Warning Count", value: `${warnings}` },
      { name: "Trust Score", value: `${trustAnalysis.trustScore}` },
      { name: "Action", value: action }
    )
    .setTimestamp();

  const adminChannel = guild.channels.cache.get(ADMIN_CHANNEL_ID);
  if (adminChannel) {
    await adminChannel.send({ embeds: [actionEmbed] });
  }
}

// Event handler
client.on("messageCreate", async (message) => {
  // Skip if message is from a bot or has no content
  if (message.author.bot || !message.content) return;

  try {
    const { member, guild, channel, content } = message;

    // Skip exempt users
    if (await isUserExempt(member)) return;

    // Analyze user trust level
    const trustAnalysis = await analyzeTrust(member);

    // Analyze message for spam
    const spamAnalysis = analyzeMessage(message);

    // Check if any spam conditions are met
    // Only check for cross-channel spam with links
    if (spamAnalysis.isSpam.crossChannelSpam) {
      // Get or create spam record
      const spamRecord = await AntiSpam.updateRecord(
        message.author.id,
        guild.id,
        {
          type: "CROSS_CHANNEL",
          channelIds: [
            ...new Set(spamAnalysis.spamMessages.map((msg) => msg.channelId)),
          ],
          content: content,
        }
      );

      // Delete all spam messages across channels
      const deletionPromises = spamAnalysis.spamMessages.map(
        async ({ channelId, messageId }) => {
          const channel = guild.channels.cache.get(channelId);
          if (channel) {
            try {
              const msg = await channel.messages.fetch(messageId);
              if (msg) await msg.delete();
            } catch (error) {
              console.warn(
                `Failed to delete message ${messageId} in channel ${channelId}:`,
                error
              );
            }
          }
        }
      );

      // Wait for all deletions to complete
      await Promise.all(deletionPromises).catch(console.error);

      // Handle the offense
      await handleSpamOffense(message, spamRecord, trustAnalysis);

      // Log deletion summary
      const adminChannel = guild.channels.cache.get(ADMIN_CHANNEL_ID);
      if (adminChannel) {
        const deletionEmbed = new EmbedBuilder()
          .setColor("Blue")
          .setTitle("🧹 Spam Cleanup Summary")
          .setDescription(`Cleaned up spam messages from ${message.author.tag}`)
          .addFields(
            {
              name: "Messages Removed",
              value: `${spamAnalysis.spamMessages.length}`,
              inline: true,
            },
            {
              name: "Channels Affected",
              value: `${spamAnalysis.uniqueChannels}`,
              inline: true,
            }
          )
          .setTimestamp();

        await adminChannel.send({ embeds: [deletionEmbed] });
      }

      // Log the spam detection
      await sendLogEmbed({
        guild,
        user: message.author,
        type: spamRecord.offenseHistory[spamRecord.offenseHistory.length - 1]
          .type,
        content: content,
        channelId: channel.id,
        spamAnalysis,
        trustAnalysis,
      });

      // Send immediate notification for suspicious links
      if (spamAnalysis.isSpam.linkSpam && spamAnalysis.deceptiveLink) {
        const urgentEmbed = new EmbedBuilder()
          .setColor("DarkRed")
          .setTitle("⚠️ Suspicious Link Alert")
          .setDescription("Potential malicious link detected")
          .addFields(
            { name: "User", value: message.author.tag },
            { name: "Channel", value: `<#${channel.id}>` },
            {
              name: "Warning",
              value: "Attempted to hide malicious URL using spoofed domain",
            }
          )
          .setTimestamp();

        const adminChannel = guild.channels.cache.get(ADMIN_CHANNEL_ID);
        if (adminChannel) {
          await adminChannel.send({
            content: "@here - Suspicious link detected!",
            embeds: [urgentEmbed],
          });
        }
      }

      // Clean up tracking data
      cleanupUserData(message.author.id, guild.id);
    }
  } catch (error) {
    console.error("Anti-spam error:", error);

    // Create detailed error log
    const errorEmbed = new EmbedBuilder()
      .setColor("DarkRed")
      .setTitle("⚠️ Anti-Spam System Error")
      .setDescription("An error occurred while processing anti-spam detection")
      .addFields(
        { name: "Error Message", value: error.message || "Unknown error" },
        { name: "User", value: `${message.author.tag} (${message.author.id})` },
        { name: "Channel", value: `<#${message.channel.id}>` },
        {
          name: "Message Content",
          value: message.content.substring(0, 1024) || "No content",
        }
      )
      .setTimestamp();

    // Add stack trace if available
    if (error.stack) {
      errorEmbed.addFields({
        name: "Stack Trace",
        value: `\`\`\`${error.stack.substring(0, 1000)}...\`\`\``,
      });
    }

    // Send error log to admin channel
    const adminChannel = message.guild.channels.cache.get(ADMIN_CHANNEL_ID);
    if (adminChannel) {
      await adminChannel
        .send({
          content: "@here - Anti-spam system encountered an error!",
          embeds: [errorEmbed],
        })
        .catch(console.error);
    }
  }
});
