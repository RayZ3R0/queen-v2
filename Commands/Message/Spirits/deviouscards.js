import {
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
  calculatePayout,
} from "../../../utils/cardGameUtils.js";
import {
  DEALER_MOODS,
  DIFFICULTY_SETTINGS,
  getDealerResponse,
  getDealerMood,
  getThinkingDelay,
  getDealerCheatProbability,
} from "../../../utils/dealerPersonality.js";
import BalanceManager from "../../../utils/balanceManager.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Handle insurance bet with safety checks
const handleInsuranceBet = async (
  modalResponse,
  maxInsurance,
  currentBalance,
  userId
) => {
  try {
    let amount = parseInt(
      modalResponse.fields.getTextInputValue("insurance_amount")
    );
    amount = Math.min(maxInsurance, Math.max(0, amount));

    // Validate player can afford insurance
    const canAfford = await BalanceManager.canAffordBet(userId, amount, false);
    if (!canAfford) {
      await modalResponse.reply({
        content: "Insufficient balance for insurance bet.",
        ephemeral: true,
      });
      return { insurancePlaced: false, updatedBalance: currentBalance };
    }

    if (amount > 0) {
      const newBalance = await BalanceManager.updateBalance(
        userId,
        -amount,
        currentBalance
      );

      await modalResponse.reply({
        content: `Insurance bet placed: ${amount} Spirit Coins`,
        ephemeral: true,
      });

      return {
        insurancePlaced: true,
        insuranceAmount: amount,
        updatedBalance: newBalance,
      };
    }

    await modalResponse.reply({
      content: "Invalid insurance amount.",
      ephemeral: true,
    });
    return { insurancePlaced: false, updatedBalance: currentBalance };
  } catch (error) {
    console.error("Insurance bet error:", error);
    await modalResponse.reply({
      content: "Error processing insurance bet.",
      ephemeral: true,
    });
    return { insurancePlaced: false, updatedBalance: currentBalance };
  }
};

export default {
  name: "cards",
  aliases: ["card", "gamble"],
  description:
    "Enter the realm of Devious Dealer—a card game where skill meets cunning deceit. " +
    "Wager your Spirit Coins against a dealer who plays smart, employs trickery, and bends the rules ever so slightly in his favor. " +
    "Will you risk it all, take insurance, or surrender your hand? The game is thrilling, interactive, and rigged so that the house nearly always wins.",
  usage: "<bet> [difficulty]",
  cooldown: 30,
  category: "Spirits",
  userPermissions: [],
  botPermissions: [],
  gambling: true,
  autoEndGamblingSession: false,

  run: async ({ client, message, args, prefix }) => {
    try {
      // Validate input
      if (args.length < 1 || args.length > 2) {
        message.reply({
          content: `Incorrect usage! Use: ${prefix}cards <bet> [difficulty]`,
        });
        return false;
      }

      // Parse bet amount
      const bet = parseInt(args[0]);
      if (isNaN(bet) || bet <= 0) {
        message.reply({
          content: "Please provide a valid bet amount greater than 0.",
        });
        return false;
      }

      // Get difficulty setting (optional)
      const difficulty = args[1]?.toLowerCase() || "normal";
      if (!["easy", "normal", "hard"].includes(difficulty)) {
        message.reply({
          content: "Difficulty must be easy, normal, or hard.",
        });
        return false;
      }

      // All input validation passed, start gambling session
      if (!client.startGamblingSession(message.author.id, message, true)) {
        message.reply({
          content:
            "You are already in a gambling session. Please finish it first.",
        });
        return false;
      }

      // Initial balance validation
      const canAfford = await BalanceManager.canAffordBet(
        message.author.id,
        bet
      );

      if (!canAfford) {
        client.endGamblingSession(message.author.id);
        const balance = await BalanceManager.getBalance(message.author.id);
        message.reply({
          content:
            `You need at least ${
              bet * 2.5
            } Spirit Coins to play (for double down and insurance).\n` +
            `Your balance is ${BalanceManager.format(balance)} Spirit Coins.`,
        });
        return false;
      }

      let currentBalance = await BalanceManager.getBalance(message.author.id);
      if (currentBalance === null) {
        client.endGamblingSession(message.author.id);
        message.reply({
          content:
            "You don't have a profile yet. Please use the `start` command first.",
        });
        return false;
      }

      // Show tutorial option after validations
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
            "You can also access the tutorial anytime with `cardstutorial`"
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

      try {
        const tutorialMsg = await message.channel.send({
          embeds: [tutorialEmbed],
          components: [tutorialRow],
        });

        const tutorialResponse = await tutorialMsg.awaitMessageComponent({
          filter: (i) => i.user.id === message.author.id,
          time: 30000,
        });

        if (tutorialResponse.customId === "view_tutorial") {
          // End gambling session if they choose tutorial
          client.endGamblingSession(message.author.id);
          await tutorialResponse.update({
            content: "Opening tutorial...",
            embeds: [],
            components: [],
          });
          const tutorialCommand = client.mcommands.get("cardstutorial");
          if (tutorialCommand) {
            return tutorialCommand.run({
              client,
              message,
              args: [],
            });
          }
          return;
        }

        await tutorialResponse.deferUpdate();
      } catch (error) {
        client.endGamblingSession(message.author.id);
        console.error("Tutorial error:", error);
        return message.reply({
          content: "The tutorial timed out. Please try again.",
        });
      }

      // Game state initialization
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
      let deck = shuffleDeck(generateDeck());
      let playerHand = [deck.pop(), deck.pop()];
      let dealerHand = [deck.pop(), deck.pop()];
      let gameOver = false;
      let playerDoubled = false;
      let insuranceBet = 0;

      // Game rendering function with dealer personality
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
              text: `Bet: ${bet} Spirit Coins | Balance: ${BalanceManager.format(
                currentBalance
              )} Spirit Coins`,
            })
            .setImage(`attachment://${dealerFileName}`),
          dealerFileName,
          dealerImagePath,
        };
      };

      // Button row builder
      const buildActionRow = async (disable = false) => {
        const canAffordDouble = await BalanceManager.canAffordBet(
          message.author.id,
          bet,
          false
        );

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
            .setDisabled(disable || playerHand.length > 2 || !canAffordDouble),
          new ButtonBuilder()
            .setCustomId("surrender")
            .setLabel("Surrender")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disable || playerHand.length > 2)
        );
      };

      // Game intro
      const introEmbed = new EmbedBuilder()
        .setColor("#663399")
        .setTitle("🎭 Welcome to Devious Dealer")
        .setDescription(
          `${DIFFICULTY_SETTINGS[difficulty].description}\n\n` +
            `You have wagered **${bet} Spirit Coins**. May fortune favor the bold...`
        );

      await message.channel.send({ embeds: [introEmbed] });
      await sleep(1500);

      // Initial game state
      const { embed, dealerFileName, dealerImagePath } = renderGameState();
      const dealerCard = new AttachmentBuilder(dealerImagePath, {
        name: dealerFileName,
      });

      const gameMessage = await message.channel.send({
        embeds: [embed],
        files: [dealerCard],
        components: [await buildActionRow()],
      });

      // Handle Natural Blackjack
      if (isNaturalBlackjack(playerHand)) {
        const winAmount = calculatePayout(
          bet,
          NATURAL_BLACKJACK_MULTIPLIER,
          difficulty
        );
        if (winAmount > 0) {
          currentBalance = await BalanceManager.updateBalance(
            message.author.id,
            winAmount,
            currentBalance
          );
        }

        gameState.playerWinStreak++;
        gameState.playerTotalWinnings += winAmount;

        const resultEmbed = new EmbedBuilder()
          .setColor("#ffd700")
          .setTitle("✨ Natural Blackjack!")
          .setDescription(
            getDealerResponse(
              "NATURAL_BLACKJACK",
              DEALER_MOODS.IMPRESSED,
              difficulty
            ) +
              "\n\n" +
              `**Your Hand:** ${playerHand
                .map((card) => `\`${card.code}\``)
                .join(" ")}\n` +
              `**Winnings:** ${winAmount} Spirit Coins\n` +
              `**New Balance:** ${BalanceManager.format(
                currentBalance
              )} Spirit Coins`
          );

        await gameMessage.edit({
          embeds: [resultEmbed],
          components: [await buildActionRow(true)],
        });

        client.endGamblingSession(message.author.id);
        return true;
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
            filter: (i) => i.user.id === message.author.id,
            time: 30000,
          });

          if (insuranceResponse.customId === "insurance") {
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

            try {
              const modalResponse = await insuranceResponse
                .awaitModalSubmit({
                  time: 30000,
                  filter: (i) => i.user.id === message.author.id,
                })
                .catch(() => null);

              if (modalResponse) {
                const { insurancePlaced, insuranceAmount, updatedBalance } =
                  await handleInsuranceBet(
                    modalResponse,
                    maxInsurance,
                    currentBalance,
                    message.author.id
                  );

                if (insurancePlaced) {
                  insuranceBet = insuranceAmount;
                  currentBalance = updatedBalance;
                }
              }
            } catch (modalError) {
              console.error("Modal error:", modalError);
            }
          }
        } catch (error) {
          console.error("Insurance interaction error:", error);
        }

        // Update display after insurance resolution
        const updatedState = renderGameState();
        const updatedCard = new AttachmentBuilder(
          updatedState.dealerImagePath,
          {
            name: updatedState.dealerFileName,
          }
        );

        await gameMessage.edit({
          embeds: [updatedState.embed],
          files: [updatedCard],
          components: [await buildActionRow()],
        });
      }

      // Main game collector
      const collector = gameMessage.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 60000,
        componentType: ComponentType.Button,
      });

      collector.on("collect", async (i) => {
        try {
          if (gameOver) return;

          await i.deferUpdate();

          switch (i.customId) {
            case "hit":
              if (!canSendAnimation(message.author.id)) {
                await i.followUp({
                  content:
                    "You're making moves too quickly! Please wait a moment.",
                  ephemeral: true,
                });
                return;
              }

              await sleep(getThinkingDelay("HIT_DECISION", difficulty));
              playerHand.push(deck.pop());
              const update = renderGameState();
              const newCard = new AttachmentBuilder(update.dealerImagePath, {
                name: update.dealerFileName,
              });

              await gameMessage.edit({
                embeds: [update.embed],
                files: [newCard],
                components: [await buildActionRow()],
              });

              if (calculateHandTotal(playerHand) > 21) {
                gameOver = true;
                collector.stop("bust");
              }
              break;

            case "stand":
              gameOver = true;
              collector.stop("stand");
              return;

            case "double":
              const canDoubleDown = await BalanceManager.canAffordBet(
                message.author.id,
                bet,
                false
              );
              if (playerHand.length === 2 && canDoubleDown) {
                playerDoubled = true;
                currentBalance = await BalanceManager.updateBalance(
                  message.author.id,
                  -bet,
                  currentBalance
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
              components: [await buildActionRow(true)],
            });

            client.endGamblingSession(message.author.id);
            return;
          }

          const playerTotal = calculateHandTotal(playerHand);

          if (reason === "surrender") {
            const loss = Math.floor(bet / 2);
            currentBalance = await BalanceManager.updateBalance(
              message.author.id,
              -loss,
              currentBalance
            );

            gameState.dealerWinStreak++;
            dealerMood = getDealerMood(gameState, difficulty);

            const surrenderEmbed = new EmbedBuilder()
              .setColor("#AA7722")
              .setTitle("Strategic Retreat")
              .setDescription(
                getDealerResponse("SURRENDER", dealerMood, difficulty) +
                  `\n\nYou surrender and lose **${loss} Spirit Coins**.\n` +
                  `**New Balance:** ${BalanceManager.format(
                    currentBalance
                  )} Spirit Coins`
              );

            await gameMessage.edit({
              embeds: [surrenderEmbed],
              components: [await buildActionRow(true)],
            });
            client.endGamblingSession(message.author.id);
          } else if (reason === "bust") {
            const lossAmount = bet * (playerDoubled ? 2 : 1);
            currentBalance = await BalanceManager.updateBalance(
              message.author.id,
              -lossAmount,
              currentBalance
            );

            gameState.dealerWinStreak++;
            dealerMood = getDealerMood(gameState, difficulty);

            const bustEmbed = new EmbedBuilder()
              .setColor("#CC0000")
              .setTitle("Bust!")
              .setDescription(
                getDealerResponse("PLAYER_BUST", dealerMood, difficulty) +
                  `\n\nYour hand totals **${playerTotal}** - you've busted!\n` +
                  `You lose **${lossAmount} Spirit Coins**.\n` +
                  `**New Balance:** ${BalanceManager.format(
                    currentBalance
                  )} Spirit Coins`
              );

            await gameMessage.edit({
              embeds: [bustEmbed],
              components: [await buildActionRow(true)],
            });

            client.endGamblingSession(message.author.id);
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
              currentBalance = await BalanceManager.updateBalance(
                message.author.id,
                winAmount,
                currentBalance
              );
            }

            if (dealerTotal > 21) {
              // Calculate win amount with validation
              const baseWin = playerDoubled ? bet * 4 : bet;
              winAmount = calculatePayout(baseWin, 1, difficulty);
              if (winAmount > 0) {
                currentBalance = await BalanceManager.updateBalance(
                  message.author.id,
                  winAmount,
                  currentBalance
                );
              }

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
              // Calculate win amount with validation
              const baseWin = playerDoubled ? bet * 4 : bet;
              winAmount = calculatePayout(baseWin, 1, difficulty);
              if (winAmount > 0) {
                currentBalance = await BalanceManager.updateBalance(
                  message.author.id,
                  winAmount,
                  currentBalance
                );
              }

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
              currentBalance = await BalanceManager.updateBalance(
                message.author.id,
                -lossAmount,
                currentBalance
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

              // Return double bet if player doubled down
              if (playerDoubled) {
                const returnAmount = Math.floor(bet * 2); // Return both bets on push
                if (!isNaN(returnAmount) && returnAmount > 0) {
                  currentBalance = await BalanceManager.updateBalance(
                    message.author.id,
                    returnAmount,
                    currentBalance
                  );
                }
              }

              outcomeEmbed = new EmbedBuilder()
                .setColor("#CCCC00")
                .setTitle("Push")
                .setDescription(
                  getDealerResponse("PUSH", dealerMood, difficulty) +
                    `\n\nBoth you and the dealer have **${playerTotal}**.\n` +
                    (playerDoubled
                      ? "Your doubled bet is returned."
                      : "Your bet is returned.")
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
                value: `${BalanceManager.format(currentBalance)} Spirit Coins`,
                inline: false,
              },
            ]);

            await gameMessage.edit({
              embeds: [outcomeEmbed],
              components: [await buildActionRow(true)],
            });

            client.endGamblingSession(message.author.id);
          }
        } catch (error) {
          console.error("Game end error:", error);
          client.endGamblingSession(message.author.id);

          const errorEmbed = new EmbedBuilder()
            .setColor("#880000")
            .setTitle("Game Interrupted")
            .setDescription(
              "The dealer frowns as a commotion breaks out in the casino.\n\n" +
                '"We\'ll have to continue this another time. Your bet is safe with me... for now."'
            );

          await gameMessage.edit({
            embeds: [errorEmbed],
            components: [await buildActionRow(true)],
          });
        }
      });

      return true;
    } catch (error) {
      console.error("Devious cards error:", error);
      client.endGamblingSession(message.author.id);
      await message.reply({
        content: "An error occurred. Your bet has been safely returned.",
      });
      return false;
    }
  },
};
