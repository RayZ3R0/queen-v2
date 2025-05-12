import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import Giveaway from "../../../schema/giveaway.js";

/**
 * @type {import("../../../index.js").Mcommand}
 */
export default {
  name: "fixthisgiveaway",
  cooldown: 5,
  description: "Fixes the specific Discord Nitro giveaway",
  userPermissions: ["ManageEvents"],
  botPermissions: ["SendMessages", "EmbedLinks", "ManageMessages"],
  category: "Utility",
  run: async ({ client, message, prefix }) => {
    try {
      // This is hardcoded for the specific giveaway
      const giveawayId = "6822227db347a2e2ed248424";
      const messageId = "1371525315981217835";
      const channelId = "981108841452277770";

      // Find the giveaway in database
      const giveaway = await Giveaway.findById(giveawayId);

      if (!giveaway || giveaway.status !== "ACTIVE") {
        return message.channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Giveaway Not Found or Not Active")
              .setDescription("Could not find the active Discord Nitro giveaway.")
              .setColor("Red")
          ]
        });
      }

      // Helper functions
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

      const createGiveawayEmbed = async (giveaway, remaining) => {
        const timeBar = createProgressBar(giveaway.startTime, giveaway.endTime);

        let roleText = "";
        if (giveaway.requiredRoleId) {
          const role = message.guild.roles.cache.get(giveaway.requiredRoleId);
          if (role) {
            roleText = `\n\n**Required Role:** ${role}`;
          }
        }

        let statusColor = "#FF73FA"; // Default: Pink
        let timeRemaining = formatTime(remaining);

        if (remaining <= 0) {
          timeRemaining = "Ended!";
          statusColor = "#808080"; // Gray for ended giveaways
        } else if (remaining < 1000 * 60 * 30) {
          statusColor = "#FF0000"; // Red when less than 30 min
        } else if (remaining < 1000 * 60 * 60 * 3) {
          statusColor = "#FFA500"; // Orange when less than 3 hours
        }

        return new EmbedBuilder()
          .setTitle(`🎉 GIVEAWAY: ${giveaway.prize}`)
          .setDescription(
            `${giveaway.description ? `${giveaway.description}\n\n` : ""}` +
              `**Host:** <@${giveaway.creatorId}>\n` +
              `**Winners:** ${giveaway.winnerCount}\n` +
              `**Ends:** <t:${Math.floor(giveaway.endTime / 1000)}:R>\n` +
              `**Entries:** ${giveaway.participants.length}${roleText}\n\n` +
              `${timeBar} ${timeRemaining}`,
          )
          .setColor(statusColor)
          .setThumbnail(message.guild.iconURL({ dynamic: true }))
          .setFooter({
            text: `Giveaway ID: ${giveaway._id}`,
          })
          .setTimestamp(giveaway.endTime);
      };

      // Try to fetch the channel and message
      const channel = await client.channels.fetch(channelId);

      const giveawayMessage = await channel.messages.fetch(messageId);

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
      const updatedEmbed = await createGiveawayEmbed(giveaway, remaining);

      // Update the message with fresh components
      await giveawayMessage.edit({
        embeds: [updatedEmbed],
        components: [row]
      });

      // Set up a new collector for the buttons
      const duration = remaining > 0 ? remaining : 60000; // If already ended, just set a short duration

      // Create a collector for the buttons
      const buttonCollector = giveawayMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: duration,
      });

      buttonCollector.on("collect", async (interaction) => {
        // Fetch the latest giveaway data
        const currentGiveaway = await Giveaway.findById(giveawayId);

        if (!currentGiveaway || currentGiveaway.status !== "ACTIVE") {
          return interaction.reply({
            content: "This giveaway has ended or been cancelled.",
            ephemeral: true,
          });
        }

        // Handle role requirement
        if (
          currentGiveaway.requiredRoleId &&
          !interaction.member.roles.cache.has(currentGiveaway.requiredRoleId)
        ) {
          const requiredRole = interaction.guild.roles.cache.get(
            currentGiveaway.requiredRoleId
          );
          return interaction.reply({
            content: `You need the ${requiredRole} role to enter this giveaway!`,
            ephemeral: true,
          });
        }

        switch (interaction.customId) {
          case "enter_giveaway": {
            const isParticipant = currentGiveaway.participants.includes(
              interaction.user.id
            );

            if (isParticipant) {
              // Remove user from participants
              await Giveaway.findByIdAndUpdate(currentGiveaway._id, {
                $pull: { participants: interaction.user.id },
              });

              await interaction.reply({
                content: "You have left the giveaway!",
                ephemeral: true,
              });
            } else {
              // Add user to participants
              await Giveaway.findByIdAndUpdate(currentGiveaway._id, {
                $push: { participants: interaction.user.id },
              });

              await interaction.reply({
                content: "You have entered the giveaway! Good luck! 🍀",
                ephemeral: true,
              });
            }

            // Update the embed
            const updatedGiveaway = await Giveaway.findById(currentGiveaway._id);
            const remaining = getTimeRemaining(updatedGiveaway.endTime);
            const updatedEmbed = await createGiveawayEmbed(
              updatedGiveaway,
              remaining
            );

            await giveawayMessage.edit({
              embeds: [updatedEmbed],
              components: [row]
            });
            break;
          }

          case "view_participants": {
            const participants = currentGiveaway.participants.map(
              (id) => `<@${id}>`
            );

            const participantsChunks = [];
            let currentChunk = "";

            for (const participant of participants) {
              if (currentChunk.length + participant.length > 1900) {
                participantsChunks.push(currentChunk);
                currentChunk = participant;
              } else {
                currentChunk += (currentChunk ? ", " : "") + participant;
              }
            }

            if (currentChunk) {
              participantsChunks.push(currentChunk);
            }

            if (participantsChunks.length === 0) {
              participantsChunks.push("No participants yet.");
            }

            const firstChunk = participantsChunks[0];

            await interaction.reply({
              content: `**Participants (${currentGiveaway.participants.length}):** ${firstChunk}${
                participantsChunks.length > 1
                  ? "\n\n*Too many participants to display all at once.*"
                  : ""
              }`,
              ephemeral: true,
            });
            break;
          }
        }
      });

      // Setup interval to update the giveaway message periodically
      const intervalId = setInterval(async () => {
        try {
          const currentGiveaway = await Giveaway.findById(giveawayId);

          if (!currentGiveaway || currentGiveaway.status !== "ACTIVE") {
            clearInterval(intervalId);
            return;
          }

          const remaining = getTimeRemaining(currentGiveaway.endTime);

          // Only update every minute to avoid rate limits
          if (remaining <= 0) {
            clearInterval(intervalId);
            // Let the normal giveaway end process take over
            return;
          }

          const updatedEmbed = await createGiveawayEmbed(
            currentGiveaway,
            remaining
          );

          await giveawayMessage.edit({
            embeds: [updatedEmbed],
            components: [row]
          });
        } catch (error) {
          console.error("Error updating giveaway:", error);
          clearInterval(intervalId);
        }
      }, 60000);

      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Discord Nitro Giveaway Fixed")
            .setDescription("The Discord Nitro giveaway button interactions have been restored!")
            .setColor("Green")
        ]
      });
    } catch (error) {
      console.error("Error fixing giveaway:", error);
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("❌ Error")
            .setDescription(`An error occurred while fixing the giveaway: ${error.message}`)
            .setColor("Red")
        ]
      });
    }
  }
};
