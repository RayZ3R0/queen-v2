import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ChannelType, // Add this missing import
} from "discord.js";
import Giveaway from "../schema/giveaway.js";
import { client } from "../bot.js";

// Store active intervals to clean them up properly
const activeIntervals = new Map();

/**
 * Handles the setup of active giveaways when the bot starts
 */
export default async (client) => {
  try {
    // Find all active giveaways
    const activeGiveaways = await Giveaway.find({ status: "ACTIVE" });
    console.log(`Found ${activeGiveaways.length} active giveaways on startup`);

    // Process each active giveaway
    for (const giveaway of activeGiveaways) {
      try {
        const remainingTime = new Date(giveaway.endTime) - new Date();

        // If giveaway should have ended while bot was offline
        if (remainingTime <= 0) {
          console.log(
            `Processing missed giveaway end: ${giveaway.prize} (ID: ${giveaway._id})`
          );
          await handleGiveawayEnd(giveaway);
          continue;
        }

        // Set up the giveaway with buttons and collectors
        await setupGiveawayInteractions(giveaway);

        // Create timer for active giveaway
        setTimeout(async () => {
          await handleGiveawayEnd(giveaway);
        }, remainingTime);

        console.log(
          `Scheduled giveaway end for: ${giveaway.prize} (Ends in: ${Math.floor(
            remainingTime / 1000 / 60
          )} minutes)`
        );
      } catch (error) {
        console.error(`Error processing giveaway ${giveaway._id}:`, error);
      }
    }
  } catch (error) {
    console.error("Error loading active giveaways:", error);
  }
};

// Function to set up giveaway interactions (buttons and collectors)
async function setupGiveawayInteractions(giveaway) {
  try {
    const channel = await client.channels
      .fetch(giveaway.channelId)
      .catch(() => null);
    if (!channel) return;

    const message = await channel.messages
      .fetch(giveaway.messageId)
      .catch(() => null);
    if (!message) return;

    // Clean up any existing interval for this giveaway
    if (activeIntervals.has(giveaway._id.toString())) {
      clearInterval(activeIntervals.get(giveaway._id.toString()));
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

    // Update the message with fresh embed and components
    const remaining = new Date(giveaway.endTime) - new Date();
    const updatedEmbed = await createGiveawayEmbed(giveaway, remaining);

    await message.edit({
      embeds: [updatedEmbed],
      components: [row],
    });

    // Create a new collector for the buttons
    const buttonCollector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: remaining > 0 ? remaining : 0,
    });

    buttonCollector.on("collect", async (interaction) => {
      await handleGiveawayInteraction(interaction, giveaway._id);
    });

    // Set up interval to update the giveaway message every minute
    const intervalId = setInterval(async () => {
      try {
        const currentGiveaway = await Giveaway.findById(giveaway._id);

        if (!currentGiveaway || currentGiveaway.status !== "ACTIVE") {
          clearInterval(intervalId);
          activeIntervals.delete(giveaway._id.toString());
          return;
        }

        const remaining = new Date(currentGiveaway.endTime) - new Date();

        // Only update every minute to avoid rate limits
        if (remaining <= 0) {
          clearInterval(intervalId);
          activeIntervals.delete(giveaway._id.toString());
          return;
        }

        const updatedEmbed = await createGiveawayEmbed(
          currentGiveaway,
          remaining
        );

        await message.edit({
          embeds: [updatedEmbed],
          components: [row],
        });
      } catch (error) {
        console.error("Error updating giveaway:", error);
        clearInterval(intervalId);
        activeIntervals.delete(giveaway._id.toString());
      }
    }, 60000); // Update every minute

    // Store the interval ID for cleanup
    activeIntervals.set(giveaway._id.toString(), intervalId);
  } catch (error) {
    console.error("Error setting up giveaway interactions:", error);
  }
}

// Handle giveaway button interactions
async function handleGiveawayInteraction(interaction, giveawayId) {
  try {
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
        const remaining = new Date(updatedGiveaway.endTime) - new Date();
        const updatedEmbed = await createGiveawayEmbed(
          updatedGiveaway,
          remaining
        );

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

        await interaction.message.edit({
          embeds: [updatedEmbed],
          components: [row],
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
          content: `**Participants (${
            currentGiveaway.participants.length
          }):** ${firstChunk}${
            participantsChunks.length > 1
              ? "\n\n*Too many participants to display all at once.*"
              : ""
          }`,
          ephemeral: true,
        });
        break;
      }
    }
  } catch (error) {
    console.error("Error in giveaway interaction:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ An error occurred. Please try again later.",
        ephemeral: true,
      });
    }
  }
}

// Helper function to create giveaway embed
async function createGiveawayEmbed(giveaway, remaining) {
  let roleText = "";
  if (giveaway.requiredRoleId) {
    const guild = await client.guilds.fetch(giveaway.guildId);
    if (guild) {
      const role = guild.roles.cache.get(giveaway.requiredRoleId);
      if (role) {
        roleText = `\n\n**Required Role:** ${role.name}`;
      }
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

  const timeBar = createProgressBar(giveaway.startTime, giveaway.endTime);

  return new EmbedBuilder()
    .setTitle(`🎉 GIVEAWAY: ${giveaway.prize}`)
    .setDescription(
      `${giveaway.description ? `${giveaway.description}\n\n` : ""}` +
        `**Host:** <@${giveaway.creatorId}>\n` +
        `**Winners:** ${giveaway.winnerCount}\n` +
        `**Ends:** <t:${Math.floor(giveaway.endTime / 1000)}:R>\n` +
        `**Entries:** ${giveaway.participants.length}${roleText}\n\n` +
        `${timeBar} ${timeRemaining}`
    )
    .setColor(statusColor)
    .setFooter({
      text: `Giveaway ID: ${giveaway._id}`,
    })
    .setTimestamp(giveaway.endTime);
}

// Handle giveaway ending
async function handleGiveawayEnd(giveaway) {
  try {
    // Update giveaway status
    await Giveaway.findByIdAndUpdate(giveaway._id, { status: "ENDED" });

    // Select winners
    const winners = selectWinners(giveaway.participants, giveaway.winnerCount);

    // Update giveaway with winners
    if (winners.length > 0) {
      await Giveaway.findByIdAndUpdate(giveaway._id, { winners });
    }

    // Get the channel
    const channel = await client.channels
      .fetch(giveaway.channelId)
      .catch(() => null);
    if (!channel) {
      console.warn(
        `Could not find channel ${giveaway.channelId} for giveaway ${giveaway._id}`
      );
      return;
    }

    // Get the giveaway message
    const giveawayMessage = await channel.messages
      .fetch(giveaway.messageId)
      .catch(() => null);

    // Create ended embed
    const endedEmbed = new EmbedBuilder()
      .setTitle(`🎊 ENDED: ${giveaway.prize}`)
      .setColor("#808080")
      .setTimestamp();

    if (winners.length > 0) {
      const winnerMentions = winners.map((id) => `<@${id}>`).join(", ");
      endedEmbed.setDescription(
        `${giveaway.description ? `${giveaway.description}\n\n` : ""}` +
          `**Winners:** ${winnerMentions}\n` +
          `**Host:** <@${giveaway.creatorId}>\n` +
          `**Entries:** ${giveaway.participants.length}`
      );

      // Send winner announcement
      await channel
        .send({
          content: `🎉 Congratulations ${winnerMentions}! You've won **${giveaway.prize}**!`,
          embeds: [
            new EmbedBuilder()
              .setTitle("🎊 Giveaway Ended")
              .setDescription(
                `**Prize:** ${giveaway.prize}\n**Winners:** ${winnerMentions}`
              )
              .setColor("#FFD700"),
          ],
        })
        .catch(() =>
          console.warn(
            `Could not send winner announcement for giveaway ${giveaway._id}`
          )
        );
    } else {
      endedEmbed.setDescription(
        `${giveaway.description ? `${giveaway.description}\n\n` : ""}` +
          "**Winners:** None (not enough participants)\n" +
          `**Host:** <@${giveaway.creatorId}>\n` +
          `**Entries:** ${giveaway.participants.length}`
      );
    }

    // Update the original giveaway message if it exists
    if (giveawayMessage) {
      await giveawayMessage
        .edit({
          embeds: [endedEmbed],
          components: [],
        })
        .catch(() =>
          console.warn(`Could not update giveaway message for ${giveaway._id}`)
        );
    }
  } catch (error) {
    console.error(`Error ending giveaway ${giveaway._id}:`, error);
  }
}

// Helper function to select random winners
function selectWinners(participants, count) {
  if (!participants || participants.length === 0) return [];

  const winners = [];
  const participantsCopy = [...participants];

  // Select random winners
  const winnerCount = Math.min(count, participantsCopy.length);

  for (let i = 0; i < winnerCount; i++) {
    const randomIndex = Math.floor(Math.random() * participantsCopy.length);
    winners.push(participantsCopy[randomIndex]);
    participantsCopy.splice(randomIndex, 1);
  }

  return winners;
}

// Helper function to format time
function formatTime(ms) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  return `${days ? `${days}d ` : ""}${hours ? `${hours}h ` : ""}${
    minutes ? `${minutes}m ` : ""
  }${seconds ? `${seconds}s` : ""}`;
}

// Helper function to create a progress bar
function createProgressBar(startTime, endTime) {
  const totalDuration = Date.parse(endTime) - Date.parse(startTime);
  const elapsedTime = Date.now() - Date.parse(startTime);
  const progress = Math.min(Math.max(elapsedTime / totalDuration, 0), 1);

  const barLength = 20;
  const filledLength = Math.round(barLength * progress);

  const emptyChar = "▱";
  const filledChar = "▰";

  return (
    filledChar.repeat(filledLength) + emptyChar.repeat(barLength - filledLength)
  );
}

// Export the setup function so it can be called from commands
export { setupGiveawayInteractions, handleGiveawayInteraction };
