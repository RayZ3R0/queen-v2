import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits } from "discord.js";
import { client } from "../bot.js";
import HoneypotViolation from "../schema/honeypotViolation.js";

// Configuration
const HONEYPOT_CHANNEL_ID = "1457631328634798170";
const TIMEOUT_DURATION = 1 * 24 * 60 * 60 * 1000; // 1 day in milliseconds
const MESSAGE_SCAN_HOURS = 12; // Delete messages from last 12 hours
const MEMBER_ROLE_ID = "747480425114632294";
const MOD_CHANNEL_ID = "965509744859185262";
const MOD_ROLE_ID = "920210140093902868";

// Button colors and labels for verification
const BUTTON_OPTIONS = [
  { color: "red", label: "Red Button", style: ButtonStyle.Danger },
  { color: "blue", label: "Blue Button", style: ButtonStyle.Primary },
  { color: "green", label: "Green Button", style: ButtonStyle.Success },
  { color: "gray", label: "Gray Button", style: ButtonStyle.Secondary },
];

/**
 * Check if a channel is accessible to regular members
 */
async function isChannelAccessibleToMembers(channel) {
  try {
    // Skip non-text channels
    if (!channel.isTextBased() || channel.isThread()) {
      return false;
    }

    // Check @everyone permissions
    const everyonePerms = channel.permissionsFor(channel.guild.roles.everyone);
    if (everyonePerms && everyonePerms.has(PermissionFlagsBits.SendMessages)) {
      return true;
    }

    // Check member role permissions
    const memberRole = channel.guild.roles.cache.get(MEMBER_ROLE_ID);
    if (memberRole) {
      const memberPerms = channel.permissionsFor(memberRole);
      if (memberPerms && memberPerms.has(PermissionFlagsBits.SendMessages)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(`Error checking channel permissions for ${channel.name}:`, error);
    return false;
  }
}

/**
 * Delete all messages from a user in the last X hours across all accessible channels
 */
async function deleteUserMessages(guild, userId, hours) {
  const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
  let totalDeleted = 0;
  let channelsScanned = 0;

  console.log(`[HONEYPOT] Starting message deletion for user ${userId}...`);

  try {
    const channels = guild.channels.cache.filter((c) => c.isTextBased() && !c.isThread());

    for (const [, channel] of channels) {
      // Skip if channel is not accessible to regular members
      if (!(await isChannelAccessibleToMembers(channel))) {
        continue;
      }

      channelsScanned++;

      try {
        // Fetch messages from this channel
        let fetchedMessages;
        try {
          fetchedMessages = await channel.messages.fetch({ limit: 100 });
        } catch (fetchError) {
          // Skip if we can't fetch messages (no permission, etc.)
          continue;
        }

        // Filter messages by user and time
        const userMessages = fetchedMessages.filter(
          (msg) => msg.author.id === userId && msg.createdTimestamp > cutoffTime
        );

        if (userMessages.size === 0) continue;

        // Delete messages
        for (const [, msg] of userMessages) {
          try {
            await msg.delete();
            totalDeleted++;
          } catch (delError) {
            console.error(`Error deleting message ${msg.id}:`, delError);
          }
        }

        // Rate limit protection - small delay between channels
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (channelError) {
        console.error(`Error processing channel ${channel.name}:`, channelError);
      }
    }

    console.log(`[HONEYPOT] Deleted ${totalDeleted} messages across ${channelsScanned} channels`);
  } catch (error) {
    console.error("[HONEYPOT] Error during message deletion:", error);
  }

  return { deleted: totalDeleted, scanned: channelsScanned };
}

/**
 * Generate random button verification challenge
 */
function generateVerificationChallenge(violationId) {
  // Shuffle buttons
  const shuffled = [...BUTTON_OPTIONS].sort(() => Math.random() - 0.5);

  // Pick random correct button
  const correctButton = shuffled[Math.floor(Math.random() * shuffled.length)];

  // Create buttons
  const buttons = shuffled.map((option) =>
    new ButtonBuilder()
      .setCustomId(`honeypot_verify_${violationId}_${option.color}`)
      .setLabel(option.label)
      .setStyle(option.style)
  );

  return {
    buttons,
    correctColor: correctButton.color,
    correctLabel: correctButton.label,
  };
}

/**
 * Main honeypot detection handler
 */
client.on("messageCreate", async (message) => {
  try {
    // Only process messages in honeypot channel
    if (message.channel.id !== HONEYPOT_CHANNEL_ID) return;

    // Ignore bots
    if (message.author.bot) return;

    // Exempt admins
    if (message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      console.log(`[HONEYPOT] Ignoring admin message from ${message.author.tag}`);
      return;
    }

    console.log(`[HONEYPOT] Detected message from ${message.author.tag} in honeypot channel!`);

    // Delete the honeypot message immediately
    await message.delete().catch(console.error);

    // Create violation record
    const violation = await HoneypotViolation.create({
      guildId: message.guild.id,
      userId: message.author.id,
      username: message.author.tag,
      messageId: message.id,
      channelId: message.channel.id,
      messageContent: message.content?.substring(0, 500) || "",
    });

    // Start message deletion in background (don't await to avoid blocking)
    deleteUserMessages(message.guild, message.author.id, MESSAGE_SCAN_HOURS)
      .then(async ({ deleted, scanned }) => {
        await HoneypotViolation.findByIdAndUpdate(violation._id, {
          messagesDeleted: deleted,
          channelsScanned: scanned,
        });

        console.log(`[HONEYPOT] Completed cleanup: ${deleted} messages deleted from ${scanned} channels`);
      })
      .catch(console.error);

    // Generate verification challenge
    const challenge = generateVerificationChallenge(violation._id.toString());

    // Update violation with correct button
    await HoneypotViolation.findByIdAndUpdate(violation._id, {
      correctButton: challenge.correctColor,
    });

    // Send DM with verification buttons
    let dmSent = false;
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor("Orange")
        .setTitle("⚠️ Security Verification Required")
        .setDescription(
          `You have been temporarily timed out in **${message.guild.name}** for 7 days due to posting in a restricted channel.\n\n` +
            `If you are a real person, please verify by clicking the **${challenge.correctLabel}** below to be immediately unmuted.\n\n` +
            `**Bots cannot pass this verification.**`
        )
        .setFooter({ text: "You have one attempt. Choose carefully." })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(challenge.buttons);

      await message.author.send({
        embeds: [dmEmbed],
        components: [row],
      });

      dmSent = true;
      await HoneypotViolation.findByIdAndUpdate(violation._id, { dmSent: true });
      console.log(`[HONEYPOT] Verification DM sent to ${message.author.tag}`);
    } catch (dmError) {
      console.error(`[HONEYPOT] Failed to send DM to ${message.author.tag}:`, dmError);
    }

    // Timeout the user for 7 days
    try {
      await message.member.timeout(TIMEOUT_DURATION, "Honeypot violation - posted in restricted channel");
      console.log(`[HONEYPOT] Timed out ${message.author.tag} for 7 days`);
    } catch (timeoutError) {
      console.error(`[HONEYPOT] Failed to timeout ${message.author.tag}:`, timeoutError);
    }

    // Notify mods
    const modChannel = message.guild.channels.cache.get(MOD_CHANNEL_ID);
    if (modChannel) {
      const modEmbed = new EmbedBuilder()
        .setColor("Orange")
        .setTitle("🍯 Honeypot Triggered")
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
            name: "Action Taken",
            value: "Timed out for 7 days",
            inline: true,
          },
          {
            name: "DM Status",
            value: dmSent ? "✅ Sent verification challenge" : "❌ DMs disabled",
            inline: true,
          },
          {
            name: "Message Cleanup",
            value: "Deleting messages from last 12 hours...",
            inline: false,
          }
        )
        .setTimestamp();

      if (message.content) {
        modEmbed.addFields({
          name: "Message Content",
          value: `\`\`\`${message.content.substring(0, 500)}\`\`\``,
          inline: false,
        });
      }

      await modChannel.send({
        content: `<@&${MOD_ROLE_ID}>`,
        embeds: [modEmbed],
      });
    }
  } catch (error) {
    console.error("[HONEYPOT] Error in honeypot handler:", error);
  }
});

export default (client) => {
  console.log("✅ Honeypot detection event loaded");
};
