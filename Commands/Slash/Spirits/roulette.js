import {
  ApplicationCommandType,
  ApplicationCommandOptionType,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import profileSchema from "../../../schema/profile.js";

/**
 * @type {import("../../../index").Scommand}
 */
export default {
  name: "roulette",
  description: "Play roulette with your Spirit Coins",
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
    {
      name: "type",
      description: "Type of bet to place",
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: [
        { name: "Red", value: "red" },
        { name: "Black", value: "black" },
        { name: "Green", value: "green" },
      ],
    },
    {
      name: "number",
      description: "Specific number to bet on (0-36)",
      type: ApplicationCommandOptionType.Integer,
      required: false,
      minValue: 0,
      maxValue: 36,
    },
  ],

  run: async ({ client, interaction }) => {
    if (!client.gamblingEnabled) {
      return interaction.reply({
        content: "Gambling is currently disabled.",
        ephemeral: true,
      });
    }

    // Check if user is already in a gambling session
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
      const preselectedType = interaction.options.getString("type");
      const preselectedNumber = interaction.options.getInteger("number");

      // Validate user profile and balance
      const userProfile = await profileSchema.findOne({
        userid: interaction.user.id,
      });

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

      const rouletteEmbed = new EmbedBuilder()
        .setColor("#ffaa00")
        .setTitle("🎰 Roulette")
        .setDescription(
          `You are betting **${bet} Spirit Coins**.\n\n` +
            "Choose your wager below. You can bet on:\n" +
            "• **Red** (even-money, pays 2× your bet)\n" +
            "• **Black** (even-money, pays 2× your bet)\n" +
            "• **Green** (risky: only 0 wins, pays 14× your bet)\n" +
            "• **Specific Number** (pays 36× your bet)"
        )
        .setImage(
          "https://media.discordapp.net/attachments/1343509422496026646/1343509709122179102/roulette.gif"
        )
        .setFooter({
          text: `Current Balance: ${userProfile.balance} Spirit Coins`,
        });

      // Handle direct bet if type or number is provided
      if (preselectedType || preselectedNumber !== null) {
        return await handleBet(
          interaction,
          bet,
          preselectedType,
          preselectedNumber,
          userProfile
        );
      }

      // Create selection menu for interactive betting
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("roulette_select")
        .setPlaceholder("Choose your bet type")
        .addOptions([
          { label: "Red", description: "Bet on Red", value: "red" },
          { label: "Black", description: "Bet on Black", value: "black" },
          {
            label: "Green",
            description: "Bet on Green (only 0 wins)",
            value: "green",
          },
          {
            label: "Number",
            description: "Bet on a specific number (0-36)",
            value: "number",
          },
        ]);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const message = await interaction.editReply({
        embeds: [rouletteEmbed],
        components: [row],
      });

      const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === interaction.user.id,
        time: 30000,
        componentType: ComponentType.StringSelect,
      });

      collector.on("collect", async (i) => {
        try {
          const choice = i.values[0];

          if (choice === "number") {
            const modal = new ModalBuilder()
              .setCustomId("roulette_modal")
              .setTitle("Enter Your Number Bet");

            const numberInput = new TextInputBuilder()
              .setCustomId("number_input")
              .setLabel("Enter a number between 0 and 36")
              .setStyle(TextInputStyle.Short)
              .setRequired(true);

            modal.addComponents(
              new ActionRowBuilder().addComponents(numberInput)
            );
            await i.showModal(modal);

            const modalResponse = await i
              .awaitModalSubmit({
                time: 30000,
                filter: (mi) => mi.user.id === interaction.user.id,
              })
              .catch(() => null);

            if (!modalResponse) {
              collector.stop("timeout");
              return;
            }

            const number = parseInt(
              modalResponse.fields.getTextInputValue("number_input")
            );
            if (isNaN(number) || number < 0 || number > 36) {
              await modalResponse.reply({
                content: "Please provide a valid number between 0 and 36.",
                ephemeral: true,
              });
              collector.stop("invalid");
              return;
            }

            await modalResponse.deferUpdate();
            await handleBet(interaction, bet, "number", number, userProfile);
          } else {
            await i.deferUpdate();
            await handleBet(interaction, bet, choice, null, userProfile);
          }

          collector.stop("success");
        } catch (error) {
          console.error("Error in roulette interaction:", error);
          collector.stop("error");
        }
      });

      collector.on("end", (_, reason) => {
        client.gamblingUsers.delete(interaction.user.id);
        if (reason === "time") {
          interaction.editReply({
            content: "Roulette game timed out. Try again!",
            components: [],
          });
        }
      });
    } catch (error) {
      console.error("Error in roulette command:", error);
      client.gamblingUsers.delete(interaction.user.id);
      await interaction.editReply({
        content:
          "An error occurred while playing roulette. Please try again later.",
      });
    }
  },
};

async function handleBet(interaction, bet, betType, number, userProfile) {
  try {
    // Calculate winning number and color
    const winningNumber = Math.floor(Math.random() * 37);
    let winningColor =
      winningNumber === 0 ? "green" : winningNumber % 2 === 0 ? "black" : "red";

    // Animate the wheel
    const spinSteps = 5;
    for (let i = 0; i < spinSteps; i++) {
      const tempNumber = Math.floor(Math.random() * 37);
      const tempColor =
        tempNumber === 0 ? "green" : tempNumber % 2 === 0 ? "black" : "red";

      const spinEmbed = new EmbedBuilder()
        .setColor("#ffaa00")
        .setTitle("🎲 Roulette - Spinning...")
        .setDescription(
          `Wheel shows: **${tempNumber} (${tempColor.toUpperCase()})**`
        );

      await interaction.editReply({ embeds: [spinEmbed] });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Determine win/loss
    let win = false;
    let multiplier = 0;

    if (betType === "number" && number === winningNumber) {
      win = true;
      multiplier = 36;
    } else if (betType === winningColor) {
      win = true;
      multiplier = betType === "green" ? 14 : 2;
    }

    // Calculate results
    const winAmount = win ? bet * multiplier : 0;
    const newBalance = userProfile.balance + (win ? winAmount - bet : -bet);

    // Update database
    await profileSchema.findOneAndUpdate(
      { userid: interaction.user.id },
      { balance: newBalance }
    );

    // Create result embed
    const resultEmbed = new EmbedBuilder()
      .setColor(win ? "Green" : "Red")
      .setTitle(win ? "🎉 You Won!" : "😔 You Lost!")
      .setDescription(
        `The wheel landed on **${winningNumber} (${winningColor.toUpperCase()})**\n\n` +
          `Your bet: **${
            betType === "number" ? `Number ${number}` : betType.toUpperCase()
          }**\n` +
          `${
            win
              ? `You won **${winAmount}** Spirit Coins!`
              : `You lost **${bet}** Spirit Coins.`
          }\n\n` +
          `New balance: **${newBalance}** Spirit Coins`
      );

    await interaction.editReply({
      embeds: [resultEmbed],
      components: [],
    });
  } catch (error) {
    console.error("Error in handleBet:", error);
    throw error;
  }
}
