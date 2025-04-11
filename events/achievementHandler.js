import { handleAchievements } from "../utils/spirits/achievementManager.js";
import { Logger } from "../utils/Logger.js";

export default async (client) => {
  // Listen for profile updates that might trigger achievements
  client.on("profileUpdate", async ({ userId, type, data, profile }) => {
    try {
      const result = await handleAchievements(userId, type, data, profile);
      if (!result) return;

      // Send achievement notifications
      const user = await client.users.fetch(userId);
      if (user) {
        for (const embed of result.unlockMessages) {
          await user.send({ embeds: [embed] }).catch(() => {
            // Ignore if user has DMs disabled
          });
        }
      }

      // Log achievement unlocks
      Logger.info(
        `User ${userId} unlocked ${result.unlockMessages.length} achievements`
      );

      // Apply achievement rewards
      if (Object.keys(result.updates).length > 0) {
        await profile.updateOne(result.updates);
      }
    } catch (error) {
      console.error("Error in achievement handler:", error);
      Logger.error(`Achievement processing error for user ${userId}:`, error);
    }
  });

  // Listen for specific achievement-related events
  const achievementEvents = [
    {
      name: "spiritBond",
      type: "bonding",
      handler: (data) => ({
        firstInteraction: data.isFirst,
        perfectDate: data.isPerfect,
      }),
    },
    {
      name: "affinityUpdate",
      type: "affection",
      handler: (data) => ({
        level: data.newLevel,
        spirit: data.spirit,
      }),
    },
    {
      name: "spacequakeComplete",
      type: "spacequake",
      handler: (data) => ({
        firstExplore: data.isFirst,
        spiritsRescued: data.spiritsRescued,
        astDefeated: data.astDefeated,
      }),
    },
    {
      name: "questProgress",
      type: "quests",
      handler: (data) => ({
        questStreak: data.streak,
        perfectWeeks: data.perfectWeeks,
      }),
    },
    {
      name: "collectionUpdate",
      type: "collection",
      handler: (data) => ({
        spiritCount: data.totalSpirits,
        newSpirit: data.newSpirit,
      }),
    },
  ];

  // Register event listeners
  for (const event of achievementEvents) {
    client.on(event.name, async (userId, eventData) => {
      try {
        const profile = await client.db.Profile.findOne({ userid: userId });
        if (!profile) return;

        const data = event.handler(eventData);
        const result = await handleAchievements(
          userId,
          event.type,
          data,
          profile
        );

        if (!result) return;

        // Send achievement notifications
        const user = await client.users.fetch(userId);
        if (user) {
          for (const embed of result.unlockMessages) {
            await user.send({ embeds: [embed] }).catch(() => {
              // Ignore if user has DMs disabled
            });
          }
        }

        // Apply achievement rewards
        if (Object.keys(result.updates).length > 0) {
          await profile.updateOne(result.updates);
        }

        // Log achievement unlocks
        Logger.info(
          `User ${userId} unlocked ${result.unlockMessages.length} achievements from ${event.name}`
        );
      } catch (error) {
        console.error(
          `Error processing ${event.name} achievements for user ${userId}:`,
          error
        );
        Logger.error(
          `Achievement event ${event.name} error for user ${userId}:`,
          error
        );
      }
    });
  }

  // Listen for seasonal resets
  client.on("seasonReset", async () => {
    try {
      // Reset specific achievement progress if needed
      await client.db.Profile.updateMany(
        {},
        {
          $set: {
            "achievements.questStreak": 0,
            "achievements.perfectWeeks": 0,
          },
        }
      );

      Logger.info("Reset seasonal achievement progress");
    } catch (error) {
      console.error("Error resetting seasonal achievements:", error);
      Logger.error("Season reset achievement error:", error);
    }
  });

  Logger.info("Achievement handler initialized");
};
