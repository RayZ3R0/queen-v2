import { client } from "../bot.js";
import trollmutedb from "../schema/trollmutedb.js";

// Check interval for trollmutes (every 15 seconds)
const CHECK_INTERVAL = 15000;

// Function to manage trollmute cycles
async function manageTrollMutes() {
  try {
    // Get all active trollmutes
    const activeTrollMutes = await trollmutedb.find({ active: true });

    if (activeTrollMutes.length === 0) return;

    const now = Date.now();

    for (const trollMute of activeTrollMutes) {
      // Check if trollmute has expired based on total duration
      if (trollMute.expiresAt !== 0 && now > trollMute.expiresAt) {
        trollMute.active = false;
        await trollMute.save();

        // Try to find the user and remove timeout
        try {
          const guild = client.guilds.cache.get(trollMute.guild);
          if (guild) {
            const member = await guild.members
              .fetch(trollMute.user)
              .catch(() => null);
            if (member && member.communicationDisabledUntil) {
              await member.timeout(null, "TrollMute duration expired");
            }
          }
        } catch (error) {
          console.error("Error removing timeout for expired trollmute:", error);
        }
        continue;
      }

      // Handle cycle changes
      const guild = client.guilds.cache.get(trollMute.guild);
      if (!guild) continue;

      const member = await guild.members
        .fetch(trollMute.user)
        .catch(() => null);
      if (!member) continue;

      const timeSinceLastCycle = now - trollMute.lastCycleTime;

      if (trollMute.currentlyMuted) {
        // Check if mute duration has passed
        if (timeSinceLastCycle >= trollMute.muteDuration) {
          // Switch to speaking period
          trollMute.currentlyMuted = false;
          trollMute.lastCycleTime = now;
          await trollMute.save();

          // Remove timeout
          await member.timeout(null, "TrollMute speaking window");

          // Ping the user to let them know they can speak
          try {
            // Try to get the channel where trollmute was activated
            const channel = guild.channels.cache.get(trollMute.channelId);

            // If that channel is not accessible, fall back to finding an appropriate channel
            if (
              !channel ||
              !channel.permissionsFor(guild.members.me).has("SendMessages") ||
              !channel.permissionsFor(member).has("ViewChannel")
            ) {
              // Fall back to finding an appropriate channel
              const fallbackChannel = guild.channels.cache.find(
                (c) =>
                  c.type === 0 && // Text channel
                  c.permissionsFor(guild.members.me).has("SendMessages") &&
                  c.permissionsFor(member).has("ViewChannel")
              );

              if (fallbackChannel) {
                await fallbackChannel.send({
                  content: `<@${member.id}> You have ${
                    trollMute.speakDuration / 1000
                  } seconds to speak before being muted again!`,
                  allowedMentions: { users: [member.id] },
                });
              }
            } else {
              // Use the original channel where trollmute was activated
              await channel.send({
                content: `<@${member.id}> You have ${
                  trollMute.speakDuration / 1000
                } seconds to speak before being muted again!`,
                allowedMentions: { users: [member.id] },
              });
            }
          } catch (error) {
            console.error(
              "Error pinging user for trollmute speaking window:",
              error
            );
          }
        }
      } else {
        // Check if speaking duration has passed
        if (timeSinceLastCycle >= trollMute.speakDuration) {
          // Switch to muted period
          trollMute.currentlyMuted = true;
          trollMute.lastCycleTime = now;
          await trollMute.save();

          // Apply timeout
          await member.timeout(trollMute.muteDuration, "TrollMute cycle");
        }
      }
    }
  } catch (error) {
    console.error("Error in trollmute manager:", error);
  }
}

// Initialize the interval when the bot starts
client.once("ready", () => {
  console.log("TrollMute Manager initialized");
  setInterval(manageTrollMutes, CHECK_INTERVAL);
});
