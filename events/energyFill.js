import { client } from "../bot.js";
import profileSchema from "../schema/profile.js";

client.on("ready", () => {
  // Update energy every 12 minutes
  setInterval(async () => {
    try {
      // Retrieve all profiles
      const allProfiles = await profileSchema.find();
      for (const profile of allProfiles) {
        try {
          // Skip if user has no selected spirit.
          if (profile.selected === "None") continue;
          const currentEnergy = profile.energy;
          // If energy already at or above 60, do nothing.
          if (currentEnergy >= 60) continue;
          // Increase energy by 1.
          await profileSchema.findOneAndUpdate(
            { userid: profile.userid },
            { energy: currentEnergy + 1 }
          );
        } catch (innerError) {
          console.error(
            `Error updating energy for user ${profile.userid}:`,
            innerError
          );
        }
      }
    } catch (error) {
      console.error("Error in energy fill interval:", error);
    }
  }, 12 * 60 * 1000);
});
