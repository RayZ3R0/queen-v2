import mongoose from "mongoose";

const questSchema = new mongoose.Schema({
  userid: { type: String, required: true, index: true },
  quests: [
    {
      id: { type: String, required: true },
      type: { type: String, required: true },
      tier: { type: String, required: true },
      description: { type: String, required: true },
      requirements: {
        count: { type: Number },
        affinity: { type: Number },
        location: { type: String },
      },
      progress: { type: Number, default: 0 },
      completed: { type: Boolean, default: false },
      rewardsClaimed: { type: Boolean, default: false },
    },
  ],
  lastQuestReset: { type: Date, default: Date.now, index: true },
  questsCompleted: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  lastStreak: { type: Date },
});

// Auto-reset quests daily
questSchema.methods.shouldResetQuests = function () {
  const now = new Date();
  const lastReset = this.lastQuestReset;

  // Check if it's a new day
  return !lastReset || now.getDate() !== lastReset.getDate();
};

// Update quest progress
questSchema.methods.updateQuestProgress = function (questId, progress) {
  const quest = this.quests.find((q) => q.id === questId);
  if (!quest) return false;

  quest.progress = progress;

  // Check if quest is completed
  if (quest.type === "BOND") {
    quest.completed = progress >= quest.requirements.affinity;
  } else {
    quest.completed = progress >= quest.requirements.count;
  }

  return quest.completed;
};

// Claim quest rewards
questSchema.methods.claimRewards = function (questId) {
  const quest = this.quests.find((q) => q.id === questId);
  if (!quest || !quest.completed || quest.rewardsClaimed) return null;

  quest.rewardsClaimed = true;
  return quest;
};

// Update streak
questSchema.methods.updateStreak = function () {
  const now = new Date();
  const lastStreak = this.lastStreak || new Date(0);
  const daysSinceLastStreak = Math.floor(
    (now - lastStreak) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastStreak <= 1) {
    this.streak++;
  } else {
    this.streak = 1;
  }

  this.lastStreak = now;
};

// Get streak bonus multiplier
questSchema.methods.getStreakBonus = function () {
  // Bonus caps at 50% for a 7-day streak
  return Math.min(1.5, 1 + this.streak * 0.07);
};

// Check if all daily quests are completed
questSchema.methods.areAllQuestsCompleted = function () {
  return this.quests.every((quest) => quest.completed);
};

// Helper method to reset quests
questSchema.methods.resetQuests = async function (newQuests) {
  this.quests = newQuests;
  this.lastQuestReset = new Date();

  // Only update streak if all quests were completed
  if (this.areAllQuestsCompleted()) {
    this.updateStreak();
  } else {
    this.streak = 0;
  }

  // Reset counters
  this.questsCompleted = 0;

  await this.save();
  return this;
};

// Add lifecycle hooks
questSchema.pre("save", function (next) {
  // Reset streak if it's been more than 2 days
  const now = new Date();
  const lastStreak = this.lastStreak || new Date(0);
  const daysSinceLastStreak = Math.floor(
    (now - lastStreak) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceLastStreak > 1) {
    this.streak = 0;
  }

  next();
});

// Create compound index for faster queries
questSchema.index({ userid: 1, lastQuestReset: 1 });
questSchema.index({ userid: 1, "quests.completed": 1 });
questSchema.index({ userid: 1, streak: 1 });

export default mongoose.model("Quest", questSchema);
