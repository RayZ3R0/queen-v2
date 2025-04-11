import { canUpdateQuest } from "../utils/spirits/questManager.js";
import questSchema from "../schema/quests.js";
import profileSchema from "../schema/profile.js";

export default async (client) => {
  // Quest progress update handler
  client.on("spiritAction", async ({ userId, type, data }) => {
    try {
      // Get user's quest data
      const questData = await questSchema.findOne({ userid: userId });
      if (!questData) return;

      // Get user profile for spirit info
      const userProfile = await profileSchema.findOne({ userid: userId });
      if (!userProfile?.selected) return;

      // Check each quest for potential updates
      let updatedQuests = false;
      for (const quest of questData.quests) {
        // Skip if already completed
        if (quest.completed) continue;

        // Check if action matches quest requirements
        const actionData = {
          ...data,
          questSpirit: userProfile.selected,
        };

        if (canUpdateQuest(quest, type, actionData)) {
          // Update progress based on quest type
          switch (quest.type) {
            case "BOND":
              quest.progress = userProfile.affinity;
              break;

            case "DATE":
            case "GIFT":
            case "CHAT":
            case "EXPLORE":
            case "RACE":
              quest.progress++;
              break;
          }

          // Check if quest is now completed
          if (quest.type === "BOND") {
            quest.completed = quest.progress >= quest.requirements.affinity;
          } else {
            quest.completed = quest.progress >= quest.requirements.count;
          }

          updatedQuests = true;

          // Emit quest completion event if newly completed
          if (quest.completed) {
            client.emit("questCompleted", {
              userId,
              questId: quest.id,
              type: quest.type,
              tier: quest.tier,
            });
          }
        }
      }

      // Save updates if any quests were modified
      if (updatedQuests) {
        await questData.save();
      }
    } catch (error) {
      console.error("Error in quest progress handler:", error);
    }
  });

  // Quest completion handler
  client.on("questCompleted", async ({ userId, questId, type, tier }) => {
    try {
      // Send completion message to user
      const user = await client.users.fetch(userId);
      if (!user) return;

      // Get quest data for details
      const questData = await questSchema.findOne({ userid: userId });
      if (!questData) return;

      const quest = questData.quests.find((q) => q.id === questId);
      if (!quest) return;

      // Check if all daily quests are now completed
      const allCompleted = questData.quests.every((q) => q.completed);
      if (allCompleted) {
        // Update streak
        questData.updateStreak();
        await questData.save();

        // Send bonus notification
        const streakBonus = questData.getStreakBonus();
        if (streakBonus > 1) {
          await user
            .send({
              content: `🎯 All daily quests completed! Your ${
                questData.streak
              }-day streak gives you a ${((streakBonus - 1) * 100).toFixed(
                0
              )}% bonus on quest rewards!`,
            })
            .catch(() => {}); // Ignore if DMs are closed
        }
      }

      // Send quest completion notification
      await user
        .send({
          content: `✨ Quest completed: ${quest.description}\nUse \`/quests claim\` to receive your rewards!`,
        })
        .catch(() => {}); // Ignore if DMs are closed
    } catch (error) {
      console.error("Error in quest completion handler:", error);
    }
  });
};

// Helper function to emit spirit actions
export const emitSpiritAction = (client, userId, type, data = {}) => {
  client.emit("spiritAction", { userId, type, data });
};
