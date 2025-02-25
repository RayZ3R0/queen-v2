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
} from "discord.js";
import { basename } from "path";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import profileSchema from "../../../schema/profile.js";

// =================== Configuration Constants =================== //
const CHEAT_PROBABILITY = 0.3;
const SOFT17_HIT_PROBABILITY = 0.5;
const BORDERLINE_NUDGE_PROBABILITY = 0.35;
const EXTRA_TWEAK_PROBABILITY = 0.2;
const NATURAL_BLACKJACK_MULTIPLIER = 1.5; // Payout for natural blackjack (3:2)
const MAX_ANIMATIONS_PER_MIN = 5; // Rate limiting - maximum number of animations

// =================== File Path Setup =================== //
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =================== Card Images Mapping =================== //
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

// =================== Card Deck Utilities =================== //
const generateDeck = () => {
  const deck = [];
  for (const suit of suits) {
    for (const { rank, value } of ranks) {
      deck.push({ code: `${rank}${suit}`, rank, suit, value });
    }
  }
  return deck;
};

const shuffleDeck = (deck) => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const calculateHandTotal = (hand) => {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += card.value;
    if (card.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
};

// Check if hand is a natural blackjack (first two cards totaling 21)
const isNaturalBlackjack = (hand) => {
  return hand.length === 2 && calculateHandTotal(hand) === 21;
};

// =================== Dealer Logic Functions =================== //
const smartDealerMove = (dealerHand, deck) => {
  const isSoft17 = (hand) => {
    let total = 0;
    let aces = 0;
    for (const card of hand) {
      total += card.value;
      if (card.rank === "A") aces++;
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return total === 17 && aces > 0;
  };

  let total = calculateHandTotal(dealerHand);
  while (
    total < 17 ||
    (total === 17 &&
      isSoft17(dealerHand) &&
      Math.random() < SOFT17_HIT_PROBABILITY)
  ) {
    const newCard = deck.pop();
    dealerHand.push(newCard);
    total = calculateHandTotal(dealerHand);
  }

  if (total > 21 && Math.random() < CHEAT_PROBABILITY) {
    for (let i = 0; i < dealerHand.length; i++) {
      const card = dealerHand[i];
      if (["K", "Q", "J", "10"].includes(card.rank)) {
        dealerHand[i] = {
          code: `2${card.suit}`,
          rank: "2",
          suit: card.suit,
          value: 2,
        };
        break;
      }
    }
  }
  return dealerHand;
};

const botCheatAdjustment = (dealerHand) => {
  let total = calculateHandTotal(dealerHand);
  if (
    total >= 17 &&
    total < 21 &&
    Math.random() < BORDERLINE_NUDGE_PROBABILITY
  ) {
    total = Math.min(21, total + 1);
  }
  const isSoft17 = (hand) => {
    let sum = 0,
      aces = 0;
    for (const card of hand) {
      sum += card.value;
      if (card.rank === "A") aces++;
    }
    while (sum > 21 && aces > 0) {
      sum -= 10;
      aces--;
    }
    return sum === 17 && aces > 0;
  };
  if (total === 17 && isSoft17(dealerHand) && Math.random() < 0.5) {
    const bonus = Math.random() < 0.5 ? 1 : 2;
    total = Math.min(21, total + bonus);
  }
  if (total >= 18 && total < 21 && Math.random() < EXTRA_TWEAK_PROBABILITY) {
    total = Math.min(21, total + 1);
  }
  return total;
};

// =================== Rate Limiting Utility =================== //
// Track animation timestamps to prevent rate limiting
const animationTimestamps = new Map();

const canSendAnimation = (userId) => {
  const now = Date.now();
  const userAnimations = animationTimestamps.get(userId) || [];

  // Filter out animations older than 60 seconds
  const recentAnimations = userAnimations.filter((time) => now - time < 60000);

  if (recentAnimations.length >= MAX_ANIMATIONS_PER_MIN) {
    return false;
  }

  // Record this animation
  recentAnimations.push(now);
  animationTimestamps.set(userId, recentAnimations);
  return true;
};

// =================== Modal Utility =================== //
const showInsuranceModal = async (interaction, currentBet, currentBalance) => {
  try {
    const modal = new ModalBuilder()
      .setCustomId(`insurance_modal_${interaction.user.id}`)
      .setTitle("Insurance Option")
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("insurance_input")
            .setLabel(`Insurance (max ${Math.floor(currentBet / 2)}`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`e.g. ${Math.floor(currentBet / 4)}`)
            .setRequired(true)
        )
      );
    await interaction.showModal(modal);

    const modalInteraction = await interaction
      .awaitModalSubmit({
        time: 30000,
        filter: (i) => i.user.id === interaction.user.id,
      })
      .catch(() => null);

    if (!modalInteraction) {
      console.log("Insurance modal timed out or was cancelled.");
      return 0;
    }

    await modalInteraction.deferReply({ ephemeral: true });
    const input = modalInteraction.fields.getTextInputValue("insurance_input");
    let insuranceBet = parseInt(input);

    if (isNaN(insuranceBet) || insuranceBet < 0) {
      insuranceBet = 0;
    }

    // Cap the insurance bet at half the original bet
    if (insuranceBet > Math.floor(currentBet / 2)) {
      insuranceBet = Math.floor(currentBet / 2);
    }

    const newBalance = currentBalance - insuranceBet;

    await modalInteraction.editReply({
      content: `Insurance bet set to ${insuranceBet} Spirit Coins. Your new balance: ${newBalance} Spirit Coins.`,
    });

    return insuranceBet;
  } catch (err) {
    console.error("Error in showInsuranceModal:", err);
    return 0;
  }
};

// =================== Main Command Export =================== //
export default {
  name: "cards",
  aliases: ["card", "gamble"],
  description:
    "Enter the realm of Devious Dealer—a card game where skill meets cunning deceit. " +
    "Wager your Spirit Coins against a dealer who plays smart, employs trickery, and bends the rules ever so slightly in his favor. " +
    "Will you risk it all, take insurance, or surrender your hand? The game is thrilling, interactive, and rigged so that the house nearly always wins.",
  usage: "<bet>",
  cooldown: 30,
  category: "Spirits",
  userPermissions: [],
  botPermissions: [],
  gambling: true,
  autoEndGamblingSession: false, // Add this property to manage sessions manually
  run: async ({ client, message, args, prefix }) => {
    try {
      // --- Input Validation ---
      const bet = parseInt(args[0]);
      if (isNaN(bet) || bet <= 0) {
        // End the gambling session since we're returning early
        client.endGamblingSession(message.author.id);
        return message.reply({
          content: "Please provide a valid bet amount greater than 0.",
        });
      }

      // --- User Profile Check ---
      const userProfile = await profileSchema.findOne({
        userid: message.author.id,
      });
      if (!userProfile) {
        // End the gambling session since we're returning early
        client.endGamblingSession(message.author.id);
        return message.reply({
          content:
            "You do not have a profile yet. Please use the `start` command first.",
        });
      }
      if (userProfile.balance < bet) {
        // End the gambling session since we're returning early
        client.endGamblingSession(message.author.id);
        return message.reply({
          content: `You do not have enough Spirit Coins. Your balance is \`${userProfile.balance}\`.`,
        });
      }

      // --- Game State Initialization ---
      let deck = shuffleDeck(generateDeck());
      let playerHand = [deck.pop(), deck.pop()];
      let dealerHand = [deck.pop(), deck.pop()];
      let gameOver = false;
      let playerDoubled = false;
      let playerSurrendered = false;
      let insuranceBet = 0;
      let currentBalance = userProfile.balance;

      // --- Rendering Functions ---
      const renderGameEmbed = () => {
        const playerTotal = calculateHandTotal(playerHand);
        const dealerVisible = dealerHand[0];
        const dealerImagePath = cardImages[dealerVisible.code];
        const dealerFileName = basename(dealerImagePath);
        const embed = new EmbedBuilder()
          .setColor("#663399")
          .setTitle("Devious Dealer")
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
          .setImage(`attachment://${dealerFileName}`);
        return { embed, dealerFileName, dealerImagePath };
      };

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

      // --- Intro Narrative ---
      const introEmbed = new EmbedBuilder()
        .setColor("#663399")
        .setTitle("Welcome to Devious Dealer")
        .setDescription(
          `Greetings, ${message.author}!\n` +
            `You have wagered **${bet} Spirit Coins** on this game of guile and chance.\n` +
            "Will you risk it all against our cunning dealer? Choose your move wisely..."
        )
        .setFooter({
          text: `Your Balance: ${currentBalance} Spirit Coins`,
        });
      await message.channel.send({ embeds: [introEmbed] });

      // --- Initial Game Embed ---
      let { embed, dealerFileName, dealerImagePath } = renderGameEmbed();
      const dealerAttachment = new AttachmentBuilder(dealerImagePath, {
        name: dealerFileName,
      });
      let components = [buildActionRow()];
      const gameMessage = await message.channel.send({
        embeds: [embed],
        files: [dealerAttachment],
        components,
      });

      // --- Check for Natural Blackjack ---
      if (isNaturalBlackjack(playerHand)) {
        // If player has natural blackjack, handle it immediately
        const hasInsurance = dealerHand[0].rank === "A";
        let resultMessage = "";
        let winMultiplier = NATURAL_BLACKJACK_MULTIPLIER;

        if (isNaturalBlackjack(dealerHand)) {
          // Both have natural blackjack - it's a push
          resultMessage =
            "Both you and the dealer have natural blackjacks! It's a push.";
          winMultiplier = 0; // No win, no loss
        } else {
          resultMessage = "Natural Blackjack! You win 3:2 on your bet.";
        }

        const winAmount = Math.floor(bet * winMultiplier);
        currentBalance += winAmount;
        await profileSchema.findOneAndUpdate(
          { userid: message.author.id },
          { balance: currentBalance }
        );

        const naturalBlackjackEmbed = new EmbedBuilder()
          .setColor("#ffd700") // Gold color for blackjack
          .setTitle("Natural Blackjack!")
          .setDescription(
            resultMessage +
              `\n\n**Your Hand:** ${playerHand
                .map((card) => `\`${card.code}\``)
                .join(" ")}` +
              `\n**Dealer's Hand:** ${dealerHand
                .map((card) => `\`${card.code}\``)
                .join(" ")}` +
              `\n\n**Winnings:** ${
                winMultiplier > 0
                  ? `${winAmount} Spirit Coins`
                  : "Push - bet returned"
              }` +
              `\n**New Balance:** ${currentBalance} Spirit Coins`
          );

        await gameMessage.edit({
          embeds: [naturalBlackjackEmbed],
          components: [buildActionRow(true)],
        });

        // End the gambling session
        client.endGamblingSession(message.author.id);
        return;
      }

      // --- Handle Insurance if Dealer's Upcard is an Ace ---
      const filter = (i) => i.user.id === message.author.id;
      if (dealerHand[0].rank === "A") {
        const insuranceButton = new ButtonBuilder()
          .setCustomId("insurance")
          .setLabel("Take Insurance")
          .setStyle(ButtonStyle.Primary);
        const insuranceRow = new ActionRowBuilder().addComponents(
          insuranceButton
        );

        await gameMessage.edit({ components: [insuranceRow] });

        const insuranceCollector = gameMessage.createMessageComponentCollector({
          filter,
          componentType: ComponentType.Button,
          max: 1,
          time: 30000,
        });

        await new Promise((resolve) => {
          insuranceCollector.on("collect", async (interaction) => {
            try {
              console.log("Insurance button clicked.");
              await interaction.deferUpdate();
              insuranceBet = await showInsuranceModal(
                interaction,
                bet,
                currentBalance
              );

              if (insuranceBet > Math.floor(bet / 2)) {
                insuranceBet = Math.floor(bet / 2);
              }

              // Update balance immediately when insurance is taken
              currentBalance -= insuranceBet;
              userProfile.balance = currentBalance;
              await profileSchema.findOneAndUpdate(
                { userid: message.author.id },
                { balance: currentBalance }
              );

              console.log(`Insurance bet set to ${insuranceBet}`);

              // Update the game embed with new balance
              const updatedRendering = renderGameEmbed();
              const updatedAttachment = new AttachmentBuilder(
                updatedRendering.dealerImagePath,
                { name: updatedRendering.dealerFileName }
              );

              await gameMessage.edit({
                embeds: [updatedRendering.embed],
                files: [updatedAttachment],
                components: [buildActionRow()],
              });

              resolve();
            } catch (err) {
              console.error("Error in insurance collector 'collect':", err);
              await gameMessage.edit({ components: [buildActionRow()] });
              resolve();
            }
          });

          insuranceCollector.on("end", (collected, reason) => {
            if (reason === "time" || collected.size === 0) {
              console.log("Insurance collector timed out.");
              gameMessage.edit({ components: [buildActionRow()] });
              resolve();
            }
          });
        });
      }

      // --- Main Game Collector ---
      const collector = gameMessage.createMessageComponentCollector({
        filter,
        componentType: ComponentType.Button,
        time: 60000,
      });

      collector.on("collect", async (interaction) => {
        try {
          if (gameOver) return;

          console.log(`Button clicked: ${interaction.customId}`);
          await interaction.deferUpdate();

          switch (interaction.customId) {
            case "hit":
              // Check rate limiting before proceeding
              if (!canSendAnimation(message.author.id)) {
                await interaction.followUp({
                  content:
                    "You're making moves too quickly! Please wait a moment before your next action.",
                  ephemeral: true,
                });
                return;
              }

              playerHand.push(deck.pop());
              break;
            case "double":
              if (playerHand.length === 2 && currentBalance >= bet) {
                playerDoubled = true;
                currentBalance -= bet; // Deduct the additional bet immediately
                playerHand.push(deck.pop());
                gameOver = true;
                collector.stop("double");
              } else {
                await interaction.followUp({
                  content:
                    playerHand.length !== 2
                      ? "You can only double down on your initial 2 cards!"
                      : "Insufficient funds to double down.",
                  ephemeral: true,
                });
                return;
              }
              break;
            case "surrender":
              playerSurrendered = true;
              gameOver = true;
              collector.stop("surrender");
              return;
            case "stand":
              gameOver = true;
              collector.stop("stand");
              return;
            default:
              return;
          }

          const {
            embed: updatedEmbed,
            dealerFileName: updatedFile,
            dealerImagePath: updatedPath,
          } = renderGameEmbed();
          const updatedAttachment = new AttachmentBuilder(updatedPath, {
            name: updatedFile,
          });
          await interaction.editReply({
            embeds: [updatedEmbed],
            files: [updatedAttachment],
            components: [buildActionRow()],
          });

          if (calculateHandTotal(playerHand) > 21) {
            gameOver = true;
            collector.stop("player_busted");
          }
        } catch (err) {
          console.error("Error in main collector 'collect' event:", err);
          await interaction.followUp({
            content: "An error occurred during your action. Game will end.",
            ephemeral: true,
          });
          collector.stop("error");
        }
      });

      collector.on("end", async (collected, reason) => {
        try {
          console.log(`Main collector ended with reason: ${reason}`);

          if (reason === "time") {
            // End the gambling session when the game times out with a thematic message
            client.endGamblingSession(message.author.id);

            const timeoutEmbed = new EmbedBuilder()
              .setColor("#442222")
              .setTitle("The Devious Dealer Grows Impatient...")
              .setDescription(
                "The dealer drums his fingers on the table, his smile fading to a cold stare.\n\n" +
                  "\"Time is money, and you've wasted mine. Return when you're ready to play seriously.\"" +
                  "\n\nYour bet has been returned. The game has ended."
              );

            await message.channel.send({ embeds: [timeoutEmbed] });
            await gameMessage.edit({ components: [buildActionRow(true)] });
            return;
          }

          const playerTotal = calculateHandTotal(playerHand);

          if (reason === "surrender") {
            const surrenderLoss = Math.floor(bet / 2);
            currentBalance -= surrenderLoss;
            await profileSchema.findOneAndUpdate(
              { userid: message.author.id },
              { balance: currentBalance }
            );

            // End the gambling session when player surrenders
            client.endGamblingSession(message.author.id);

            const surrenderEmbed = new EmbedBuilder()
              .setColor("#AA7722")
              .setTitle("Strategic Retreat")
              .setDescription(
                '"A wise decision, perhaps," the dealer says with a thin smile.\n\n' +
                  `You surrender and lose **${surrenderLoss} Spirit Coins**, half your bet.` +
                  `\n\n**New Balance:** ${currentBalance} Spirit Coins`
              );

            await message.channel.send({ embeds: [surrenderEmbed] });
            await gameMessage.edit({ components: [buildActionRow(true)] });
            return;
          }

          if (reason === "player_busted") {
            currentBalance -= bet;
            await profileSchema.findOneAndUpdate(
              { userid: message.author.id },
              { balance: currentBalance }
            );

            // End the gambling session when player busts
            client.endGamblingSession(message.author.id);

            const bustEmbed = new EmbedBuilder()
              .setColor("#CC0000")
              .setTitle("Bust!")
              .setDescription(
                '"Oh dear, it seems fortune has abandoned you," the dealer says with poorly concealed delight.\n\n' +
                  `Your hand of ${playerHand
                    .map((card) => `\`${card.code}\``)
                    .join(" ")} totals **${playerTotal}** - you've busted!` +
                  `\n\nYou lose your bet of **${bet} Spirit Coins**.` +
                  `\n\n**New Balance:** ${currentBalance} Spirit Coins`
              );

            await message.channel.send({ embeds: [bustEmbed] });
            await gameMessage.edit({ components: [buildActionRow(true)] });
            return;
          }

          if (reason === "stand" || reason === "double") {
            dealerHand = smartDealerMove(dealerHand, deck);
            let dealerTotal = botCheatAdjustment(dealerHand);
            let winAmount = 0;
            let resultEmbed;

            // Handle different game outcomes
            if (dealerTotal > 21) {
              // Dealer busted
              winAmount = playerDoubled ? bet * 2 : bet;
              resultEmbed = new EmbedBuilder()
                .setColor("#00CC00")
                .setTitle("The Dealer Busts!")
                .setDescription(
                  '"Impossible!" mutters the dealer, sweat beading on his brow.\n\n' +
                    `The dealer's hand of ${dealerHand
                      .map((card) => `\`${card.code}\``)
                      .join(" ")} totals **${dealerTotal}** - a bust!` +
                    `\n\nYou win **${winAmount} Spirit Coins**!`
                );
            } else if (playerTotal > dealerTotal) {
              // Player wins
              winAmount = playerDoubled ? bet * 2 : bet;
              resultEmbed = new EmbedBuilder()
                .setColor("#00CC00")
                .setTitle("Victory!")
                .setDescription(
                  '"How... fortunate for you," the dealer says through gritted teeth.\n\n' +
                    `Your **${playerTotal}** beats the dealer's **${dealerTotal}**.` +
                    `\n\nYou win **${winAmount} Spirit Coins**!`
                );
            } else if (playerTotal < dealerTotal) {
              // Dealer wins
              winAmount = playerDoubled ? -bet * 2 : -bet;
              resultEmbed = new EmbedBuilder()
                .setColor("#CC0000")
                .setTitle("Defeat")
                .setDescription(
                  "The dealer's smile widens as he reveals his cards.\n\n" +
                    `Your **${playerTotal}** loses to the dealer's **${dealerTotal}**.` +
                    `\n\nYou lose **${Math.abs(winAmount)} Spirit Coins**.`
                );
            } else {
              // Push
              winAmount = 0;
              resultEmbed = new EmbedBuilder()
                .setColor("#CCCC00")
                .setTitle("Push")
                .setDescription(
                  '"A tie. How... anticlimactic," the dealer sighs.\n\n' +
                    `Both you and the dealer have **${playerTotal}**.` +
                    `\n\nYour bet is returned.`
                );
            }

            // Handle insurance payout
            if (
              dealerHand.length === 2 &&
              dealerTotal === 21 &&
              insuranceBet > 0
            ) {
              const insurancePayout = insuranceBet * 2;
              winAmount += insurancePayout;
              resultEmbed.setDescription(
                resultEmbed.data.description +
                  `\n\n**Insurance pays out ${insurancePayout} Spirit Coins!**`
              );
            }

            // Update balance and display final hands
            currentBalance += winAmount;
            await profileSchema.findOneAndUpdate(
              { userid: message.author.id },
              { balance: currentBalance }
            );

            resultEmbed.addFields([
              {
                name: "Your Hand",
                value: `${playerHand
                  .map((card) => `\`${card.code}\``)
                  .join(" ")} (Total: **${playerTotal}**)`,
                inline: true,
              },
              {
                name: "Dealer's Hand",
                value: `${dealerHand
                  .map((card) => `\`${card.code}\``)
                  .join(" ")} (Total: **${dealerTotal}**)`,
                inline: true,
              },
              {
                name: "Result",
                value: `**New Balance:** ${currentBalance} Spirit Coins`,
                inline: false,
              },
            ]);

            // End the gambling session when game completes
            client.endGamblingSession(message.author.id);

            await message.channel.send({ embeds: [resultEmbed] });
            await gameMessage.edit({ components: [buildActionRow(true)] });
          }

          if (reason === "error") {
            // End the gambling session on error
            client.endGamblingSession(message.author.id);

            const errorEmbed = new EmbedBuilder()
              .setColor("#880000")
              .setTitle("Game Interrupted")
              .setDescription(
                "The dealer frowns as a commotion breaks out in the casino.\n\n" +
                  '"We\'ll have to continue this another time. Your bet is safe with me... for now."'
              );

            await message.channel.send({ embeds: [errorEmbed] });
            await gameMessage.edit({ components: [buildActionRow(true)] });
          }
        } catch (err) {
          console.error("Error in main collector 'end' event:", err);
          // End the gambling session if an error occurs during end handling
          client.endGamblingSession(message.author.id);

          await message.channel.send({
            content:
              "An error occurred while concluding the game. Please try again later.",
          });
          await gameMessage.edit({ components: [buildActionRow(true)] });
        }
      });

      return true; // Signal successful execution
    } catch (err) {
      console.error("Error in deviouscards command execution:", err);
      // End the gambling session on error in the main try/catch block
      client.endGamblingSession(message.author.id);

      await message.reply({
        content:
          "An error occurred while starting Devious Dealer. Please try again later.",
      });
      return false; // Signal error execution
    }
  },
};
