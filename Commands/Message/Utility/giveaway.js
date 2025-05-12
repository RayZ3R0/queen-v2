import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ComponentType,
} from "discord.js";
import Giveaway from "../../../schema/giveaway.js";
import ms from "ms";

/**
 * @type {import("../../../index.js").Mcommand}
 */
export default {
  name: "giveaway",
  aliases: ["g", "gift"],
  cooldown: 5,
  description: "Create and manage giveaways in your server",
  usage: "<create/end/reroll/list/cancel> [parameters]",
  userPermissions: ["ManageEvents"],
  botPermissions: ["SendMessages", "EmbedLinks", "ManageMessages"],
  category: "Utility",
  run: async ({ client, message, args, prefix }) => {
    const userId = message.author.id;
    const guildId = message.guild.id;

    // Helper functions
    const createEmbed = (title, description, color = "#FF73FA") => {
      return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp()
        .setFooter({
          text: `Requested by ${message.author.tag}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true }),
        });
    };

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

      const bar =
        filledChar.repeat(filledLength) +
        emptyChar.repeat(barLength - filledLength);

      return bar;
    };

    // Create giveaway embed
    const createGiveawayEmbed = async (giveaway, remaining) => {
      const creator = await client.users.fetch(giveaway.creatorId);
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
          iconURL: creator.displayAvatarURL({ dynamic: true }),
        })
        .setTimestamp(giveaway.endTime);
    };

    // Show help if no arguments provided
    if (!args[0]) {
      const helpEmbed = createEmbed(
        "🎁 Giveaway Command Help",
        `**Available subcommands:**\n
• \`${prefix}giveaway create <duration> <winners> <prize>\` - Create a new giveaway
  Example: \`${prefix}giveaway create 1d 3 Discord Nitro\`

• \`${prefix}giveaway end <messageID>\` - End a giveaway early
  Example: \`${prefix}giveaway end 123456789012345678\`

• \`${prefix}giveaway reroll <messageID> [winners]\` - Reroll winners
  Example: \`${prefix}giveaway reroll 123456789012345678 2\`

• \`${prefix}giveaway list\` - List all active giveaways

• \`${prefix}giveaway cancel <messageID>\` - Cancel a giveaway
  Example: \`${prefix}giveaway cancel 123456789012345678\``,
        "#FF73FA",
      );
      return message.channel.send({ embeds: [helpEmbed] });
    }

    // Get the subcommand
    const subcommand = args[0].toLowerCase();

    try {
      switch (subcommand) {
        case "create": {
          if (args.length < 4) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Missing Arguments",
                  `Please provide all required arguments.\nUsage: \`${prefix}giveaway create <duration> <winners> <prize>\``,
                  "Red",
                ),
              ],
            });
          }

          const duration = ms(args[1]); // Use ms library to parse duration
          if (!duration || isNaN(duration)) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Invalid Duration",
                  "Please provide a valid duration (e.g., 1d, 12h, 30m).",
                  "Red",
                ),
              ],
            });
          }

          if (duration < 30000 || duration > 1000 * 60 * 60 * 24 * 30) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Invalid Duration",
                  "Duration must be between 30 seconds and 30 days.",
                  "Red",
                ),
              ],
            });
          }

          const winnerCount = parseInt(args[2]);
          if (isNaN(winnerCount) || winnerCount < 1 || winnerCount > 20) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Invalid Winner Count",
                  "Winner count must be between 1 and 20.",
                  "Red",
                ),
              ],
            });
          }

          const prize = args.slice(3).join(" ");
          if (prize.length < 1 || prize.length > 256) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Invalid Prize",
                  "Prize must be between 1 and 256 characters.",
                  "Red",
                ),
              ],
            });
          }

          // Ask for optional description
          const promptEmbed = createEmbed(
            "🎁 Giveaway Setup",
            "Would you like to add a description to your giveaway? (Yes/No)\n\nYou have 30 seconds to respond.",
            "#FF73FA",
          );

          let description = "";
          let requiredRoleId = null;

          const promptMsg = await message.channel.send({
            embeds: [promptEmbed],
          });

          const filter = (m) => m.author.id === message.author.id;
          const collector = message.channel.createMessageCollector({
            filter,
            time: 30000,
            max: 1,
          });

          await new Promise((resolve) => {
            collector.on("collect", async (m) => {
              const response = m.content.toLowerCase();

              if (response === "yes" || response === "y") {
                await promptMsg.edit({
                  embeds: [
                    createEmbed(
                      "🎁 Giveaway Setup",
                      "Please enter a description for your giveaway (max 1024 characters).\n\nYou have 60 seconds to respond.",
                      "#FF73FA",
                    ),
                  ],
                });

                const descCollector = message.channel.createMessageCollector({
                  filter,
                  time: 60000,
                  max: 1,
                });

                descCollector.on("collect", async (dm) => {
                  description = dm.content.slice(0, 1024);

                  // Ask for role requirement
                  await promptMsg.edit({
                    embeds: [
                      createEmbed(
                        "🎁 Giveaway Setup",
                        "Would you like to require a role to enter? (Yes/No)\n\nYou have 30 seconds to respond.",
                        "#FF73FA",
                      ),
                    ],
                  });

                  const roleCollector = message.channel.createMessageCollector({
                    filter,
                    time: 30000,
                    max: 1,
                  });

                  roleCollector.on("collect", async (rm) => {
                    const roleResponse = rm.content.toLowerCase();

                    if (roleResponse === "yes" || roleResponse === "y") {
                      await promptMsg.edit({
                        embeds: [
                          createEmbed(
                            "🎁 Giveaway Setup",
                            "Please mention the role or provide its ID.\n\nYou have 30 seconds to respond.",
                            "#FF73FA",
                          ),
                        ],
                      });

                      const finalRoleCollector =
                        message.channel.createMessageCollector({
                          filter,
                          time: 30000,
                          max: 1,
                        });

                      finalRoleCollector.on("collect", async (frm) => {
                        // Try to extract role from mention or ID
                        const roleMatch = frm.content.match(/<@&(\d+)>/) || [
                          null,
                          frm.content,
                        ];
                        const role = message.guild.roles.cache.get(
                          roleMatch[1],
                        );

                        if (role) {
                          requiredRoleId = role.id;
                          resolve();
                        } else {
                          await message.channel.send({
                            embeds: [
                              createEmbed(
                                "❌ Invalid Role",
                                "Could not find the specified role. Continuing without role requirement.",
                                "Red",
                              ),
                            ],
                          });
                          resolve();
                        }
                      });

                      finalRoleCollector.on("end", (collected) => {
                        if (collected.size === 0) resolve();
                      });
                    } else {
                      resolve();
                    }
                  });

                  roleCollector.on("end", (collected) => {
                    if (collected.size === 0) resolve();
                  });
                });

                descCollector.on("end", (collected) => {
                  if (collected.size === 0) resolve();
                });
              } else {
                // Ask for role requirement directly
                await promptMsg.edit({
                  embeds: [
                    createEmbed(
                      "🎁 Giveaway Setup",
                      "Would you like to require a role to enter? (Yes/No)\n\nYou have 30 seconds to respond.",
                      "#FF73FA",
                    ),
                  ],
                });

                const roleCollector = message.channel.createMessageCollector({
                  filter,
                  time: 30000,
                  max: 1,
                });

                roleCollector.on("collect", async (rm) => {
                  const roleResponse = rm.content.toLowerCase();

                  if (roleResponse === "yes" || roleResponse === "y") {
                    await promptMsg.edit({
                      embeds: [
                        createEmbed(
                          "🎁 Giveaway Setup",
                          "Please mention the role or provide its ID.\n\nYou have 30 seconds to respond.",
                          "#FF73FA",
                        ),
                      ],
                    });

                    const finalRoleCollector =
                      message.channel.createMessageCollector({
                        filter,
                        time: 30000,
                        max: 1,
                      });

                    finalRoleCollector.on("collect", async (frm) => {
                      // Try to extract role from mention or ID
                      const roleMatch = frm.content.match(/<@&(\d+)>/) || [
                        null,
                        frm.content,
                      ];
                      const role = message.guild.roles.cache.get(roleMatch[1]);

                      if (role) {
                        requiredRoleId = role.id;
                        resolve();
                      } else {
                        await message.channel.send({
                          embeds: [
                            createEmbed(
                              "❌ Invalid Role",
                              "Could not find the specified role. Continuing without role requirement.",
                              "Red",
                            ),
                          ],
                        });
                        resolve();
                      }
                    });

                    finalRoleCollector.on("end", (collected) => {
                      if (collected.size === 0) resolve();
                    });
                  } else {
                    resolve();
                  }
                });

                roleCollector.on("end", (collected) => {
                  if (collected.size === 0) resolve();
                });
              }
            });

            collector.on("end", (collected) => {
              if (collected.size === 0) resolve();
            });
          });

          // Create giveaway object
          const endTime = new Date(Date.now() + duration);

          // Create giveaway embed before saving to database
          const giveawayObj = {
            _id: "temp",
            guildId,
            creatorId: userId,
            prize,
            description,
            winnerCount,
            participants: [],
            startTime: new Date(),
            endTime,
            status: "ACTIVE",
            requiredRoleId,
          };

          const giveawayEmbed = await createGiveawayEmbed(
            giveawayObj,
            duration,
          );

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
            viewParticipantsButton,
          );

          // Send giveaway message
          const giveawayMessage = await message.channel.send({
            embeds: [giveawayEmbed],
            components: [row],
          });

          // Now save to database with message ID
          const newGiveaway = await Giveaway.create({
            guildId,
            channelId: message.channel.id,
            messageId: giveawayMessage.id,
            creatorId: userId,
            prize,
            description,
            winnerCount,
            participants: [],
            startTime: new Date(),
            endTime,
            status: "ACTIVE",
            requiredRoleId,
          });

          // Create a collector for the buttons
          const collector = giveawayMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: duration,
          });

          collector.on("collect", async (interaction) => {
            // Fetch the latest giveaway data
            const currentGiveaway = await Giveaway.findOne({
              messageId: giveawayMessage.id,
            });

            if (!currentGiveaway || currentGiveaway.status !== "ACTIVE") {
              return interaction.reply({
                content: "This giveaway has ended or been cancelled.",
                ephemeral: true,
              });
            }

            // Handle role requirement
            if (
              currentGiveaway.requiredRoleId &&
              !interaction.member.roles.cache.has(
                currentGiveaway.requiredRoleId,
              )
            ) {
              const requiredRole = interaction.guild.roles.cache.get(
                currentGiveaway.requiredRoleId,
              );
              return interaction.reply({
                content: `You need the ${requiredRole} role to enter this giveaway!`,
                ephemeral: true,
              });
            }

            switch (interaction.customId) {
              case "enter_giveaway": {
                const isParticipant = currentGiveaway.participants.includes(
                  interaction.user.id,
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
                const updatedGiveaway = await Giveaway.findById(
                  currentGiveaway._id,
                );
                const remaining = getTimeRemaining(updatedGiveaway.endTime);
                const updatedEmbed = await createGiveawayEmbed(
                  updatedGiveaway,
                  remaining,
                );

                await giveawayMessage.edit({
                  embeds: [updatedEmbed],
                });
                break;
              }

              case "view_participants": {
                const participants = currentGiveaway.participants.map(
                  (id) => `<@${id}>`,
                );

                const participantsList =
                  participants.length > 0
                    ? participants.join(", ")
                    : "No participants yet.";

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

          // Set up interval to update the giveaway message every minute
          const intervalId = setInterval(async () => {
            try {
              const currentGiveaway = await Giveaway.findOne({
                messageId: giveawayMessage.id,
              });

              if (!currentGiveaway || currentGiveaway.status !== "ACTIVE") {
                clearInterval(intervalId);
                return;
              }

              const remaining = getTimeRemaining(currentGiveaway.endTime);

              // Only update every minute to avoid rate limits
              if (remaining <= 0) {
                clearInterval(intervalId);
                // End the giveaway
                await endGiveaway(currentGiveaway);
                return;
              }

              const updatedEmbed = await createGiveawayEmbed(
                currentGiveaway,
                remaining,
              );

              await giveawayMessage.edit({
                embeds: [updatedEmbed],
              });
            } catch (error) {
              console.error("Error updating giveaway:", error);
              clearInterval(intervalId);
            }
          }, 60000);

          // Send confirmation message
          return message.channel.send({
            embeds: [
              createEmbed(
                "✅ Giveaway Created",
                `Your giveaway for **${prize}** has been created and will end ${endTime.toLocaleString()}.`,
                "Green",
              ),
            ],
          });
        }

        case "end": {
          if (!args[1]) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Missing Arguments",
                  `Please provide the message ID of the giveaway to end.\nUsage: \`${prefix}giveaway end <messageID>\``,
                  "Red",
                ),
              ],
            });
          }

          const messageId = args[1];
          const giveaway = await Giveaway.findOne({
            messageId,
            guildId,
            status: "ACTIVE",
          });

          if (!giveaway) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Giveaway Not Found",
                  "Could not find an active giveaway with that message ID.",
                  "Red",
                ),
              ],
            });
          }

          await endGiveaway(giveaway);

          return message.channel.send({
            embeds: [
              createEmbed(
                "✅ Giveaway Ended",
                `The giveaway for **${giveaway.prize}** has been ended.`,
                "Green",
              ),
            ],
          });
        }

        case "reroll": {
          if (!args[1]) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Missing Arguments",
                  `Please provide the message ID of the giveaway to reroll.\nUsage: \`${prefix}giveaway reroll <messageID> [winners]\``,
                  "Red",
                ),
              ],
            });
          }

          const messageId = args[1];
          const winnerCount = args[2] ? parseInt(args[2]) : 1;

          if (isNaN(winnerCount) || winnerCount < 1 || winnerCount > 20) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Invalid Winner Count",
                  "Winner count must be between 1 and 20.",
                  "Red",
                ),
              ],
            });
          }

          const giveaway = await Giveaway.findOne({
            messageId,
            guildId,
            status: "ENDED",
          });

          if (!giveaway) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Giveaway Not Found",
                  "Could not find an ended giveaway with that message ID.",
                  "Red",
                ),
              ],
            });
          }

          if (giveaway.participants.length === 0) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ No Participants",
                  "There were no participants in this giveaway.",
                  "Red",
                ),
              ],
            });
          }

          const newWinners = selectWinners(
            giveaway.participants,
            winnerCount,
            giveaway.winners, // Exclude previous winners
          );

          if (newWinners.length === 0) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ No Eligible Winners",
                  "There are no more eligible participants to select as winners.",
                  "Red",
                ),
              ],
            });
          }

          // Update giveaway with new winners
          const updatedWinners = [...giveaway.winners, ...newWinners];
          await Giveaway.findByIdAndUpdate(giveaway._id, {
            $push: { winners: { $each: newWinners } },
          });

          // Announce new winners
          const winnerMentions = newWinners.map((id) => `<@${id}>`).join(", ");

          const channel = await client.channels.fetch(giveaway.channelId);
          await channel.send({
            content: `🎉 Congratulations ${winnerMentions}! You've won the reroll for **${giveaway.prize}**!`,
            embeds: [
              createEmbed(
                "🎊 Giveaway Rerolled",
                `**Prize:** ${giveaway.prize}\n**New Winners:** ${winnerMentions}`,
                "#FFD700",
              ),
            ],
          });

          return message.channel.send({
            embeds: [
              createEmbed(
                "✅ Giveaway Rerolled",
                `Rerolled ${newWinners.length} new winners for the giveaway **${giveaway.prize}**.`,
                "Green",
              ),
            ],
          });
        }

        case "list": {
          const activeGiveaways = await Giveaway.find({
            guildId,
            status: "ACTIVE",
          }).sort({ endTime: 1 });

          if (activeGiveaways.length === 0) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "📋 Active Giveaways",
                  "There are no active giveaways in this server.",
                  "#FF73FA",
                ),
              ],
            });
          }

          const giveawayList = activeGiveaways
            .map((g, i) => {
              const remaining = getTimeRemaining(g.endTime);
              return `**${i + 1}.** [${g.prize}](https://discord.com/channels/${guildId}/${
                g.channelId
              }/${g.messageId}) (${formatTime(remaining)})`;
            })
            .join("\n");

          return message.channel.send({
            embeds: [
              createEmbed(
                `📋 Active Giveaways (${activeGiveaways.length})`,
                giveawayList,
                "#FF73FA",
              ),
            ],
          });
        }

        case "cancel": {
          if (!args[1]) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Missing Arguments",
                  `Please provide the message ID of the giveaway to cancel.\nUsage: \`${prefix}giveaway cancel <messageID>\``,
                  "Red",
                ),
              ],
            });
          }

          const messageId = args[1];
          const giveaway = await Giveaway.findOne({
            messageId,
            guildId,
            status: "ACTIVE",
          });

          if (!giveaway) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Giveaway Not Found",
                  "Could not find an active giveaway with that message ID.",
                  "Red",
                ),
              ],
            });
          }

          // Update giveaway status
          await Giveaway.findByIdAndUpdate(giveaway._id, {
            status: "CANCELLED",
          });

          // Update the giveaway message
          try {
            const channel = await client.channels.fetch(giveaway.channelId);
            const giveawayMessage = await channel.messages.fetch(
              giveaway.messageId,
            );

            const cancelledEmbed = new EmbedBuilder()
              .setTitle(`🚫 CANCELLED: ${giveaway.prize}`)
              .setDescription(
                `This giveaway has been cancelled by ${message.author.tag}.`,
              )
              .setColor("#808080")
              .setTimestamp();

            await giveawayMessage.edit({
              embeds: [cancelledEmbed],
              components: [],
            });
          } catch (error) {
            console.error("Error updating cancelled giveaway message:", error);
          }

          return message.channel.send({
            embeds: [
              createEmbed(
                "✅ Giveaway Cancelled",
                `The giveaway for **${giveaway.prize}** has been cancelled.`,
                "Green",
              ),
            ],
          });
        }

        default: {
          return message.channel.send({
            embeds: [
              createEmbed(
                "❓ Unknown Subcommand",
                `Unknown subcommand: \`${subcommand}\`.\nUse \`${prefix}giveaway\` to see available subcommands.`,
                "Red",
              ),
            ],
          });
        }
      }
    } catch (error) {
      console.error("Error in giveaway command:", error);
      return message.channel.send({
        embeds: [
          createEmbed(
            "⚠️ Error",
            "An error occurred while processing your request.",
            "Red",
          ),
        ],
      });
    }

    // Helper function to end a giveaway
    async function endGiveaway(giveaway) {
      // Update giveaway status
      await Giveaway.findByIdAndUpdate(giveaway._id, {
        status: "ENDED",
      });

      // Select winners
      const winners = selectWinners(
        giveaway.participants,
        giveaway.winnerCount,
      );

      // Update giveaway with winners
      if (winners.length > 0) {
        await Giveaway.findByIdAndUpdate(giveaway._id, {
          winners,
        });
      }

      try {
        // Update the giveaway message
        const channel = await client.channels.fetch(giveaway.channelId);
        const giveawayMessage = await channel.messages.fetch(
          giveaway.messageId,
        );

        // Create ended giveaway embed
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
              `**Entries:** ${giveaway.participants.length}`,
          );

          // Send winner announcement
          await channel.send({
            content: `🎉 Congratulations ${winnerMentions}! You've won **${giveaway.prize}**!`,
            embeds: [
              createEmbed(
                "🎊 Giveaway Ended",
                `**Prize:** ${giveaway.prize}\n**Winners:** ${winnerMentions}`,
                "#FFD700",
              ),
            ],
          });
        } else {
          endedEmbed.setDescription(
            `${giveaway.description ? `${giveaway.description}\n\n` : ""}` +
              "**Winners:** None (not enough participants)\n" +
              `**Host:** <@${giveaway.creatorId}>\n` +
              `**Entries:** ${giveaway.participants.length}`,
          );

          await channel.send({
            embeds: [
              createEmbed(
                "🎊 Giveaway Ended",
                `No winners were selected for **${giveaway.prize}** because there weren't enough participants.`,
                "#FFD700",
              ),
            ],
          });
        }

        await giveawayMessage.edit({
          embeds: [endedEmbed],
          components: [],
        });
      } catch (error) {
        console.error("Error updating ended giveaway message:", error);
      }
    }

    // Helper function to select random winners
    function selectWinners(participants, count, exclude = []) {
      const eligibleParticipants = participants.filter(
        (p) => !exclude.includes(p),
      );

      if (eligibleParticipants.length === 0) return [];

      const winners = [];
      const participantsCopy = [...eligibleParticipants];

      // Select random winners
      const winnerCount = Math.min(count, participantsCopy.length);

      for (let i = 0; i < winnerCount; i++) {
        const randomIndex = Math.floor(Math.random() * participantsCopy.length);
        winners.push(participantsCopy[randomIndex]);
        participantsCopy.splice(randomIndex, 1);
      }

      return winners;
    }
  },
};
