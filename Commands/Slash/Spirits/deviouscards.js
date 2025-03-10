import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} from "discord.js";
import { basename } from "path";
import profileSchema from "../../../schema/profile.js";
import {
  NATURAL_BLACKJACK_MULTIPLIER,
  generateDeck,
  shuffleDeck,
  calculateHandTotal,
  isNaturalBlackjack,
  smartDealerMove,
  botCheatAdjustment,
  canSendAnimation,
  cardImages,
} from "../../../utils/cardGameUtils.js";
import {
  DEALER_MOODS,
  DIFFICULTY_SETTINGS,
  getDealerResponse,
  getDealerMood,
  getThinkingDelay,
  getDealerCheatProbability,
} from "../../../utils/dealerPersonality.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Safety wrapper for balance updates
const safeUpdateBalance = async (userId, newBalance) => {
  const safeBalance = Math.max(0, Math.floor(newBalance));
  await profileSchema.findOneAndUpdate(
    { userid: userId },
    { balance: safeBalance }
  );
  return safeBalance;
};

export default {
  data: new SlashCommandBuilder()
    .setName("deviouscards")
    .setDescription(
      "Play blackjack against a cunning dealer who might bend the rules"
    )
    .addIntegerOption((option) =>
      option
        .setName("bet")
        .setDescription("Amount of Spirit Coins to bet")
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((option) =>
      option
        .setName("difficulty")
        .setDescription("Choose the dealer's personality and behavior")
        .addChoices(
          { name: "Easy - Friendly dealer with better odds", value: "easy" },
          {
            name: "Normal - Classic devious dealer experience",
            value: "normal",
          },
          {
            name: "Hard - Ruthless dealer who frequently cheats",
            value: "hard",
          }
        )
    ),
  category: "Spirits",
  gambling: true,
  autoEndGamblingSession: false,

  run: async ({ client, interaction }) => {
    // Start gambling session
    if (!client.startGamblingSession(interaction.user.id, interaction)) {
      return interaction.reply({
        content:
          "You are already in a gambling session. Please finish it first.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    try {
      // Get difficulty setting
      const difficulty =
        interaction.options.getString("difficulty") || "normal";

      // Show tutorial option first
      const tutorialEmbed = new EmbedBuilder()
        .setColor("#663399")
        .setTitle("🎭 Welcome to Devious Dealer")
        .setDescription(
          `${DIFFICULTY_SETTINGS[difficulty].description}\n\n` +
            "Before we begin, would you like to view the tutorial or start playing right away?\n\n" +
            "The tutorial will teach you:\n" +
            "• Basic rules and card values\n" +
            "• Available moves and strategies\n" +
            "• Special plays like Insurance\n" +
            "• Practice hands with guidance\n\n" +
            "You can also access the tutorial anytime with `/cardstutorial`"
        );

      const tutorialRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("view_tutorial")
          .setLabel("View Tutorial")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("start_game")
          .setLabel("Start Playing")
          .setStyle(ButtonStyle.Success)
      );

      const tutorialMsg = await interaction.editReply({
        embeds: [tutorialEmbed],
        components: [tutorialRow],
      });

      const tutorialResponse = await tutorialMsg.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 30000,
      });

      if (tutorialResponse.customId === "view_tutorial") {
        // End gambling session if they choose tutorial
        client.endGamblingSession(interaction.user.id);
        await tutorialResponse.update({
          content:
            "Opening tutorial... You can start a game after with `/deviouscards`",
          embeds: [],
          components: [],
        });
        const tutorialCommand = client.slashCommands.get("cardstutorial");
        if (tutorialCommand) {
          await tutorialCommand.run({ client, interaction });
        }
        return;
      }

      await tutorialResponse.deferUpdate();

      // Start the game
      const bet = interaction.options.getInteger("bet");
      const userProfile = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      // Validate profile and balance
      if (!userProfile) {
        client.endGamblingSession(interaction.user.id);
        return interaction.editReply({
          content:
            "You don't have a profile yet. Please use the `/start` command first.",
        });
      }

      // Track potential maximum loss for validation
      const maxPotentialLoss = bet * 2; // Double down scenario
      if (userProfile.balance < maxPotentialLoss) {
        client.endGamblingSession(interaction.user.id);
        return interaction.editReply({
          content:
            `You need at least ${maxPotentialLoss} Spirit Coins to play (in case of double down).\n` +
            `Your balance is ${userProfile.balance} Spirit Coins.`,
        });
      }

      // Game state with difficulty settings
      let gameState = {
        playerWinStreak: 0,
        dealerWinStreak: 0,
        currentBet: bet,
        playerTotalWinnings: 0,
        isHighStakes: bet > 1000,
        difficulty: difficulty,
      };

      // Initialize game with smart dealer mood
      let dealerMood = getDealerMood(gameState, difficulty);
      let currentBalance = userProfile.balance;
      let deck = shuffleDeck(generateDeck());
      let playerHand = [deck.pop(), deck.pop()];
      let dealerHand = [deck.pop(), deck.pop()];
      let gameOver = false;
      let playerDoubled = false;
      let insuranceBet = 0;

      // Render game state function with dealer personality
      const renderGameState = () => {
        const playerTotal = calculateHandTotal(playerHand);
        const dealerVisible = dealerHand[0];
        const dealerImagePath = cardImages[dealerVisible.code];
        const dealerFileName = basename(dealerImagePath);

        return {
          embed: new EmbedBuilder()
            .setColor("#663399")
            .setTitle("🎭 Devious Dealer")
            .setDescription(
              `**Your Hand:** ${playerHand
                .map((card) => `\`${card.code}\``)
                .join(" ")}\n` +
                `Total: **${playerTotal}**\n` +
                `**Dealer's Visible Card:** \`${dealerVisible.code}\`` +
                (isNaturalBlackjack(playerHand)
                  ? "\n\n**NATURAL BLACKJACK!**"
                  : "")
            )
            .setFooter({
              text: `Bet: ${bet} Spirit Coins | Balance: ${currentBalance} Spirit Coins`,
            })
            .setImage(`attachment://${dealerFileName}`),
          dealerFileName,
          dealerImagePath,
        };
      };

      // Build action rows for game controls
      const buildActionRow = (disable = false) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("hit")
            .setLabel("Hit")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disable || isNaturalBlackjack(playerHand)),
          new ButtonBuilder()
            .setCustomId("stand")
            .setLabel("Stand")
            .setStyle(ButtonStyle.Success)
            .setDisabled(disable),
          new ButtonBuilder()
            .setCustomId("double")
            .setLabel("Double Down")
            .setStyle(ButtonStyle.Danger)
            .setDisabled(
              disable || playerHand.length > 2 || currentBalance < bet
            ),
          new ButtonBuilder()
            .setCustomId("surrender")
            .setLabel("Surrender")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disable || playerHand.length > 2)
        );
      };

      // Initial game response with dealer personality
      await sleep(getThinkingDelay("DEAL_INITIAL", difficulty));
      const dealerResponse = getDealerResponse(
        "GAME_START",
        dealerMood,
        difficulty
      );

      const introEmbed = new EmbedBuilder()
        .setColor("#663399")
        .setTitle("🎭 Devious Dealer")
        .setDescription(
          dealerResponse +
            "\n\n" +
            `You've wagered **${bet} Spirit Coins**. May fortune favor the bold...`
        );

      await interaction.editReply({ embeds: [introEmbed] });
      await sleep(1500);

      // Initial game state
      const { embed, dealerFileName, dealerImagePath } = renderGameState();
      const dealerCard = new AttachmentBuilder(dealerImagePath, {
        name: dealerFileName,
      });

      const gameMessage = await interaction.channel.send({
        embeds: [embed],
        files: [dealerCard],
        components: [buildActionRow()],
      });

      // Handle Natural Blackjack
      if (isNaturalBlackjack(playerHand)) {
        const winMultiplier = DIFFICULTY_SETTINGS[difficulty].payoutMultiplier;
        const winAmount = Math.ceil(
          bet * NATURAL_BLACKJACK_MULTIPLIER * winMultiplier
        );
        currentBalance = await safeUpdateBalance(
          interaction.user.id,
          currentBalance + winAmount
        );
        gameState.playerWinStreak++;
        gameState.playerTotalWinnings += winAmount;

        const blackjackResponse = getDealerResponse(
          "NATURAL_BLACKJACK",
          DEALER_MOODS.IMPRESSED,
          difficulty
        );

        const resultEmbed = new EmbedBuilder()
          .setColor("#ffd700")
          .setTitle("✨ Natural Blackjack!")
          .setDescription(
            blackjackResponse +
              "\n\n" +
              `**Your Hand:** ${playerHand
                .map((card) => `\`${card.code}\``)
                .join(" ")}\n` +
              `**Winnings:** ${winAmount} Spirit Coins\n` +
              `**New Balance:** ${currentBalance} Spirit Coins`
          );

        await gameMessage.edit({
          embeds: [resultEmbed],
          components: [buildActionRow(true)],
        });

        client.endGamblingSession(interaction.user.id);
        return;
      }

      // Handle insurance if dealer shows Ace
      if (dealerHand[0].rank === "A") {
        const maxInsurance = Math.floor(bet / 2);
        const insuranceButton = new ButtonBuilder()
          .setCustomId("insurance")
          .setLabel("Take Insurance")
          .setStyle(ButtonStyle.Primary);

        const insuranceRow = new ActionRowBuilder().addComponents(
          insuranceButton
        );

        // Show insurance option
        const insuranceEmbed = new EmbedBuilder()
          .setColor("#DAA520")
          .setTitle("Insurance Offered")
          .setDescription(
            "The dealer's smile widens as they reveal an Ace.\n\n" +
              "Would you like to take insurance? It costs up to half your original bet.\n" +
              `Maximum insurance bet: ${maxInsurance} Spirit Coins\n\n` +
              "If the dealer has Blackjack, insurance pays 2:1."
          );

        await gameMessage.edit({
          embeds: [insuranceEmbed],
          components: [insuranceRow],
        });

        try {
          const insuranceResponse = await gameMessage.awaitMessageComponent({
            filter: (i) => i.user.id === interaction.user.id,
            time: 30000,
          });

          if (insuranceResponse.customId === "insurance") {
            await insuranceResponse.deferUpdate();

            const modal = new ModalBuilder()
              .setCustomId("insurance_modal")
              .setTitle("Insurance Bet")
              .addComponents(
                new ActionRowBuilder().addComponents(
                  new TextInputBuilder()
                    .setCustomId("insurance_amount")
                    .setLabel(`Insurance (max ${maxInsurance})`)
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(`Enter amount (0-${maxInsurance})`)
                    .setRequired(true)
                )
              );

            await insuranceResponse.showModal(modal);

            const modalResponse = await insuranceResponse
              .awaitModalSubmit({
                time: 30000,
                filter: (i) => i.user.id === interaction.user.id,
              })
              .catch(() => null);

            if (modalResponse) {
              let amount = parseInt(
                modalResponse.fields.getTextInputValue("insurance_amount")
              );
              amount = Math.min(maxInsurance, Math.max(0, amount));

              if (amount > 0 && amount <= currentBalance) {
                insuranceBet = amount;
                currentBalance = await safeUpdateBalance(
                  interaction.user.id,
                  currentBalance - amount
                );

                await modalResponse.reply({
                  content: `Insurance bet placed: ${amount} Spirit Coins`,
                  flags: MessageFlags.Ephemeral,
                });
              }
            }
          }
        } catch (error) {
          console.error("Insurance error:", error);
        }

        // Update game display after insurance
        const updatedState = renderGameState();
        const updatedCard = new AttachmentBuilder(
          updatedState.dealerImagePath,
          { name: updatedState.dealerFileName }
        );

        await gameMessage.edit({
          embeds: [updatedState.embed],
          files: [updatedCard],
          components: [buildActionRow()],
        });
      }

      // Main game collector
      const collector = gameMessage.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60000,
        componentType: ComponentType.Button,
      });

      collector.on("collect", async (i) => {
        try {
          if (gameOver) return;

          await i.deferUpdate();

          switch (i.customId) {
            case "hit":
              if (!canSendAnimation(interaction.user.id)) {
                await i.followUp({
                  content:
                    "You're making moves too quickly! Please wait a moment.",
                  flags: MessageFlags.Ephemeral,
                });
                return;
              }

              await sleep(getThinkingDelay("HIT_DECISION", difficulty));
              playerHand.push(deck.pop());
              break;

            case "stand":
              gameOver = true;
              collector.stop("stand");
              return;

            case "double":
              if (playerHand.length === 2 && currentBalance >= bet) {
                playerDoubled = true;
                currentBalance = await safeUpdateBalance(
                  interaction.user.id,
                  currentBalance - bet
                );
                playerHand.push(deck.pop());
                gameOver = true;
                collector.stop("double");
              }
              return;

            case "surrender":
              gameOver = true;
              collector.stop("surrender");
              return;

            default:
              return;
          }

          const update = renderGameState();
          const newCard = new AttachmentBuilder(update.dealerImagePath, {
            name: update.dealerFileName,
          });

          await i.editReply({
            embeds: [update.embed],
            files: [newCard],
            components: [buildActionRow()],
          });

          if (calculateHandTotal(playerHand) > 21) {
            gameOver = true;
            collector.stop("bust");
          }
        } catch (error) {
          console.error("Game action error:", error);
          collector.stop("error");
        }
      });

      // Handle game end
      collector.on("end", async (collected, reason) => {
        try {
          if (reason === "time") {
            const timeoutEmbed = new EmbedBuilder()
              .setColor("#442222")
              .setTitle("The Dealer Grows Impatient...")
              .setDescription(
                getDealerResponse("TIME_OUT", dealerMood, difficulty)
              );

            await gameMessage.edit({
              embeds: [timeoutEmbed],
              components: [buildActionRow(true)],
            });

            client.endGamblingSession(interaction.user.id);
            return;
          }

          const playerTotal = calculateHandTotal(playerHand);

          if (reason === "surrender") {
            const loss = Math.floor(bet / 2);
            currentBalance = await safeUpdateBalance(
              interaction.user.id,
              currentBalance - loss
            );

            gameState.dealerWinStreak++;
            dealerMood = getDealerMood(gameState, difficulty);

            const surrenderEmbed = new EmbedBuilder()
              .setColor("#AA7722")
              .setTitle("Strategic Retreat")
              .setDescription(
                getDealerResponse("SURRENDER", dealerMood, difficulty) +
                  `\n\nYou surrender and lose **${loss} Spirit Coins**.\n` +
                  `**New Balance:** ${currentBalance} Spirit Coins`
              );

            await gameMessage.edit({
              embeds: [surrenderEmbed],
              components: [buildActionRow(true)],
            });
            client.endGamblingSession(interaction.user.id);
          } else if (reason === "bust") {
            currentBalance = await safeUpdateBalance(
              interaction.user.id,
              currentBalance - bet * (playerDoubled ? 2 : 1)
            );

            gameState.dealerWinStreak++;
            dealerMood = getDealerMood(gameState, difficulty);

            const bustEmbed = new EmbedBuilder()
              .setColor("#CC0000")
              .setTitle("Bust!")
              .setDescription(
                getDealerResponse("PLAYER_BUST", dealerMood, difficulty) +
                  `\n\nYour hand totals **${playerTotal}** - you've busted!\n` +
                  `You lose **${
                    bet * (playerDoubled ? 2 : 1)
                  } Spirit Coins**.\n` +
                  `**New Balance:** ${currentBalance} Spirit Coins`
              );

            await gameMessage.edit({
              embeds: [bustEmbed],
              components: [buildActionRow(true)],
            });

            client.endGamblingSession(interaction.user.id);
          } else if (reason === "stand" || reason === "double") {
            await sleep(getThinkingDelay("FINAL_REVEAL", difficulty));

            // Apply difficulty-based cheating
            const cheatProb = getDealerCheatProbability(gameState, difficulty);
            dealerHand = smartDealerMove(dealerHand, deck);
            let dealerTotal = botCheatAdjustment(dealerHand);

            // Dealer might cheat based on difficulty
            if (Math.random() < cheatProb && dealerTotal < playerTotal) {
              dealerTotal = Math.min(21, playerTotal + 1);
            }

            let winAmount = 0;
            let outcomeEmbed;

            // Handle insurance first if applicable
            if (
              dealerHand.length === 2 &&
              dealerTotal === 21 &&
              insuranceBet > 0
            ) {
              winAmount = insuranceBet * 2;
              currentBalance = await safeUpdateBalance(
                interaction.user.id,
                currentBalance + winAmount
              );
            }

            if (dealerTotal > 21) {
              winAmount += playerDoubled ? bet * 2 : bet;
              winAmount = Math.floor(
                winAmount * DIFFICULTY_SETTINGS[difficulty].payoutMultiplier
              );
              currentBalance = await safeUpdateBalance(
                interaction.user.id,
                currentBalance + winAmount
              );

              gameState.playerWinStreak++;
              dealerMood = getDealerMood(gameState, difficulty);

              outcomeEmbed = new EmbedBuilder()
                .setColor("#00CC00")
                .setTitle("The Dealer Busts!")
                .setDescription(
                  getDealerResponse("DEALER_BUST", dealerMood, difficulty) +
                    `\n\nThe dealer's total of **${dealerTotal}** is a bust!\n` +
                    `You win **${winAmount} Spirit Coins**!`
                );
            } else if (playerTotal > dealerTotal) {
              winAmount += playerDoubled ? bet * 2 : bet;
              winAmount = Math.floor(
                winAmount * DIFFICULTY_SETTINGS[difficulty].payoutMultiplier
              );
              currentBalance = await safeUpdateBalance(
                interaction.user.id,
                currentBalance + winAmount
              );

              gameState.playerWinStreak++;
              dealerMood = getDealerMood(gameState, difficulty);

              outcomeEmbed = new EmbedBuilder()
                .setColor("#00CC00")
                .setTitle("Victory!")
                .setDescription(
                  getDealerResponse("PLAYER_WIN", dealerMood, difficulty) +
                    `\n\nYour **${playerTotal}** beats the dealer's **${dealerTotal}**.\n` +
                    `You win **${winAmount} Spirit Coins**!`
                );
            } else if (playerTotal < dealerTotal) {
              const lossAmount = playerDoubled ? bet * 2 : bet;
              currentBalance = await safeUpdateBalance(
                interaction.user.id,
                currentBalance - lossAmount
              );

              gameState.dealerWinStreak++;
              dealerMood = getDealerMood(gameState, difficulty);

              outcomeEmbed = new EmbedBuilder()
                .setColor("#CC0000")
                .setTitle("Defeat")
                .setDescription(
                  getDealerResponse("PLAYER_LOSE", dealerMood, difficulty) +
                    `\n\nYour **${playerTotal}** loses to the dealer's **${dealerTotal}**.\n` +
                    `You lose **${lossAmount} Spirit Coins**.`
                );
            } else {
              dealerMood = DEALER_MOODS.NEUTRAL;

              outcomeEmbed = new EmbedBuilder()
                .setColor("#CCCC00")
                .setTitle("Push")
                .setDescription(
                  getDealerResponse("PUSH", dealerMood, difficulty) +
                    `\n\nBoth you and the dealer have **${playerTotal}**.\n` +
                    "Your bet is returned."
                );

              if (insuranceBet > 0) {
                outcomeEmbed.addFields([
                  {
                    name: "Insurance Result",
                    value: `Insurance payout: ${insuranceBet * 2} Spirit Coins`,
                    inline: true,
                  },
                ]);
              }
            }

            outcomeEmbed.addFields([
              {
                name: "Your Hand",
                value: playerHand.map((card) => `\`${card.code}\``).join(" "),
                inline: true,
              },
              {
                name: "Dealer's Hand",
                value: dealerHand.map((card) => `\`${card.code}\``).join(" "),
                inline: true,
              },
              {
                name: "Final Balance",
                value: `${currentBalance} Spirit Coins`,
                inline: false,
              },
            ]);

            await gameMessage.edit({
              embeds: [outcomeEmbed],
              components: [buildActionRow(true)],
            });

            client.endGamblingSession(interaction.user.id);
          }
        } catch (error) {
          console.error("Game end error:", error);
          client.endGamblingSession(interaction.user.id);

          const errorEmbed = new EmbedBuilder()
            .setColor("#880000")
            .setTitle("Game Interrupted")
            .setDescription(
              "The dealer frowns as a commotion breaks out in the casino.\n\n" +
                '"We\'ll have to continue this another time. Your bet is safe with me... for now."'
            );

          await gameMessage.edit({
            embeds: [errorEmbed],
            components: [buildActionRow(true)],
          });
        }
      });
    } catch (error) {
      console.error("Devious cards error:", error);
      client.endGamblingSession(interaction.user.id);
      await interaction.editReply({
        content: "An error occurred. Your bet has been safely returned.",
        components: [],
      });
    }
  },
};
