import { Events } from "discord.js";
import { MemberActivity } from "../schema/serverStats.js";
import pkg from "@napi-rs/canvas";
const { createCanvas, GlobalFonts } = pkg;

// Verify font registration
try {
  // We'll use the system font as a fallback, so no need to register custom fonts here
  console.log("Stats interaction handler initialized");
} catch (error) {
  console.error("Error initializing stats interaction handler:", error);
}

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (!interaction.customId.startsWith("timeframe_select")) return;

    try {
      await interaction.deferUpdate();
      // Handle stats interaction logic here
      // Note: Chart generation is handled by chartGenerator.js
    } catch (error) {
      console.error("Error handling stats interaction:", error);
      await interaction.editReply({
        content: "An error occurred while updating the statistics display.",
        ephemeral: true,
      });
    }
  },
};
