import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from "discord.js";
import profileSchema from "../../../schema/profile.js";

// Slot machine settings for different difficulties
const DIFFICULTY_SETTINGS = {
  easy: {
    tripleSevenMultiplier: 3,
    tripleMatchMultiplier: 2,
    doubleMatchMultiplier: 1.2,
    noMatchMultiplier: -0.2,
    description: "Higher chance of winning but lower payouts",
  },
  normal: {
    tripleSevenMultiplier: 5,
    tripleMatchMultiplier: 3,
    doubleMatchMultiplier: 1.5,
    noMatchMultiplier: 0,
    description: "Balanced win rates and payouts",
  },
  hard: {
    tripleSevenMultiplier: 15,
    tripleMatchMultiplier: 10,
    doubleMatchMultiplier: 0,
    noMatchMultiplier: 0,
    description: "Lower chance of winning but higher payouts",
  },
};

const SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "7️⃣", "🍀"];

export default {
  data: new SlashCommandBuilder()
    .setName("slot")
    .setDescription("Play the slot machine with your Spirit Coins")
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
        .setDescription("Choose your difficulty mode")
        .addChoices(
          { name: "Easy - Higher chance, lower rewards", value: "easy" },
          { name: "Normal - Balanced odds and rewards", value: "normal" },
          { name: "Hard - Lower chance, higher rewards", value: "hard" }
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
      const bet = interaction.options.getInteger("bet");
      const difficulty =
        interaction.options.getString("difficulty") || "normal";
      const settings = DIFFICULTY_SETTINGS[difficulty];

      // Validate user profile and balance
      const userProfile = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      if (!userProfile) {
        client.endGamblingSession(interaction.user.id);
        return interaction.editReply({
          content:
            "You don't have a profile yet. Please use the `/start` command first.",
        });
      }

      if (userProfile.balance < bet) {
        client.endGamblingSession(interaction.user.id);
        return interaction.editReply({
          content: `You don't have enough Spirit Coins. Your balance is \`${userProfile.balance}\`.`,
        });
      }

      // Create initial embed
      const initialEmbed = new EmbedBuilder()
        .setColor("#00aaff")
        .setTitle("🎰 Slot Machine")
        .setDescription(
          `Place your bet of **${bet} Spirit Coins** in **${difficulty.toUpperCase()}** mode\n` +
            `${settings.description}\n\n` +
            "Press the **Spin** button when you're ready!"
        )
        .addFields([
          {
            name: "Payouts",
            value:
              `Triple 7's: ${settings.tripleSevenMultiplier}× bet\n` +
              `Triple Match: ${settings.tripleMatchMultiplier}× bet\n` +
              `Double Match: ${settings.doubleMatchMultiplier}× bet\n` +
              `No Match: ${Math.abs(settings.noMatchMultiplier)}× refund`,
          },
        ])
        .setFooter({
          text: `Current Balance: ${userProfile.balance} Spirit Coins`,
        });

      // Create spin button
      const spinButton = new ButtonBuilder()
        .setCustomId("slot_spin")
        .setLabel("🎰 Spin")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(spinButton);

      const message = await interaction.editReply({
        embeds: [initialEmbed],
        components: [row],
      });

      // Create collector for spin button
      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 30000,
        max: 1,
        componentType: ComponentType.Button,
      });

      collector.on("collect", async (i) => {
        try {
          await i.deferUpdate();

          // Spin animation
          const roll = () =>
            SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          for (let step = 0; step < 6; step++) {
            const spinEmbed = new EmbedBuilder()
              .setColor("#00aaff")
              .setTitle("🎰 Slot Machine - Spinning...")
              .setDescription(`**[ ${roll()} | ${roll()} | ${roll()} ]**`);

            await i.editReply({ embeds: [spinEmbed] });
            await new Promise((resolve) => setTimeout(resolve, 600));
          }

          // Final spin results
          const reels = [roll(), roll(), roll()];
          const isTriple = reels.every((symbol) => symbol === reels[0]);
          const isTripleSeven = isTriple && reels[0] === "7️⃣";
          const isDouble =
            reels[0] === reels[1] ||
            reels[1] === reels[2] ||
            reels[0] === reels[2];

          // Calculate winnings based on difficulty
          let multiplier = 0;
          let outcomeMessage = "";

          if (isTripleSeven) {
            multiplier = settings.tripleSevenMultiplier;
            outcomeMessage = `Triple 7's in ${difficulty} mode! ${
              difficulty === "hard" ? "MASSIVE" : "Nice"
            } jackpot!`;
          } else if (isTriple) {
            multiplier = settings.tripleMatchMultiplier;
            outcomeMessage = `Triple match in ${difficulty} mode! Great win!`;
          } else if (isDouble) {
            multiplier = settings.doubleMatchMultiplier;
            outcomeMessage = `Double match in ${difficulty} mode!`;
          } else {
            multiplier = settings.noMatchMultiplier;
            outcomeMessage =
              "No match! " +
              (multiplier < 0
                ? `But you get a ${Math.abs(multiplier) * 100}% refund!`
                : "Better luck next time!");
          }

          // Calculate final balance changes
          const winAmount = multiplier > 0 ? Math.ceil(bet * multiplier) : 0;
          const refundAmount =
            multiplier < 0 ? Math.ceil(bet * Math.abs(multiplier)) : 0;
          const totalChange = winAmount + refundAmount - bet;
          const newBalance = userProfile.balance + totalChange;

          // Update database
          await profileSchema.findOneAndUpdate(
            { userid: interaction.user.id },
            { balance: newBalance }
          );

          // Create result embed
          const resultEmbed = new EmbedBuilder()
            .setColor(totalChange >= 0 ? "#00ff00" : "#ff0000")
            .setTitle(
              totalChange >= 0 ? "🎰 Winner!" : "🎰 Better Luck Next Time!"
            )
            .setDescription(
              `**[ ${reels.join(" | ")} ]**\n\n` +
                `${outcomeMessage}\n\n` +
                (winAmount > 0
                  ? `You won **${winAmount}** Spirit Coins!\n`
                  : "") +
                (refundAmount > 0
                  ? `Refund: **${refundAmount}** Spirit Coins\n`
                  : "") +
                `Net change: **${totalChange}** Spirit Coins\n\n` +
                `New Balance: **${newBalance}** Spirit Coins`
            );

          // Disable the spin button
          spinButton.setDisabled(true);
          await i.editReply({
            embeds: [resultEmbed],
            components: [new ActionRowBuilder().addComponents(spinButton)],
          });

          // End gambling session
          client.endGamblingSession(interaction.user.id);
        } catch (error) {
          console.error("Error in slot spin:", error);
          client.endGamblingSession(interaction.user.id);
          await i.editReply({
            content:
              "An error occurred while spinning. Your bet has been returned.",
            components: [],
          });
        }
      });

      collector.on("end", (collected, reason) => {
        if (reason === "time" && collected.size === 0) {
          client.endGamblingSession(interaction.user.id);
          interaction.editReply({
            content: "Slot machine timed out. Try again!",
            components: [],
          });
        }
      });
    } catch (error) {
      console.error("Error in slot command:", error);
      client.endGamblingSession(interaction.user.id);
      await interaction.editReply({
        content:
          "An error occurred while starting the slot machine. Please try again later.",
      });
    }
  },
};
