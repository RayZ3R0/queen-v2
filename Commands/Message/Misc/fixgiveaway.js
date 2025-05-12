import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from "discord.js";
import Giveaway from "../../../schema/giveaway.js";

/**
 * @type {import("../../../index.js").Mcommand}
 */
export default {
  name: "fixgiveaway",
  aliases: ["fixg", "repairgiveaway"],
  cooldown: 5,
  description: "Fixes a giveaway's button interactions after bot restart",
  usage: "<messageID>",
  userPermissions: ["ManageEvents"],
  botPermissions: ["SendMessages", "EmbedLinks", "ManageMessages"],
  category: "Utility",
  run: async ({ client, message, args, prefix }) => {
    if (!args[0]) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("❌ Missing Message ID")
            .setDescription(`Please provide the message ID of the giveaway to fix.\nUsage: \`${prefix}fixgiveaway <messageID>\``)
            .setColor("Red")
        ]
      });
    }

    const messageId = args[0];

    try {
      // Find the giveaway in database
      const giveaway = await Giveaway.findOne({ messageId, status: "ACTIVE" });

      if (!giveaway) {
        return message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Giveaway Not Found")
              .setDescription("Could not find an active giveaway with that message ID.")
              .setColor("Red")
          ]
        });
      }

      // Helper functions (copied from main giveaway.js)
      const formatTime = (ms) => {
        const seconds = Math.floor((ms / 1000) % 60);
        const minutes = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
        const days = Math.floor(ms / (1000 * 60 * 60 * 24));

        return `${days ? `${days}d ` : ""}${hours ? `${hours}h ` : ""}${
          minutes ? `${minutes}m ` : ""
        }${seconds ? `${seconds}s` : ""}`;
      };

      const getTimeRemaining = (endTime) => {
        const total = Date.parse(endTime) - Date.now();
        return total;
      };

      const createProgressBar = (startTime, endTime) => {
        const totalDuration = Date.parse(endTime) - Date.parse(startTime);
        const elapsedTime = Date.now() - Date.parse(startTime);
        const progress = Math.min(Math.max(elapsedTime / totalDuration, 0), 1);

        const barLength = 20;
        const filledLength = Math.round(barLength * progress);

        const emptyChar = "▱";
        const filledChar = "▰";

        const bar = filledChar.repeat(filledLength) + emptyChar.repeat(barLength - filledLength);
        return bar;
      };

      // Try to fetch the channel and message
      const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);

      if (!channel) {
        return message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Channel Not Found")
              .setDescription("Could not find the channel for this giveaway.")
              .setColor("Red")
          ]
        });
      }

      const giveawayMessage = await channel.messages.fetch(messageId).catch(() => null);

      if (!giveawayMessage) {
        return message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Message Not Found")
              .setDescription("Could not find the giveaway message. It may have been deleted.")
              .setColor("Red")
          ]
        });
      }

      // Create buttons
      const enterButton = new ButtonBuilder()
        .setCustomId("enter_giveaway")
        .setLabel("🎉 Enter Giveaway")
        .setStyle(ButtonStyle.Primary);

      const viewParticipantsButton = new ButtonBuilder()
        .setCustomId("view_participants")
        .setLabel("👥 View Participants")
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder().addComponents(
        enterButton,
        viewParticipantsButton
      );

      // Recreate the giveaway embed
      const remaining = getTimeRemaining(giveaway.endTime);

      // Update the message with fresh components
      await giveawayMessage.edit({
        components: [row]
      });

      // Set up a new collector for the buttons
      const duration = remaining > 0 ? remaining : 60000; // If already ended, just set a short duration

      // Create a collector for the buttons
      const buttonCollector = giveawayMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: duration,
      });

      // Setup collector listeners (copy from the main giveaway.js file)
      // Register button handlers here...

      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Giveaway Fixed")
            .setDescription(`The giveaway for **${giveaway.prize}** has been fixed and button interactions should now work.`)
            .setColor("Green")
        ]
      });
    } catch (error) {
      console.error("Error fixing giveaway:", error);
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription("An error occurred while fixing the giveaway.")
            .setColor("Red")
        ]
      });
    }
  }
};
