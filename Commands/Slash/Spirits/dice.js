import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import profileSchema from "../../../schema/profile.js";

const DICE_EMOJIS = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export default {
  name: "dice",
  data: new SlashCommandBuilder()
    .setName("dice")
    .setDescription("Play dice with Spirit Coins")
    .addIntegerOption((option) =>
      option
        .setName("bet")
        .setDescription("Amount to bet")
        .setRequired(true)
        .setMinValue(100)
        .setMaxValue(10000)
    )
    .addIntegerOption((option) =>
      option
        .setName("number")
        .setDescription("Number to bet on (1-6)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(6)
    ),
  category: "Spirits",
  gambling: true,

  run: async ({ client, interaction }) => {
    try {
      // Start gambling session
      if (!client.startGamblingSession(interaction.user.id, interaction)) {
        return interaction.reply({
          content:
            "You are already in a gambling session. Please finish it first.",
          ephemeral: true,
        });
      }

      const bet = interaction.options.getInteger("bet");
      const chosenNumber = interaction.options.getInteger("number");

      // Check user's balance
      const userData = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      if (!userData) {
        client.endGamblingSession(interaction.user.id);
        return interaction.reply({
          content: "Please use `/start` first to create your profile.",
          ephemeral: true,
        });
      }

      if (userData.balance < bet) {
        client.endGamblingSession(interaction.user.id);
        return interaction.reply({
          content: `You don't have enough Spirit Coins. Your balance: ${userData.balance}`,
          ephemeral: true,
        });
      }

      await interaction.deferReply();

      // Create roll button
      const rollButton = new ButtonBuilder()
        .setCustomId("roll")
        .setLabel("🎲 Roll Dice")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(rollButton);

      // Initial embed
      const gameEmbed = new EmbedBuilder()
        .setColor("Random")
        .setTitle("🎲 Dice Game")
        .setDescription(
          `Betting **${bet}** Spirit Coins on number **${chosenNumber}**\n` +
            `Press the button to roll!\n\n` +
            `Win multipliers:\n` +
            `• Exact match: 5x bet\n` +
            `• Off by 1: 2x bet`
        );

      const message = await interaction.editReply({
        embeds: [gameEmbed],
        components: [row],
      });

      // Create collector for roll button
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000,
        max: 1,
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({
            content: "This isn't your game!",
            ephemeral: true,
          });
        }

        await i.deferUpdate();

        // Roll the dice
        const roll = Math.floor(Math.random() * 6) + 1;
        const difference = Math.abs(roll - chosenNumber);
        let multiplier = 0;
        let resultText = "";

        // Calculate result
        if (difference === 0) {
          multiplier = 5;
          resultText = "Perfect match! You win 5x your bet! 🎉";
        } else if (difference === 1) {
          multiplier = 2;
          resultText = "Close! Off by 1! You win 2x your bet! 🎯";
        } else {
          multiplier = 0;
          resultText = "Not quite! Better luck next time! 🎲";
        }

        // Calculate winnings
        const winnings = bet * multiplier;
        const balanceChange = winnings - bet;

        // Update user's balance
        await profileSchema.findOneAndUpdate(
          { userid: interaction.user.id },
          { $inc: { balance: balanceChange } }
        );

        // Update embed with results
        gameEmbed
          .setDescription(
            `You rolled: ${DICE_EMOJIS[roll - 1]}\n` +
              `You chose: ${chosenNumber}\n\n` +
              resultText +
              "\n\n" +
              (balanceChange >= 0
                ? `Won: ${balanceChange} Spirit Coins`
                : `Lost: ${Math.abs(balanceChange)} Spirit Coins`)
          )
          .setFooter({
            text: `New balance: ${
              userData.balance + balanceChange
            } Spirit Coins`,
          });

        await interaction.editReply({
          embeds: [gameEmbed],
          components: [],
        });

        client.endGamblingSession(interaction.user.id);
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          gameEmbed.setDescription("Game timed out!");
          interaction.editReply({
            embeds: [gameEmbed],
            components: [],
          });
          client.endGamblingSession(interaction.user.id);
        }
      });
    } catch (error) {
      console.error("Dice command error:", error);
      client.endGamblingSession(interaction.user.id);
      return interaction.editReply({
        content: "An error occurred. Please try again later.",
        components: [],
      });
    }
  },
};
