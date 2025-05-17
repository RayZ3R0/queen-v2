import trollmutedb from "../schema/trollmutedb.js";

/**
 * Trollmute manager that handles cycling users between muted and speaking states
 * @param {Client} client - Discord.js client
 */
export default async (client) => {
  console.log("TrollMute Manager initialized");

  // Check interval for trollmutes (every 5 seconds to be more responsive)
  const CHECK_INTERVAL = 5000;

  // Function to manage trollmute cycles
  async function manageTrollMutes() {
    try {
      // Get all active trollmutes
      const activeTrollMutes = await trollmutedb.find({ active: true });

      if (activeTrollMutes.length === 0) return;

      const now = Date.now();

      for (const trollMute of activeTrollMutes) {
        // Debug log to track each trollmute being processed
        console.log(
          `Processing trollmute for user ${trollMute.user} in guild ${trollMute.guild}`
        );
        console.log(
          `Current state: ${trollMute.currentlyMuted ? "Muted" : "Speaking"}`
        );
        console.log(
          `Last cycle time: ${new Date(trollMute.lastCycleTime).toISOString()}`
        );
        console.log(
          `Time since last cycle: ${now - trollMute.lastCycleTime}ms`
        );

        // Check if trollmute has expired based on total duration
        if (trollMute.expiresAt !== 0 && now > trollMute.expiresAt) {
          console.log(
            `Trollmute expired for user ${trollMute.user}, deactivating`
          );
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
                console.log(
                  `Removed timeout for user ${member.user.tag} as trollmute expired`
                );
              }
            }
          } catch (error) {
            console.error(
              "Error removing timeout for expired trollmute:",
              error
            );
          }
          continue;
        }

        // Handle cycle changes
        const guild = client.guilds.cache.get(trollMute.guild);
        if (!guild) {
          console.log(`Could not find guild ${trollMute.guild}, skipping`);
          continue;
        }

        const member = await guild.members
          .fetch(trollMute.user)
          .catch(() => null);
        if (!member) {
          console.log(
            `Could not find member ${trollMute.user} in guild ${guild.name}, skipping`
          );
          continue;
        }

        const timeSinceLastCycle = now - trollMute.lastCycleTime;

        // Check if user is currently muted in database
        if (trollMute.currentlyMuted) {
          console.log(
            `User ${member.user.tag} is in muted state, checking if it's time to unmute`
          );
          // Check if mute duration has passed
          if (timeSinceLastCycle >= trollMute.muteDuration) {
            console.log(`Time to unmute user ${member.user.tag}`);

            // Switch to speaking period
            trollMute.currentlyMuted = false;
            trollMute.lastCycleTime = now;
            await trollMute.save();

            // Remove timeout
            await member.timeout(null, "TrollMute speaking window");
            console.log(
              `Removed timeout for ${member.user.tag} for speaking window`
            );

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
                console.log(
                  `Original channel not accessible, finding fallback channel`
                );
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
                  console.log(
                    `Sent notification in fallback channel ${fallbackChannel.name}`
                  );
                }
              } else {
                // Use the original channel where trollmute was activated
                await channel.send({
                  content: `<@${member.id}> You have ${
                    trollMute.speakDuration / 1000
                  } seconds to speak before being muted again!`,
                  allowedMentions: { users: [member.id] },
                });
                console.log(
                  `Sent notification in original channel ${channel.name}`
                );
              }
            } catch (error) {
              console.error(
                "Error pinging user for trollmute speaking window:",
                error
              );
            }
          } else {
            console.log(
              `Still ${
                (trollMute.muteDuration - timeSinceLastCycle) / 1000
              } seconds until unmute for ${member.user.tag}`
            );
          }
        } else {
          console.log(
            `User ${member.user.tag} is in speaking state, checking if it's time to re-mute`
          );
          // User is in speaking window, check if speaking time is up
          if (timeSinceLastCycle >= trollMute.speakDuration) {
            console.log(`Time to re-mute user ${member.user.tag}`);

            // Switch to muted period
            trollMute.currentlyMuted = true;
            trollMute.lastCycleTime = now;
            await trollMute.save();

            // Apply timeout - but make sure it's not longer than Discord's maximum (28 days)
            const timeoutDuration = Math.min(
              trollMute.muteDuration,
              2419200000
            ); // 28 days in ms
            await member.timeout(timeoutDuration, "TrollMute cycle");
            console.log(
              `Applied timeout of ${timeoutDuration / 1000}s to ${
                member.user.tag
              }`
            );

            // Notify the channel that the user has been muted again
            try {
              const channel = guild.channels.cache.get(trollMute.channelId);
              if (
                channel &&
                channel.permissionsFor(guild.members.me).has("SendMessages")
              ) {
                await channel.send({
                  content: `${member} has been muted again for ${
                    trollMute.muteDuration / 1000
                  } seconds.`,
                  allowedMentions: { users: [] }, // Don't ping on this message
                });
                console.log(
                  `Sent mute notification in channel ${channel.name}`
                );
              }
            } catch (error) {
              console.error("Error sending mute notification:", error);
            }
          } else {
            console.log(
              `Still ${
                (trollMute.speakDuration - timeSinceLastCycle) / 1000
              } seconds of speaking time for ${member.user.tag}`
            );
          }
        }
      }
    } catch (error) {
      console.error("Error in trollmute manager:", error);
    }
  }

  // Set up the interval
  const intervalId = setInterval(manageTrollMutes, CHECK_INTERVAL);

  // Store the interval ID so it can be cleared if needed
  client.trollMuteInterval = intervalId;

  // Run once immediately
  manageTrollMutes().catch((err) =>
    console.error("Error in initial trollmute check:", err)
  );

  console.log(
    `TrollMute cycle checker running every ${CHECK_INTERVAL / 1000} seconds`
  );

  // Handle guild member add to catch people who leave and rejoin
  client.on("guildMemberAdd", async (member) => {
    try {
      const activeTrollMute = await trollmutedb.findOne({
        guild: member.guild.id,
        user: member.id,
        active: true,
      });

      if (activeTrollMute) {
        console.log(
          `User ${member.user.tag} rejoined with an active trollmute`
        );
        // If they were in a muted state when they left, re-apply timeout
        if (activeTrollMute.currentlyMuted) {
          await member.timeout(
            Math.min(activeTrollMute.muteDuration, 2419200000),
            "TrollMute reapplied after rejoin"
          );
          console.log(`Applied timeout to rejoined user ${member.user.tag}`);
        }
      }
    } catch (error) {
      console.error("Error checking rejoining member for trollmute:", error);
    }
  });

  // No need for the SIGINT handler here - it should be handled by your main process
};
