// filepath: /home/z3r0/Documents/GitHub/queen-v2/Commands/Message/Spirits/roulette.js
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "roulette",
  aliases: ["roul"],
  description:
    "Play roulette! Bet your Spirit Coins on a color or a specific number and try your luck on the wheel!",
  usage: "<bet>",
  cooldown: 30,
  category: "Spirits",
  userPermissions: [],
  botPermissions: [],

  run: async ({ client, message, args, prefix }) => {
    try {
      // Parse bet amount from args.
      const bet = parseInt(args[0]);
      if (isNaN(bet) || bet <= 0)
        return message.reply({
          content: "Please provide a valid bet amount greater than 0.",
        });

      // Fetch the user's profile.
      const userProfile = await profileSchema.findOne({
        userid: message.author.id,
      });
      if (!userProfile)
        return message.reply({
          content:
            "You do not have a profile yet. Please use the `start` command first.",
        });
      if (userProfile.balance < bet)
        return message.reply({
          content: `You do not have enough Spirit Coins. Your balance is \`${userProfile.balance}\`.`,
        });

      // Build the initial embed.
      const rouletteEmbed = new EmbedBuilder()
        .setColor("#ffaa00")
        .setTitle("Roulette")
        .setDescription(
          `You are betting **${bet} Spirit Coins**.\n\n` +
            "Choose your wager below. You can bet on:\n" +
            "• **Red** (even-money, pays 2× your bet)\n" +
            "• **Black** (even-money, pays 2× your bet)\n" +
            "• **Green** (risky: only 0 wins, pays 14× your bet)\n" +
            "• **Specific Number** (pays 36× your bet)\n\n" +
            "Select your betting option from the menu."
        )
        .setFooter({
          text: `Current Balance: ${userProfile.balance} Spirit Coins`,
        });

      // Build a select menu with only four options.
      const options = [
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
      ];
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("roulette_select")
        .setPlaceholder("Choose your bet type")
        .addOptions(options);
      const row = new ActionRowBuilder().addComponents(selectMenu);

      const initialMessage = await message.channel.send({
        embeds: [rouletteEmbed],
        components: [row],
      });

      const filter = (i) =>
        i.customId === "roulette_select" && i.user.id === message.author.id;
      const collector = initialMessage.createMessageComponentCollector({
        filter,
        componentType: ComponentType.StringSelect,
        time: 30000,
      });

      collector.on("collect", async (interaction) => {
        await interaction.deferUpdate();
        let choice = interaction.values[0]; // "red", "black", "green", or "number"
        let betType = "";
        let userNumber = null; // For a specific number bet

        // If the user chose "number", show a modal to get their chosen number.
        if (choice === "number") {
          const modal = new ModalBuilder()
            .setCustomId("roulette_modal")
            .setTitle("Enter Your Number Bet");

          const numberInput = new TextInputBuilder()
            .setCustomId("number_input")
            .setLabel("Enter a number between 0 and 36")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          const actionRow = new ActionRowBuilder().addComponents(numberInput);
          modal.addComponents(actionRow);

          await interaction.showModal(modal);

          // Wait for the modal submit interaction.
          const modalInteraction = await interaction
            .awaitModalSubmit({
              time: 30000,
            })
            .catch(() => null);

          if (!modalInteraction) {
            return interaction.editReply({
              content: "Modal timed out. Please try again.",
              components: [],
            });
          }
          const inputValue =
            modalInteraction.fields.getTextInputValue("number_input");
          userNumber = parseInt(inputValue);
          if (isNaN(userNumber) || userNumber < 0 || userNumber > 36) {
            return modalInteraction.reply({
              content: "Invalid number provided. Please try again.",
              ephemeral: true,
            });
          }
          betType = `Number ${userNumber}`;
          await modalInteraction.deferUpdate();
        } else {
          betType = choice[0].toUpperCase() + choice.slice(1);
        }

        // Animation: simulate the roulette wheel spinning
        const animationSteps = 10;
        for (let i = 0; i < animationSteps; i++) {
          const spinNumber = Math.floor(Math.random() * 37);
          let spinColor = "red";
          if (spinNumber === 0) {
            spinColor = "green";
          } else if (spinNumber % 2 === 0) {
            spinColor = "black";
          }
          const animEmbed = new EmbedBuilder()
            .setColor("#ffaa00")
            .setTitle("Roulette - Spinning...")
            .setDescription(
              `Roulette Wheel: **${spinNumber} (${spinColor.toUpperCase()})**`
            )
            .setFooter({ text: "Spinning..." });
          await interaction.editReply({ embeds: [animEmbed] });
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Final spin result
        const winningNumber = Math.floor(Math.random() * 37);
        let winningColor = "red";
        if (winningNumber === 0) {
          winningColor = "green";
        } else if (winningNumber % 2 === 0) {
          winningColor = "black";
        } else {
          winningColor = "red";
        }

        let win = false;
        let payoutMultiplier = 0;
        // Evaluate the bet.
        if (choice === "number") {
          if (userNumber === winningNumber) {
            win = true;
            payoutMultiplier = 36;
          }
        } else {
          if (choice === "green") {
            if (winningNumber === 0) {
              win = true;
              payoutMultiplier = 14;
            }
          } else if (choice === winningColor) {
            win = true;
            payoutMultiplier = 2;
          }
        }

        let outcomeDescription = "";
        let winAmount = 0;
        let newBalance = userProfile.balance;
        if (win && payoutMultiplier) {
          winAmount = bet * payoutMultiplier;
          newBalance += winAmount - bet;
          outcomeDescription = `Congratulations! The wheel landed on **${winningNumber} (${winningColor.toUpperCase()})** and your bet on **${betType}** wins!\nYou earn **${winAmount} Spirit Coins**.`;
        } else {
          newBalance -= bet;
          outcomeDescription = `Sorry. The wheel landed on **${winningNumber} (${winningColor.toUpperCase()})** and your bet on **${betType}** loses.\nYou lost **${bet} Spirit Coins**.`;
        }

        // Update the user's profile.
        await profileSchema.findOneAndUpdate(
          { userid: message.author.id },
          { balance: newBalance }
        );

        const resultEmbed = new EmbedBuilder()
          .setColor(win ? "#00ff00" : "#ff0000")
          .setTitle("Roulette Result")
          .setDescription(
            outcomeDescription +
              `\n\n**New Balance:** ${newBalance} Spirit Coins`
          )
          .setFooter({ text: "Good luck next time!" });

        const disabledRow = ActionRowBuilder.from(row).setComponents(
          selectMenu.setDisabled(true)
        );
        await interaction.editReply({
          embeds: [resultEmbed],
          components: [disabledRow],
        });
        collector.stop();
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          rouletteEmbed.setDescription(
            "You did not choose a bet in time. Please try again."
          );
          initialMessage.edit({ embeds: [rouletteEmbed], components: [] });
        }
      });
    } catch (error) {
      console.error("Roulette error:", error);
      return message.channel.send({
        content:
          "An error occurred while playing roulette. Please try again later.",
      });
    }
  },
};
