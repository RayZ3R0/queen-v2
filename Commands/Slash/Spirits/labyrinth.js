import {
  ApplicationCommandType,
  ApplicationCommandOptionType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import profileSchema from "../../../schema/profile.js";
import {
  MAX_ROUNDS,
  PATH_DATA,
  PATH_NAMES,
  ARTIFACT_CONFIG,
  getRandomPathName,
  formatMultiplier,
  calculateWinnings,
  delay,
} from "../../../utils/labyrinthUtils.js";

/**
 * @type {import("../../../index").Scommand}
 */
export default {
  name: "labyrinth",
  description: "Enter the Lucky Labyrinth and test your fortune",
  category: "Spirits",
  type: ApplicationCommandType.ChatInput,
  options: [
    {
      name: "bet",
      description: "Amount of Spirit Coins to bet",
      type: ApplicationCommandOptionType.Integer,
      required: true,
      minValue: 1,
    },
  ],

  run: async ({ client, interaction }) => {
    if (!client.gamblingEnabled) {
      return interaction.reply({
        content: "Gambling is currently disabled.",
        ephemeral: true,
      });
    }

    if (client.gamblingUsers.has(interaction.user.id)) {
      return interaction.reply({
        content:
          "You are already in a gambling session. Please finish it first.",
        ephemeral: true,
      });
    }

    await interaction.deferReply();
    client.gamblingUsers.add(interaction.user.id);

    try {
      const bet = interaction.options.getInteger("bet");
      const userProfile = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      // Validate profile and balance
      if (!userProfile) {
        client.gamblingUsers.delete(interaction.user.id);
        return interaction.editReply({
          content:
            "You don't have a profile yet. Please use the `/start` command first.",
        });
      }

      if (userProfile.balance < bet) {
        client.gamblingUsers.delete(interaction.user.id);
        return interaction.editReply({
          content: `You don't have enough Spirit Coins. Your balance is \`${userProfile.balance}\`.`,
        });
      }

      // Game state
      let currentMultiplier = 1.0;
      let currentRound = 1;
      let gameActive = true;
      let currentBalance = userProfile.balance;

      // Create game embed helper
      const createGameEmbed = (round, multiplier, description) => {
        return new EmbedBuilder()
          .setColor("#8A2BE2")
          .setTitle("✦ Lucky Labyrinth ✦")
          .setDescription(
            `**Round ${round} of ${MAX_ROUNDS}**\n` +
              `Current multiplier: **${formatMultiplier(multiplier)}x**\n\n` +
              description
          )
          .setFooter({
            text: `Bet: ${bet} Spirit Coins | Balance: ${currentBalance} Spirit Coins`,
          });
      };

      // Handle artifact encounter
      const handleArtifactEvent = async () => {
        const artifactEmbed = new EmbedBuilder()
          .setColor("#DAA520")
          .setTitle("✨ A Mysterious Artifact Appears!")
          .setDescription(
            "In the depths of the Mystic Alcove, a glowing relic beckons you.\n" +
              "Will you claim it for an **extra 1.5× multiplier bonus** or risk its curse?\n"
          )
          .setFooter({ text: "Choose wisely:" });

        const claimButton = new ButtonBuilder()
          .setCustomId("artifact_claim")
          .setLabel("Claim Artifact")
          .setStyle(ButtonStyle.Success);

        const ignoreButton = new ButtonBuilder()
          .setCustomId("artifact_ignore")
          .setLabel("Let it be")
          .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(
          claimButton,
          ignoreButton
        );
        const artifactMessage = await interaction.channel.send({
          embeds: [artifactEmbed],
          components: [row],
        });

        return new Promise((resolve) => {
          const collector = artifactMessage.createMessageComponentCollector({
            filter: (i) => i.user.id === interaction.user.id,
            time: 30000,
            max: 1,
          });

          collector.on("collect", async (i) => {
            await i.deferUpdate();
            let bonusMultiplier = 1.0;

            if (i.customId === "artifact_claim") {
              if (Math.random() < ARTIFACT_CONFIG.blessingChance) {
                bonusMultiplier = ARTIFACT_CONFIG.blessingMultiplier;
                await artifactMessage.edit({
                  embeds: [
                    new EmbedBuilder()
                      .setColor("#32CD32")
                      .setTitle("Artifact Blessed!")
                      .setDescription(
                        "The relic radiates powerful energy—fortune smiles upon you!"
                      ),
                  ],
                  components: [],
                });
              } else {
                bonusMultiplier = ARTIFACT_CONFIG.curseMultiplier;
                await artifactMessage.edit({
                  embeds: [
                    new EmbedBuilder()
                      .setColor("#8B0000")
                      .setTitle("Artifact Cursed!")
                      .setDescription(
                        "A dark curse emanates from the relic—your fate takes a turn."
                      ),
                  ],
                  components: [],
                });
              }
            } else {
              await artifactMessage.edit({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#AAAAAA")
                    .setTitle("Artifact Ignored")
                    .setDescription(
                      "You decide against meddling with unknown forces."
                    ),
                ],
                components: [],
              });
            }
            resolve(bonusMultiplier);
          });

          collector.on("end", (collected, reason) => {
            if (reason === "time") {
              artifactMessage.edit({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#AAAAAA")
                    .setTitle("Artifact Fades")
                    .setDescription(
                      "The relic's glow fades away into oblivion."
                    ),
                ],
                components: [],
              });
              resolve(1.0);
            }
          });
        });
      };

      // Cash out function
      const handleCashOut = async () => {
        const winnings = calculateWinnings(bet, currentMultiplier);
        const newBalance = Math.ceil(currentBalance - bet + winnings);

        await profileSchema.findOneAndUpdate(
          { userid: interaction.user.id },
          { balance: newBalance }
        );

        const cashOutEmbed = new EmbedBuilder()
          .setColor("#00ff00")
          .setTitle("🌟 Labyrinth Exit")
          .setDescription(
            `You escape the maze with a multiplier of **${formatMultiplier(
              currentMultiplier
            )}x**.\n` +
              `Winnings: **${winnings} Spirit Coins** (Bet: ${bet} Spirit Coins).\n` +
              `New Balance: **${newBalance} Spirit Coins**.`
          )
          .setFooter({ text: "Safe journeys, brave adventurer!" });

        await interaction.channel.send({ embeds: [cashOutEmbed] });
        client.gamblingUsers.delete(interaction.user.id);
      };

      // Handle trap outcome
      const handleTrapOutcome = async () => {
        const newBalance = currentBalance - bet;
        await profileSchema.findOneAndUpdate(
          { userid: interaction.user.id },
          { balance: newBalance }
        );

        const trapEmbed = new EmbedBuilder()
          .setColor("#ff0000")
          .setTitle("💀 A Trap is Triggered!")
          .setDescription(
            "You chose the path and triggered a hidden snare...\n" +
              `Your bet of **${bet} Spirit Coins** vanishes into the labyrinth's dark depths.`
          )
          .setFooter({ text: "Fortune favors the bold... sometimes not." });

        await interaction.channel.send({ embeds: [trapEmbed] });
        client.gamblingUsers.delete(interaction.user.id);
      };

      // Present round options
      const presentRound = async (round) => {
        const safeLabel = getRandomPathName("safe");
        const riskyLabel = getRandomPathName("risky");
        const mysteriousLabel = getRandomPathName("mysterious");

        const description =
          "The labyrinth unfurls before you. Choose your path:\n\n" +
          `• **${safeLabel}**: ×${PATH_DATA.safe.multiplier} (15% trap chance)\n` +
          `• **${riskyLabel}**: ×${PATH_DATA.risky.multiplier} (40% trap chance)\n` +
          `• **${mysteriousLabel}**: ×${PATH_DATA.mysterious.multiplier} (60% trap chance)\n\n` +
          "Or decide to escape the maze and claim your current winnings.";

        const embed = createGameEmbed(round, currentMultiplier, description);

        const safeButton = new ButtonBuilder()
          .setCustomId("path_safe")
          .setLabel(safeLabel)
          .setStyle(ButtonStyle.Primary);

        const riskyButton = new ButtonBuilder()
          .setCustomId("path_risky")
          .setLabel(riskyLabel)
          .setStyle(ButtonStyle.Danger);

        const mysteriousButton = new ButtonBuilder()
          .setCustomId("path_mysterious")
          .setLabel(mysteriousLabel)
          .setStyle(ButtonStyle.Secondary);

        const exitButton = new ButtonBuilder()
          .setCustomId("exit_lab")
          .setLabel("Exit & Cash Out")
          .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(
          safeButton,
          riskyButton,
          mysteriousButton,
          exitButton
        );

        const message = await interaction.channel.send({
          embeds: [embed],
          components: [row],
        });

        const collector = message.createMessageComponentCollector({
          filter: (i) => i.user.id === interaction.user.id,
          time: 60000,
        });

        collector.on("collect", async (i) => {
          try {
            await i.deferUpdate();
            if (!gameActive) return;

            if (i.customId === "exit_lab") {
              gameActive = false;
              collector.stop("exit");
              await handleCashOut();
              return;
            }

            const pathType = i.customId.split("_")[1];
            const selectedPath = PATH_DATA[pathType];

            await message.edit({
              embeds: [
                createGameEmbed(
                  round,
                  currentMultiplier,
                  "You step forward into the unknown..."
                ),
              ],
            });

            await delay(1000);

            // Check for trap
            if (Math.random() < selectedPath.risk) {
              gameActive = false;
              collector.stop("trap");
              await handleTrapOutcome();
              return;
            }

            // Handle artifact event for mysterious path
            let bonus = 1.0;
            if (pathType === "mysterious") {
              bonus = await handleArtifactEvent();
            }

            currentMultiplier *= selectedPath.multiplier * bonus;
            currentRound++;

            collector.stop("continue");
            if (currentRound > MAX_ROUNDS) {
              gameActive = false;
              await handleCashOut();
            } else {
              await message.delete().catch(() => {});
              await presentRound(currentRound);
            }
          } catch (error) {
            console.error("Error in round interaction:", error);
            collector.stop("error");
          }
        });

        collector.on("end", (collected, reason) => {
          if (reason === "time" && gameActive) {
            gameActive = false;
            client.gamblingUsers.delete(interaction.user.id);

            interaction.channel.send({
              content: `${interaction.user}, the labyrinth twists into nothingness as time runs out.`,
            });
          }
        });
      };

      // Start the game with intro message
      const introEmbed = new EmbedBuilder()
        .setColor("#8A2BE2")
        .setTitle("🌟 Welcome to the Lucky Labyrinth")
        .setDescription(
          `Hail, ${interaction.user}!\n` +
            `You have wagered **${bet} Spirit Coins** and step into a realm of mystery and peril.\n` +
            "Every choice leads you deeper into unknown corridors. Tread carefully, for the path ahead holds both fortune and danger."
        )
        .setFooter({ text: `Balance: ${currentBalance} Spirit Coins` });

      await interaction.editReply({ embeds: [introEmbed] });
      await presentRound(currentRound);
    } catch (error) {
      console.error("Labyrinth error:", error);
      client.gamblingUsers.delete(interaction.user.id);
      await interaction.editReply({
        content:
          "An error occurred while venturing into the Lucky Labyrinth. Please try again later.",
      });
    }
  },
};
