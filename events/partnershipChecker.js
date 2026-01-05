import { EmbedBuilder } from "discord.js";
import { client } from "../bot.js";
import Partnership from "../schema/partnerships.js";
import { validateInvite, extractInviteCode, createPartnershipEmbed } from "../utils/partnershipUtils.js";
import winston from "winston";

const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "partnerships.log" }),
  ],
  format: winston.format.printf(
    (log) => `[${log.level.toLowerCase()}] - ${log.message}`
  ),
});

const NOTIFICATION_CHANNEL_ID = "965509744859185262";
const PARTNERSHIP_CHANNEL_ID = "912179889191395388";
const CHECK_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

// Listen for messages in partnership channel
client.on("messageCreate", async (message) => {
  // Ignore bots and check if it's the partnership channel
  if (message.author.bot || message.channelId !== PARTNERSHIP_CHANNEL_ID) return;

  try {
    const inviteCode = extractInviteCode(message.content);
    
    if (!inviteCode) {
      logger.info(`No invite code found in message ${message.id} from ${message.author.tag}`);
      return;
    }

    logger.info(`Found invite code ${inviteCode} in partnership channel from ${message.author.tag}`);

    // Check if already exists
    const existing = await Partnership.findOne({ inviteCode });
    if (existing) {
      logger.info(`Partnership ${inviteCode} already exists, skipping.`);
      return;
    }

    // Validate the invite
    const inviteData = await validateInvite(client, inviteCode);
    
    if (!inviteData) {
      logger.warn(`Invalid invite ${inviteCode} from ${message.author.tag}`);
      return;
    }

    // Skip if it's the server's own invite
    if (inviteData.guild.id === message.guild.id) {
      logger.info(`Skipping ${inviteCode} - it's the server's own invite`);
      return;
    }

    // Create partnership record
    const partnership = await Partnership.create({
      inviteCode: inviteCode,
      inviteUrl: `https://discord.gg/${inviteCode}`,
      guildId: inviteData.guild.id,
      guildName: inviteData.guild.name,
      guildIcon: inviteData.guild.icon,
      memberCount: inviteData.guild.memberCount || 0,
      description: inviteData.guild.description || null,
      addedBy: message.author.tag,
      addedById: message.author.id,
      addedAt: new Date(),
      lastChecked: new Date(),
      status: "active",
      consecutiveFailures: 0,
      messageId: message.id,
      channelId: message.channelId,
      expiresAt: inviteData.expiresAt || null,
      notes: `Auto-added from partnership channel message`,
    });

    logger.info(`✅ Auto-added partnership: ${inviteData.guild.name} (${inviteCode}) from ${message.author.tag}`);
    
    // React to the message to confirm
    await message.react("✅").catch(() => {});
    
  } catch (error) {
    logger.error(`Error processing partnership message: ${error.message}`);
  }
});

/**
 * Check all partnerships for validity
 */
async function checkAllPartnerships() {
  try {
    logger.info("Starting partnership validation check...");

    const partnerships = await Partnership.find({
      status: { $in: ["active", "flagged"] },
    });

    if (partnerships.length === 0) {
      logger.info("No partnerships to check.");
      return;
    }

    logger.info(`Checking ${partnerships.length} partnerships...`);

    const notificationChannel = client.channels.cache.get(NOTIFICATION_CHANNEL_ID);
    let checkedCount = 0;
    let expiredCount = 0;
    let updatedCount = 0;

    for (const partnership of partnerships) {
      try {
        checkedCount++;
        
        // Validate the invite
        const inviteData = await validateInvite(client, partnership.inviteCode);

        if (!inviteData) {
          // Invite is invalid/expired
          const wasActive = partnership.status === "active";
          partnership.status = "expired";
          partnership.consecutiveFailures += 1;
          partnership.lastChecked = new Date();
          await partnership.save();

          expiredCount++;
          logger.warn(
            `Partnership with ${partnership.guildName} (${partnership.inviteCode}) has expired.`
          );

          // Send notification only if it was previously active
          if (wasActive && notificationChannel) {
            const notifEmbed = new EmbedBuilder()
              .setColor("#ff6b6b")
              .setTitle("⚠️ Partnership Invite Expired")
              .setDescription(
                `Partnership with **${partnership.guildName}** has an expired invite.`
              )
              .addFields(
                { name: "Invite Code", value: `\`${partnership.inviteCode}\``, inline: true },
                { name: "Added By", value: partnership.addedBy, inline: true },
                {
                  name: "Added On",
                  value: `<t:${Math.floor(partnership.addedAt.getTime() / 1000)}:F>`,
                  inline: true,
                },
                {
                  name: "Last Known Members",
                  value: `${partnership.memberCount || "Unknown"}`,
                  inline: true,
                },
                {
                  name: "Server ID",
                  value: partnership.guildId,
                  inline: true,
                }
              )
              .setFooter({ text: "Partnership System • Auto Check" })
              .setTimestamp();

            if (partnership.guildIcon) {
              notifEmbed.setThumbnail(partnership.guildIcon);
            }

            await notificationChannel.send({ embeds: [notifEmbed] });
          }
        } else {
          // Update partnership data
          const updated =
            partnership.memberCount !== inviteData.memberCount ||
            partnership.guildName !== inviteData.guildName;

          partnership.memberCount = inviteData.memberCount;
          partnership.description = inviteData.description;
          partnership.guildName = inviteData.guildName;
          partnership.guildIcon = inviteData.guildIcon;
          partnership.consecutiveFailures = 0;
          partnership.lastChecked = new Date();

          // If was flagged/expired but now valid, mark as active
          if (partnership.status !== "active") {
            partnership.status = "active";
            logger.info(
              `Partnership with ${partnership.guildName} is now active again.`
            );
          }

          await partnership.save();

          if (updated) {
            updatedCount++;
          }
        }

        // Small delay to avoid rate limits (500ms between checks)
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        logger.error(
          `Error checking partnership ${partnership.inviteCode}: ${error.message}`
        );
        partnership.consecutiveFailures += 1;
        partnership.lastChecked = new Date();
        await partnership.save();
      }
    }

    logger.info(
      `Partnership check complete: ${checkedCount} checked, ${updatedCount} updated, ${expiredCount} expired`
    );

    // Send summary to notification channel
    if (notificationChannel && (expiredCount > 0 || updatedCount > 0)) {
      const summaryEmbed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("📊 Partnership Check Summary")
        .setDescription(
          `Automatic partnership validation completed.\n\n` +
            `**Total Checked:** ${checkedCount}\n` +
            `**Updated:** ${updatedCount}\n` +
            `**Expired:** ${expiredCount}\n` +
            `**Next Check:** <t:${Math.floor((Date.now() + CHECK_INTERVAL) / 1000)}:R>`
        )
        .setFooter({ text: "Partnership System" })
        .setTimestamp();

      await notificationChannel.send({ embeds: [summaryEmbed] });
    }
  } catch (error) {
    logger.error(`Partnership check error: ${error.stack || error}`);
  }
}

// Start the checker when bot is ready
client.once("ready", () => {
  logger.info("Partnership checker initialized.");
  
  // Run initial check after 5 minutes
  setTimeout(() => {
    checkAllPartnerships();
  }, 5 * 60 * 1000);

  // Schedule regular checks every 12 hours
  setInterval(() => {
    checkAllPartnerships();
  }, CHECK_INTERVAL);
});

// Export for manual triggering
export { checkAllPartnerships };
