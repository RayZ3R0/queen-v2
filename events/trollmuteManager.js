import trollmutedb from "../schema/trollmutedb.js";

/**
 * Trollmute manager that handles cycling users between muted and speaking states
 * @param {Client} client - Discord.js client
 */
export default async (client) => {
  console.log("TrollMute Manager initialized");

  // Check interval for trollmutes (every 10 seconds)
  const CHECK_INTERVAL = 10000;

  // Map to track users who haven't spoken after being notified
  // Key format: "guildId-userId"
  const silentUsers = new Map();

  // Map to track if this is the user's first cycle (always send notification for first unmute)
  // Key format: "guildId-userId"
  const firstCycleUsers = new Map();

  // Listen for messages to track user activity
  client.on("messageCreate", async (message) => {
    try {
      // Skip bot messages
      if (message.author.bot) return;

      // Only process messages from users in unmuted speaking window
      const trollMute = await trollmutedb.findOne({
        guild: message.guild?.id,
        user: message.author.id,
        active: true,
        currentlyMuted: false, // Only track when they're unmuted
      });

      if (trollMute) {
        const userKey = `${message.guild.id}-${message.author.id}`;
        if (silentUsers.has(userKey)) {
          // User has broken their silence, remove from silent list
          silentUsers.delete(userKey);
          console.log(`User ${message.author.tag} has broken their silence`);
        }
      }
    } catch (error) {
      console.error("Error tracking user activity:", error);
    }
  });

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
          // console.log(
          //   `Could not find member ${trollMute.user} in guild ${guild.name}, skipping`
          // );
          continue;
        }

        const timeSinceLastCycle = now - trollMute.lastCycleTime;
        const userKey = `${guild.id}-${member.id}`;

        // User is currently muted, check if it's time to unmute
        if (trollMute.currentlyMuted) {
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

            // IMPORTANT CHANGE: Only send unmute notification if:
            // 1. This is their first cycle, OR
            // 2. They spoke during their previous speaking window
            const isFirstCycle = firstCycleUsers.has(userKey);
            const spokeDuringLastWindow = !silentUsers.has(userKey);

            if (isFirstCycle || spokeDuringLastWindow) {
              // If it's their first cycle, mark it as no longer their first cycle
              if (isFirstCycle) {
                firstCycleUsers.delete(userKey);
                console.log(`First cycle completed for ${member.user.tag}`);
              }

              // Add them to silent users for this new window
              silentUsers.set(userKey, true);

              // Send unmute notification
              try {
                const channel = guild.channels.cache.get(trollMute.channelId);
                const targetChannel =
                  channel
                    ?.permissionsFor(guild.members.me)
                    ?.has("SendMessages") &&
                    channel?.permissionsFor(member)?.has("ViewChannel")
                    ? channel
                    : guild.channels.cache.find(
                      (c) =>
                        c.type === 0 &&
                        c
                          .permissionsFor(guild.members.me)
                          ?.has("SendMessages") &&
                        c.permissionsFor(member)?.has("ViewChannel")
                    );

                if (targetChannel) {
                  await targetChannel.send({
                    content: `<@${member.id}> You have ${trollMute.speakDuration / 1000
                      } seconds to speak before being sent to the shadow realm again!`,
                    allowedMentions: { users: [member.id] },
                  });
                  console.log(
                    `Sent unmute notification in ${targetChannel.name}`
                  );
                }
              } catch (error) {
                console.error("Error sending unmute notification:", error);
              }
            } else {
              console.log(
                `Skipping unmute notification for ${member.user.tag} as they didn't speak in their previous window`
              );
            }
          }
        }
        // User is in speaking window, check if it's time to re-mute
        else {
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
              `Applied timeout of ${timeoutDuration / 1000}s to ${member.user.tag
              }`
            );

            // Only send a mute notification if the user actually spoke during their window
            try {
              const channel = guild.channels.cache.get(trollMute.channelId);
              if (
                channel &&
                channel.permissionsFor(guild.members.me).has("SendMessages")
              ) {
                // Check if user is in silent list (didn't speak during their window)
                if (!silentUsers.has(userKey)) {
                  // User spoke during their window, so send a notification
                  // await channel.send({
                  //   content: `${member} has been muted again for ${
                  //     trollMute.muteDuration / 1000
                  //   } seconds.`,
                  //   allowedMentions: { users: [] },
                  // });
                  console.log(
                    `Sent mute notification in channel ${channel.name}`
                  );
                } else {
                  // User didn't speak, don't send a notification
                  console.log(
                    `User ${member.user.tag} didn't speak during their window, skipping mute notification`
                  );
                }

                // Remove from silent users map as we're starting a new cycle
                // Note: We don't reset it if they didn't speak, as we use that state for the next unmute decision
              }
            } catch (error) {
              console.error("Error sending mute notification:", error);
            }
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

  // Run once immediately - and mark all users as being in their first cycle
  try {
    const activeTrollMutes = await trollmutedb.find({ active: true });
    for (const trollMute of activeTrollMutes) {
      const userKey = `${trollMute.guild}-${trollMute.user}`;
      firstCycleUsers.set(userKey, true);
      console.log(
        `Marked ${trollMute.user} in guild ${trollMute.guild} as in first cycle`
      );
    }

    await manageTrollMutes();
  } catch (err) {
    console.error("Error in initial trollmute check:", err);
  }

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
        // Mark as first cycle when they rejoin
        const userKey = `${member.guild.id}-${member.id}`;
        firstCycleUsers.set(userKey, true);

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

  // When a new trollmute is created, mark it as first cycle
  client.on("trollmuteCreated", (guildId, userId) => {
    const userKey = `${guildId}-${userId}`;
    firstCycleUsers.set(userKey, true);
    console.log(
      `Marked new trollmute for ${userId} in guild ${guildId} as in first cycle`
    );
  });
};
