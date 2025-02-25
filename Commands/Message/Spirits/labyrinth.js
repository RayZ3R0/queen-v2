import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "labyrinth",
  aliases: ["laby", "luckylabyrinth"],
  description:
    "Lucky Labyrinth is an immersive, narrative-driven gambling game where you venture into a mysterious maze. " +
    "Bet your Spirit Coins and progress through multiple rounds by choosing among paths with different multipliers and risks. " +
    "At any point, you can exit to cash out your accumulated winnings (bet × multiplier), but the deeper you venture, the higher the rewards—and the risk! " +
    "Beware, for one false move could trigger a trap, causing you to lose your wager. Additionally, mysterious artifacts may appear, offering bonus multipliers for the daring.",
  usage: "<bet>",
  cooldown: 30,
  category: "Spirits",
  userPermissions: [],
  botPermissions: [],
  gambling: true,
  run: async ({ client, message, args, prefix }) => {
    try {
      // Parse bet.
      const bet = parseInt(args[0]);
      if (isNaN(bet) || bet <= 0) {
        return message.reply({
          content: "Please provide a valid bet amount greater than 0.",
        });
      }

      // Fetch user's profile.
      const userProfile = await profileSchema.findOne({
        userid: message.author.id,
      });
      if (!userProfile) {
        return message.reply({
          content:
            "You do not have a profile yet. Please use the `start` command first.",
        });
      }
      if (userProfile.balance < bet) {
        return message.reply({
          content: `You do not have enough Spirit Coins. Your balance is \`${userProfile.balance}\`.`,
        });
      }

      // Initialize game state.
      let currentMultiplier = 1.0;
      let currentRound = 1;
      const maxRounds = 5; // More rounds for depth.
      let gameActive = true;

      // Standard path info (multipliers and risk percentages)
      const pathData = {
        safe: { multiplier: 1.1, risk: 0.15 },
        risky: { multiplier: 1.3, risk: 0.4 },
        mysterious: { multiplier: 2.5, risk: 0.6 },
      };

      // Arrays containing exciting names for each path.
      const safeNames = [
        "Golden Passage",
        "Radiant Corridor",
        "Luminous Walk",
        "Aurora Lane",
        "Daybreak Boulevard",
        "Sunrise Trail",
        "Solstice Road",
        "Bright Promenade",
        "Dawn Passage",
        "Glittering Aisle",
      ];
      const riskyNames = [
        "Twilight Path",
        "Dusky Arc",
        "Nocturne Alley",
        "Shadowed Way",
        "Gloom Route",
        "Nightfall Shortcut",
        "Darkened Passage",
        "Ebon Track",
        "Obsidian Trail",
        "Veiled Road",
      ];
      const mysteriousNames = [
        "Arcane Alcove",
        "Enchanted Nook",
        "Phantom Chamber",
        "Cryptic Hall",
        "Mystic Sanctuary",
        "Otherworldly Niche",
        "Spectral Vault",
        "Ethereal Hideaway",
        "Esoteric Grotto",
        "Secret Oasis",
      ];

      // Helper to create an immersive game embed.
      const createGameEmbed = (round, multiplier, description) => {
        return new EmbedBuilder()
          .setColor("#8A2BE2")
          .setTitle("✦ Lucky Labyrinth ✦")
          .setDescription(
            `**Round ${round} of ${maxRounds}**\n` +
              `Current multiplier: **${multiplier.toFixed(2)}x**\n\n` +
              description
          )
          .setFooter({
            text: `Bet: ${bet} Spirit Coins | Balance: ${userProfile.balance} Spirit Coins`,
          });
      };

      // Atmospheric delay helper.
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      // Bonus Artifact Event.
      const artifactEvent = async () => {
        const artifactEmbed = new EmbedBuilder()
          .setColor("#DAA520")
          .setTitle("A Mysterious Artifact Appears!")
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

        const artifactMessage = await message.channel.send({
          embeds: [artifactEmbed],
          components: [row],
        });

        const filter = (i) => i.user.id === message.author.id;
        const collector = artifactMessage.createMessageComponentCollector({
          filter,
          max: 1,
          time: 30000,
        });

        return new Promise((resolve) => {
          collector.on("collect", async (interaction) => {
            try {
              await interaction.deferUpdate().catch(() => {});
            } catch (err) {}
            let bonusMultiplier = 1.0;
            if (interaction.customId === "artifact_claim") {
              // 50% chance artifact is blessed.
              if (Math.random() < 0.5) {
                bonusMultiplier = 1.5;
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
                bonusMultiplier = 0.8;
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
            if (reason === "time" || collected.size === 0) {
              artifactMessage.edit({
                embeds: [
                  new EmbedBuilder()
                    .setColor("#AAAAAA")
                    .setTitle("Artifact Fades")
                    .setDescription(
                      "The relic’s glow fades away into oblivion."
                    ),
                ],
                components: [],
              });
              resolve(1.0);
            }
          });
        });
      };

      // Helper: Present current round options.
      const presentRound = async (round) => {
        // Randomize button labels.
        const safeLabel =
          safeNames[Math.floor(Math.random() * safeNames.length)];
        const riskyLabel =
          riskyNames[Math.floor(Math.random() * riskyNames.length)];
        const mysteriousLabel =
          mysteriousNames[Math.floor(Math.random() * mysteriousNames.length)];

        let description =
          "The labyrinth unfurls before you. Choose your path:\n\n" +
          `• **${safeLabel}**:  ×${pathData.safe.multiplier} (15% trap chance)\n` +
          `• **${riskyLabel}**:  ×${pathData.risky.multiplier} (40% trap chance)\n` +
          `• **${mysteriousLabel}**:  ×${pathData.mysterious.multiplier} (60% trap chance)\n\n` +
          "Or decide to escape the maze and claim your current winnings.";
        const embed = createGameEmbed(round, currentMultiplier, description);

        // Set up interactive buttons with randomized labels.
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

        const sentMessage = await message.channel.send({
          embeds: [embed],
          components: [row],
        });
        const filter = (i) => i.user.id === message.author.id;
        const collector = sentMessage.createMessageComponentCollector({
          filter,
          time: 60000,
        });

        collector.on("collect", async (interaction) => {
          try {
            await interaction.deferUpdate().catch(() => {}); // Prevent unknown interaction error.
          } catch (err) {}
          if (!gameActive) return;

          // Exit path.
          if (interaction.customId === "exit_lab") {
            gameActive = false;
            collector.stop("exit");
            await cashOut();
            return;
          }

          let selectedType = interaction.customId; // "path_safe", "path_risky", or "path_mysterious"
          let selectedPath;
          if (selectedType === "path_safe") {
            selectedPath = pathData.safe;
          } else if (selectedType === "path_risky") {
            selectedPath = pathData.risky;
          } else if (selectedType === "path_mysterious") {
            selectedPath = pathData.mysterious;
          }

          // Atmospheric pause.
          await sentMessage.edit({
            embeds: [
              createGameEmbed(
                round,
                currentMultiplier,
                "You step forward into the unknown..."
              ),
            ],
          });
          await delay(1000);

          // Trap check.
          const trapRoll = Math.random();
          if (trapRoll < selectedPath.risk) {
            gameActive = false;
            collector.stop("trap");
            await sendTrapOutcome(
              selectedPath,
              safeLabel,
              riskyLabel,
              mysteriousLabel
            );
            return;
          }

          // Artifact event if taking the mysterious path.
          let bonus = 1.0;
          if (selectedType === "path_mysterious") {
            bonus = await artifactEvent();
          }

          // Update multiplier.
          currentMultiplier *= selectedPath.multiplier * bonus;
          currentRound++;
          collector.stop("continue");
          if (currentRound > maxRounds) {
            gameActive = false;
            await cashOut();
          } else {
            await sentMessage.delete();
            await presentRound(currentRound);
          }
        });

        collector.on("end", async (collected, reason) => {
          if ((reason === "time" || collected.size === 0) && gameActive) {
            gameActive = false;
            await message.channel.send(
              `${message.author}, the labyrinth twists into nothingness as time runs out.`
            );
          }
        });
      };

      // Cash out function.
      const cashOut = async () => {
        const winnings = Math.ceil(bet * currentMultiplier);
        const newBalance = Math.ceil(userProfile.balance - bet + winnings);
        await profileSchema.findOneAndUpdate(
          { userid: message.author.id },
          { balance: newBalance }
        );
        const cashOutEmbed = new EmbedBuilder()
          .setColor("#00ff00")
          .setTitle("Labyrinth Exit")
          .setDescription(
            `You escape the maze with a multiplier of **${currentMultiplier.toFixed(
              2
            )}x**.\n` +
              `Winnings: **${winnings} Spirit Coins** (Bet: ${bet} Spirit Coins).\n` +
              `New Balance: **${newBalance} Spirit Coins**.`
          )
          .setFooter({ text: "Safe journeys, brave adventurer!" });
        await message.channel.send({ embeds: [cashOutEmbed] });
      };

      // Trap outcome.
      const sendTrapOutcome = async (
        selectedPath,
        safeLabel,
        riskyLabel,
        mysteriousLabel
      ) => {
        const trapEmbed = new EmbedBuilder()
          .setColor("#ff0000")
          .setTitle("A Trap is Triggered!")
          .setDescription(
            `You chose the path and triggered a hidden snare...\n` +
              `Your bet of **${bet} Spirit Coins** vanishes into the labyrinth's dark depths.`
          )
          .setFooter({ text: "Fortune favors the bold... sometimes not." });
        const newBalance = userProfile.balance - bet;
        await profileSchema.findOneAndUpdate(
          { userid: message.author.id },
          { balance: newBalance }
        );
        await message.channel.send({ embeds: [trapEmbed] });
      };

      // Introductory narrative.
      const introEmbed = new EmbedBuilder()
        .setColor("#8A2BE2")
        .setTitle("Welcome to the Lucky Labyrinth")
        .setDescription(
          `Hail, ${message.author}!\n` +
            `You have wagered **${bet} Spirit Coins** and step into a realm of mystery and peril.\n` +
            "Every choice leads you deeper into unknown corridors. Tread carefully, for the path ahead holds both fortune and danger."
        )
        .setFooter({ text: `Balance: ${userProfile.balance} Spirit Coins` });

      await message.channel.send({ embeds: [introEmbed] });
      await presentRound(currentRound);
    } catch (error) {
      console.error("Labyrinth error:", error);
      return message.channel.send({
        content:
          "An error occurred while venturing into the Lucky Labyrinth. Please try again later.",
      });
    }
  },
};
