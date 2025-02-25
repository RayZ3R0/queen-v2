import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import { basename } from "path";
import profileSchema from "../../../schema/profile.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cardImages = {
  AS: join(__dirname, "../../../Cards/ace_of_spades.png"),
  "2S": join(__dirname, "../../../Cards/2_of_spades.png"),
  "3S": join(__dirname, "../../../Cards/3_of_spades.png"),
  "4S": join(__dirname, "../../../Cards/4_of_spades.png"),
  "5S": join(__dirname, "../../../Cards/5_of_spades.png"),
  "6S": join(__dirname, "../../../Cards/6_of_spades.png"),
  "7S": join(__dirname, "../../../Cards/7_of_spades.png"),
  "8S": join(__dirname, "../../../Cards/8_of_spades.png"),
  "9S": join(__dirname, "../../../Cards/9_of_spades.png"),
  "10S": join(__dirname, "../../../Cards/10_of_spades.png"),
  JS: join(__dirname, "../../../Cards/jack_of_spades.png"),
  QS: join(__dirname, "../../../Cards/queen_of_spades.png"),
  KS: join(__dirname, "../../../Cards/king_of_spades.png"),

  AH: join(__dirname, "../../../Cards/ace_of_hearts.png"),
  "2H": join(__dirname, "../../../Cards/2_of_hearts.png"),
  "3H": join(__dirname, "../../../Cards/3_of_hearts.png"),
  "4H": join(__dirname, "../../../Cards/4_of_hearts.png"),
  "5H": join(__dirname, "../../../Cards/5_of_hearts.png"),
  "6H": join(__dirname, "../../../Cards/6_of_hearts.png"),
  "7H": join(__dirname, "../../../Cards/7_of_hearts.png"),
  "8H": join(__dirname, "../../../Cards/8_of_hearts.png"),
  "9H": join(__dirname, "../../../Cards/9_of_hearts.png"),
  "10H": join(__dirname, "../../../Cards/10_of_hearts.png"),
  JH: join(__dirname, "../../../Cards/jack_of_hearts.png"),
  QH: join(__dirname, "../../../Cards/queen_of_hearts.png"),
  KH: join(__dirname, "../../../Cards/king_of_hearts.png"),

  AD: join(__dirname, "../../../Cards/ace_of_diamonds.png"),
  "2D": join(__dirname, "../../../Cards/2_of_diamonds.png"),
  "3D": join(__dirname, "../../../Cards/3_of_diamonds.png"),
  "4D": join(__dirname, "../../../Cards/4_of_diamonds.png"),
  "5D": join(__dirname, "../../../Cards/5_of_diamonds.png"),
  "6D": join(__dirname, "../../../Cards/6_of_diamonds.png"),
  "7D": join(__dirname, "../../../Cards/7_of_diamonds.png"),
  "8D": join(__dirname, "../../../Cards/8_of_diamonds.png"),
  "9D": join(__dirname, "../../../Cards/9_of_diamonds.png"),
  "10D": join(__dirname, "../../../Cards/10_of_diamonds.png"),
  JD: join(__dirname, "../../../Cards/jack_of_diamonds.png"),
  QD: join(__dirname, "../../../Cards/queen_of_diamonds.png"),
  KD: join(__dirname, "../../../Cards/king_of_diamonds.png"),

  AC: join(__dirname, "../../../Cards/ace_of_clubs.png"),
  "2C": join(__dirname, "../../../Cards/2_of_clubs.png"),
  "3C": join(__dirname, "../../../Cards/3_of_clubs.png"),
  "4C": join(__dirname, "../../../Cards/4_of_clubs.png"),
  "5C": join(__dirname, "../../../Cards/5_of_clubs.png"),
  "6C": join(__dirname, "../../../Cards/6_of_clubs.png"),
  "7C": join(__dirname, "../../../Cards/7_of_clubs.png"),
  "8C": join(__dirname, "../../../Cards/8_of_clubs.png"),
  "9C": join(__dirname, "../../../Cards/9_of_clubs.png"),
  "10C": join(__dirname, "../../../Cards/10_of_clubs.png"),
  JC: join(__dirname, "../../../Cards/jack_of_clubs.png"),
  QC: join(__dirname, "../../../Cards/queen_of_clubs.png"),
  KC: join(__dirname, "../../../Cards/king_of_clubs.png"),
};

// Card definitions and helper functions
const suits = ["S", "H", "D", "C"];
const ranks = [
  { rank: "A", value: 11 },
  { rank: "2", value: 2 },
  { rank: "3", value: 3 },
  { rank: "4", value: 4 },
  { rank: "5", value: 5 },
  { rank: "6", value: 6 },
  { rank: "7", value: 7 },
  { rank: "8", value: 8 },
  { rank: "9", value: 9 },
  { rank: "10", value: 10 },
  { rank: "J", value: 10 },
  { rank: "Q", value: 10 },
  { rank: "K", value: 10 },
];

// Generate a new deck of cards
const generateDeck = () => {
  const deck = [];
  for (const suit of suits) {
    for (const { rank, value } of ranks) {
      deck.push({ code: `${rank}${suit}`, rank, suit, value });
    }
  }
  return deck;
};

// Shuffle the deck
const shuffleDeck = (deck) => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

// Calculate the total value of a hand
const calculateHandTotal = (hand) => {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    total += card.value;
    if (card.rank === "A") aces++;
  }

  // Adjust for aces
  while (total > 21 && aces > 0) {
    total -= 10; // Convert an ace from 11 to 1
    aces--;
  }

  return total;
};

export default {
  name: "blackjack",
  aliases: ["bj"],
  description: "Play a game of blackjack and bet your Spirit Coins!",
  usage: "<bet>",
  cooldown: 10,
  userPermissions: [],
  botPermissions: [],
  category: "Spirits",
  gambling: true,
  // Don't auto-end the gambling session in messageCreate's finally block
  // We'll manage it manually to ensure it ends at the right time
  autoEndGamblingSession: false,
  run: async ({ client, message, args, prefix }) => {
    try {
      // Parse bet amount
      const bet = parseInt(args[0]);
      if (isNaN(bet) || bet <= 0) {
        // End the gambling session early since we're returning
        client.endGamblingSession(message.author.id);
        await message.reply({
          content: "Please provide a valid bet amount greater than 0.",
        });
        return false;
      }

      // Check user profile
      const userProfile = await profileSchema.findOne({
        userid: message.author.id,
      });

      if (!userProfile) {
        // End the gambling session early since we're returning
        client.endGamblingSession(message.author.id);
        await message.reply({
          content:
            "You do not have a profile yet. Please use the `start` command first.",
        });
        return false;
      }

      if (userProfile.balance < bet) {
        // End the gambling session early since we're returning
        client.endGamblingSession(message.author.id);
        await message.reply({
          content: `You do not have enough Spirit Coins. Your balance is \`${userProfile.balance}\`.`,
        });
        return false;
      }

      // Initialize the game
      let deck = shuffleDeck(generateDeck());
      const playerHand = [deck.pop(), deck.pop()];
      const dealerHand = [deck.pop(), deck.pop()];
      const playerTotal = calculateHandTotal(playerHand);
      const dealerVisibleCard = dealerHand[0];

      // Create attachment for dealer's card
      const dealerImagePath = cardImages[dealerVisibleCard.code];
      const dealerFileName = basename(dealerImagePath);
      const dealerAttachment = new AttachmentBuilder(dealerImagePath, {
        name: dealerFileName,
      });

      // Create and send initial game embed
      const gameEmbed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("Blackjack")
        .setDescription(
          `**Your Hand:** ${playerHand
            .map((card) => `\`\`${card.code}\`\``)
            .join(" ")}\n` +
            `Total: **${playerTotal}**\n` +
            `**Dealer's Visible Card:** \`\`${dealerVisibleCard.code}\`\``
        )
        .setImage(`attachment://${dealerFileName}`)
        .setFooter({ text: `Bet: ${bet} Spirit Coins` })
        .addFields({
          name: "Current Bet",
          value: `${bet} Spirit Coins`,
          inline: true,
        });

      await message.channel.send({
        embeds: [gameEmbed],
        files: [dealerAttachment],
      });

      await message.channel.send({
        content: `${message.author}, type \`hit\` or \`stand\` to play your turn!`,
      });

      // Wrap the interactive session in a Promise to keep gambling session active
      await new Promise((resolve) => {
        const filter = (m) =>
          m.author.id === message.author.id &&
          ["hit", "stand"].includes(m.content.toLowerCase());

        const collector = message.channel.createMessageCollector({
          filter,
          time: 30000,
        });

        let bust = false;
        let currentPlayerHand = [...playerHand];

        // Handle player moves
        collector.on("collect", (m) => {
          const command = m.content.toLowerCase();

          if (command === "hit") {
            const newCard = deck.pop();
            currentPlayerHand.push(newCard);
            const total = calculateHandTotal(currentPlayerHand);

            let replyMessage =
              `You drew \`\`${
                newCard.code
              }\`\`. Your hand is now: ${currentPlayerHand
                .map((c) => `\`\`${c.code}\`\``)
                .join(" ")} (Total: **${total}**).\n` +
              "Type `hit` to draw another card or `stand` to hold your hand.";

            if (total > 21) {
              replyMessage += "\nYou busted!";
              bust = true;
              collector.stop("busted");
            }

            m.reply({ content: replyMessage });
          } else if (command === "stand") {
            collector.stop("stand");
            m.reply({ content: "You stand. Calculating the outcome..." });
          }
        });

        // Handle end of game
        collector.on("end", async (collected, reason) => {
          try {
            // IMPORTANT: End the gambling session when the collector ends
            // This is important to handle all cases - including timeouts and errors
            // We do this early to ensure it happens even if there's an error below
            client.endGamblingSession(message.author.id);

            if (reason === "time") {
              await message.channel.send({
                content: "Time ran out! Blackjack game cancelled.",
              });
              resolve();
              return;
            }

            const finalPlayerTotal = calculateHandTotal(currentPlayerHand);
            let resultMessage = "";
            let outcome = "";

            if (bust) {
              outcome = "bust";
              resultMessage = `You busted with a total of ${finalPlayerTotal}. You lose your bet of ${bet} Spirit Coins.`;
            } else {
              // Dealer's turn
              let dealerTotal = calculateHandTotal(dealerHand);

              // Dealer must hit until they have at least 17
              while (dealerTotal < 17) {
                dealerHand.push(deck.pop());
                dealerTotal = calculateHandTotal(dealerHand);
              }

              resultMessage += `**Dealer's Hand:** ${dealerHand
                .map((c) => `\`\`${c.code}\`\``)
                .join(" ")} (Total: **${dealerTotal}**).\n`;

              if (dealerTotal > 21 || finalPlayerTotal > dealerTotal) {
                outcome = "win";
                resultMessage += `You win! You gain ${bet} Spirit Coins.`;
              } else if (finalPlayerTotal < dealerTotal) {
                outcome = "lose";
                resultMessage += `You lose! You lose your bet of ${bet} Spirit Coins.`;
              } else {
                outcome = "push";
                resultMessage += "It's a push! Your bet is returned.";
              }
            }

            // Update balance
            let newBalance = userProfile.balance;
            if (outcome === "win") {
              newBalance += bet;
            } else if (outcome === "lose" || outcome === "bust") {
              newBalance -= bet;
            }

            // Update database
            await profileSchema.findOneAndUpdate(
              { userid: message.author.id },
              { balance: Math.ceil(newBalance) }
            );

            // Create and send result embed
            const resultEmbed = new EmbedBuilder()
              .setColor(
                outcome === "win"
                  ? "#00ff00"
                  : outcome === "push"
                  ? "#ffff00"
                  : "#ff0000"
              )
              .setTitle("Blackjack Result")
              .setDescription(
                `**Your Final Hand:** ${currentPlayerHand
                  .map((c) => `\`\`${c.code}\`\``)
                  .join(" ")} (Total: **${finalPlayerTotal}**)\n` +
                  resultMessage +
                  `\n**New Balance:** ${Math.ceil(newBalance)} Spirit Coins.`
              )
              .addFields(
                { name: "Bet", value: `${bet} Spirit Coins`, inline: true },
                {
                  name: "Win Amount",
                  value:
                    outcome === "win"
                      ? `${bet} Spirit Coins`
                      : outcome === "lose" || outcome === "bust"
                      ? `-${bet} Spirit Coins`
                      : "0",
                  inline: true,
                }
              );

            // Add player's first card as thumbnail
            const playerImagePath = cardImages[currentPlayerHand[0].code];
            const playerFileName = basename(playerImagePath);
            const playerAttachment = new AttachmentBuilder(playerImagePath, {
              name: playerFileName,
            });

            resultEmbed.setThumbnail(`attachment://${playerFileName}`);

            // Send final result
            await message.channel.send({
              embeds: [resultEmbed],
              files: [playerAttachment],
            });
          } catch (err) {
            console.error("Error in blackjack end event:", err);
            await message.channel.send({
              content: "An error occurred while finishing the blackjack game.",
            });
          } finally {
            resolve();
          }
        });
      });

      return true; // Signal successful execution
    } catch (error) {
      console.error("Blackjack error:", error);
      // IMPORTANT: End the gambling session if there's an error
      client.endGamblingSession(message.author.id);
      await message.channel.send({
        content:
          "An error occurred while playing blackjack. Please try again later.",
      });
      return false;
    }
  },
};
