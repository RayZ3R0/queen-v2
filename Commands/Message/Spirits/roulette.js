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
  aliases: ["roul", "r"],
  description:
    "Play roulette! Bet your Spirit Coins on a color or a specific number and try your luck on the wheel!",
  usage: "<bet>",
  cooldown: 10,
  category: "Spirits",
  userPermissions: [],
  botPermissions: [],
  gambling: true,
  // Don't auto-end the gambling session in messageCreate's finally block
  // We'll manage it manually to ensure it ends at the right time
  autoEndGamblingSession: false,
  run: async ({ client, message, args, prefix }) => {
    try {
      // Parse bet amount from args.
      const bet = parseInt(args[0]);
      if (isNaN(bet) || bet <= 0) {
        // End the gambling session early since we're returning
        client.endGamblingSession(message.author.id);
        await message.reply({
          content: "Please provide a valid bet amount greater than 0.",
        });
        return false; // signal to bypass setting cooldown.
      }

      // Fetch the user's profile.
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

      // Rest of your existing roulette code...
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
        .setImage(
          "https://media.discordapp.net/attachments/1343509422496026646/1343509709122179102/roulette.gif"
        )
        .setFooter({
          text: `Current Balance: ${userProfile.balance} Spirit Coins`,
        });

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

      await new Promise((resolve) => {
        const filter = (i) =>
          i.customId === "roulette_select" && i.user.id === message.author.id;
        const collector = initialMessage.createMessageComponentCollector({
          filter,
          componentType: ComponentType.StringSelect,
          time: 30000,
        });

        collector.on("collect", async (interaction) => {
          try {
            let choice = interaction.values[0];
            let betType = "";
            let userNumber = null;

            if (choice === "number") {
              const modal = new ModalBuilder()
                .setCustomId("roulette_modal")
                .setTitle("Enter Your Number Bet");

              const numberInput = new TextInputBuilder()
                .setCustomId("number_input")
                .setLabel("Enter a number between 0 and 36")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

              const actionRow = new ActionRowBuilder().addComponents(
                numberInput
              );
              modal.addComponents(actionRow);

              await interaction.showModal(modal);

              const modalInteraction = await interaction
                .awaitModalSubmit({ time: 30000 })
                .catch(() => null);

              if (!modalInteraction) {
                await interaction.followUp({
                  content: "Modal timed out. Please try again.",
                  ephemeral: true,
                });
                collector.stop("timeout");
                return;
              }
              const inputValue =
                modalInteraction.fields.getTextInputValue("number_input");
              userNumber = parseInt(inputValue);
              if (isNaN(userNumber) || userNumber < 0 || userNumber > 36) {
                await modalInteraction.reply({
                  content: "Invalid number provided. Please try again.",
                  ephemeral: true,
                });
                collector.stop("invalid");
                return;
              }
              betType = `Number ${userNumber}`;
              await modalInteraction.deferUpdate().catch(console.error);
            } else {
              await interaction.deferUpdate().catch(console.error);
              betType = choice.charAt(0).toUpperCase() + choice.slice(1);
            }

            // Animation: simulate the roulette wheel spinning.
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
              await interaction
                .editReply({ embeds: [animEmbed] })
                .catch(console.error);
              await new Promise((res) => setTimeout(res, 500));
            }

            // Final spin result.
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
              newBalance = Math.round(newBalance);
              outcomeDescription = `Congratulations! The wheel landed on **${winningNumber} (${winningColor.toUpperCase()})** and your bet on **${betType}** wins!\nYou earn **${winAmount} Spirit Coins**.`;
            } else {
              newBalance -= bet;
              newBalance = Math.round(newBalance);
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
            await interaction
              .editReply({
                embeds: [resultEmbed],
                components: [disabledRow],
              })
              .catch(console.error);
            collector.stop("finished");
          } catch (err) {
            console.error("Error in roulette interaction:", err);
            collector.stop("error");
          }
        });

        collector.on("end", (collected, reason) => {
          // IMPORTANT: End the gambling session when the collector ends
          client.endGamblingSession(message.author.id);

          if (collected.size === 0 && reason !== "finished") {
            rouletteEmbed.setDescription(
              "You did not choose a bet in time. Please try again."
            );
            initialMessage
              .edit({ embeds: [rouletteEmbed], components: [] })
              .catch(console.error);
          }
          resolve();
        });
      });

      return true; // Signal successful execution.
    } catch (error) {
      console.error("Roulette error:", error);
      // IMPORTANT: End the gambling session if there's an error
      client.endGamblingSession(message.author.id);
      await message.channel.send({
        content:
          "An error occurred while playing roulette. Please try again later.",
      });
      return false;
    }
  },
};
