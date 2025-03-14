import mongoose from "mongoose";

const profileSchema = new mongoose.Schema({
  userid: { type: String, required: true, unique: true },
  selected: { type: String, default: "None" },
  image: {
    type: String,
    default: "https://c.tenor.com/E6P9PZdh7W0AAAAC/date-a-live-kurumi.gif",
  },
  color: { type: String, default: "#ff0000" },
  bio: { type: String, default: "None" },
  level: { type: Number, default: 0 },
  xp: { type: Number, default: 0 },
  energy: { type: Number, default: 60 },
  balance: { type: Number, default: 0 },
  items: { type: Array, default: [] },
  started: { type: Boolean, default: false },
  // Spirit interaction tracking
  affinity: { type: Number, default: 0 },
  dateStreak: { type: Number, default: 0 },
  lastDate: { type: Date },
  totalDates: { type: Number, default: 0 },
  totalGifts: { type: Number, default: 0 },
  totalChats: { type: Number, default: 0 },
  // Spirit collection
  spirits: [
    {
      name: { type: String },
      obtained: { type: Date },
      affinity: { type: Number, default: 0 },
      interactions: {
        dates: { type: Number, default: 0 },
        gifts: { type: Number, default: 0 },
        chats: { type: Number, default: 0 },
      },
      lastInteraction: { type: Date },
    },
  ],
  // Achievement tracking
  achievements: {
    maxAffinity: { type: Number, default: 0 },
    perfectDates: { type: Number, default: 0 },
    perfectGifts: { type: Number, default: 0 },
    spiritsUnlocked: { type: Number, default: 0 },
    maxDateStreak: { type: Number, default: 0 },
  },
});

// Helper method to find or create spirit in collection
profileSchema.methods.findOrCreateSpirit = async function (spiritName) {
  let spirit = this.spirits.find((s) => s.name === spiritName);

  if (!spirit) {
    spirit = {
      name: spiritName,
      obtained: new Date(),
      affinity: 0,
      interactions: {
        dates: 0,
        gifts: 0,
        chats: 0,
      },
      lastInteraction: new Date(),
    };
    this.spirits.push(spirit);

    // Update achievements
    this.achievements.spiritsUnlocked = this.spirits.length;
    await this.save();
  }

  return spirit;
};

// Method to update spirit affinity
profileSchema.methods.updateAffinity = async function (spiritName, amount) {
  const spirit = await this.findOrCreateSpirit(spiritName);
  spirit.affinity += amount;

  // Update main affinity if this is the selected spirit
  if (this.selected === spiritName) {
    this.affinity += amount;
  }

  // Update achievement if new max reached
  this.achievements.maxAffinity = Math.max(
    this.achievements.maxAffinity,
    spirit.affinity
  );

  await this.save();
  return spirit.affinity;
};

// Method to record interaction
profileSchema.methods.recordInteraction = async function (spiritName, type) {
  const spirit = await this.findOrCreateSpirit(spiritName);

  switch (type) {
    case "date":
      spirit.interactions.dates++;
      this.totalDates++;

      // Update date streak
      const now = new Date();
      const lastDate = this.lastDate || new Date(0);
      const daysSinceLastDate = Math.floor(
        (now - lastDate) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastDate <= 1) {
        this.dateStreak++;
        this.achievements.maxDateStreak = Math.max(
          this.achievements.maxDateStreak,
          this.dateStreak
        );
      } else if (daysSinceLastDate > 1) {
        this.dateStreak = 1;
      }

      this.lastDate = now;
      break;

    case "gift":
      spirit.interactions.gifts++;
      this.totalGifts++;
      break;

    case "chat":
      spirit.interactions.chats++;
      this.totalChats++;
      break;
  }

  spirit.lastInteraction = new Date();
  await this.save();

  return {
    totalInteractions:
      spirit.interactions.dates +
      spirit.interactions.gifts +
      spirit.interactions.chats,
    streakDays: this.dateStreak,
  };
};

// Method to check if interaction cooldown has passed
profileSchema.methods.canInteract = function (spiritName, type, cooldownHours) {
  const spirit = this.spirits.find((s) => s.name === spiritName);
  if (!spirit) return true;

  const now = new Date();
  const lastInteraction = spirit.lastInteraction || new Date(0);
  const hoursSinceLastInteraction = (now - lastInteraction) / (1000 * 60 * 60);

  return hoursSinceLastInteraction >= cooldownHours;
};

export default mongoose.model("Profile", profileSchema);
