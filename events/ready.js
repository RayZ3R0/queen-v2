import { ActivityType } from "discord.js";
import { runSystemChecks } from "../utils/spirits/systemCheck.js";
import { SPIRIT_POWERS } from "../utils/spirits/spiritPowers.js";
import { Logger } from "../utils/Logger.js";
import pkg from "@napi-rs/canvas";
const { GlobalFonts } = pkg;
import { client } from "../bot.js";

export default async (client) => {
  try {
    // Log startup info
    console.log(`[Ready] Logged in as ${client.user.tag}`);
    Logger.info(`Bot is ready! Logged in as ${client.user.tag}`);

    // Set initial status
    client.user.setActivity("/start | Begin your spirit journey", {
      type: ActivityType.Playing,
    });

    // Load spirit configurations
    const totalPowers = Object.keys(SPIRIT_POWERS).length;
    Logger.info(`Loaded ${totalPowers} spirit powers`);

    // Run system diagnostics
    const results = await runSystemChecks();

    // Get dev users from config
    const devUserIds = process.env.DEV_USERS?.split(",") || [];

    // Send diagnostic report to each dev
    for (const userId of devUserIds) {
      try {
        const user = await client.users.fetch(userId);
        if (user) {
          await user.send({
            content: "🔄 Bot has restarted! System diagnostic results:",
            embeds: [results],
          });
        }
      } catch (error) {
        console.error(`Failed to send startup report to dev ${userId}:`, error);
      }
    }

    // Calculate system health
    const totalChecks = Object.values(results).reduce(
      (acc, curr) => acc + Object.keys(curr).length,
      0
    );
    const passedChecks = Object.values(results).reduce(
      (acc, curr) =>
        acc +
        Object.values(curr).filter((check) => check.status === "✅").length,
      0
    );
    const healthPercentage = Math.floor((passedChecks / totalChecks) * 100);

    // Log system health
    Logger.info(`System Health: ${healthPercentage}% operational`);

    // If health below 75%, log warning with details
    if (healthPercentage < 75) {
      Logger.warn("System health below optimal levels! Failed checks:");
      Object.entries(results).forEach(([category, checks]) => {
        Object.entries(checks)
          .filter(([, check]) => check.status !== "✅")
          .forEach(([name, check]) => {
            Logger.warn(`${category} > ${name}: ${check.message}`);
          });
      });
    }

    // Initialize daily reset handlers
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // Schedule daily system checks
    setTimeout(() => {
      setInterval(async () => {
        const dailyResults = await runSystemChecks();
        Logger.info("Daily system check completed");

        // Alert devs if health drops below 90%
        const dailyHealth = Math.floor(
          (Object.values(dailyResults).reduce(
            (acc, curr) =>
              acc +
              Object.values(curr).filter((check) => check.status === "✅")
                .length,
            0
          ) /
            Object.values(dailyResults).reduce(
              (acc, curr) => acc + Object.keys(curr).length,
              0
            )) *
            100
        );

        if (dailyHealth < 90) {
          for (const userId of devUserIds) {
            try {
              const user = await client.users.fetch(userId);
              if (user) {
                await user.send({
                  content: `⚠️ System health alert: ${dailyHealth}% operational`,
                  embeds: [dailyResults],
                });
              }
            } catch (error) {
              console.error(
                `Failed to send health alert to dev ${userId}:`,
                error
              );
            }
          }
        }
      }, 24 * 60 * 60 * 1000); // Run every 24 hours
    }, tomorrow - now);

    Logger.info("Bot initialization complete!");
  } catch (error) {
    console.error("[Ready] Error during startup:", error);
    Logger.error("Error during bot startup:", error);
  }
};

client.on("ready", () => {
  // StatHandlers configuration
  const config = {
    fonts: {
      path: "Fonts/Baloo-Regular.ttf",
      family: "Baloo",
    },
  };

  // Initialize fonts
  try {
    GlobalFonts.registerFromPath(config.fonts.path, config.fonts.family);
    console.log("Successfully registered fonts for stats handlers");
  } catch (err) {
    console.warn(
      "Could not load custom font, falling back to system font:",
      err
    );
  }
});
