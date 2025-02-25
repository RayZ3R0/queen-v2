import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "slot",
  aliases: ["slots"],
  description:
    "Play a slot machine game and bet your Spirit Coins! You can also set a difficulty mode: easy, normal, or hard.",
  usage: "<bet> [easy|normal|hard]",
  cooldown: 10,
  category: "Spirits",
  userPermissions: [],
  botPermissions: [],
  gambling: true,
  autoEndGamblingSession: false, // Add this to manage sessions manually
  run: async ({ client, message, args, prefix }) => {
    try {
      // Parse bet
      const bet = parseInt(args[0]);
      if (isNaN(bet) || bet <= 0) {
        // End gambling session on early return
        client.endGamblingSession(message.author.id);
        message.reply({
          content: "Please provide a valid bet amount greater than 0.",
        });
        return false;
      }

      // Get difficulty mode (default is normal)
      const modeArg = args[1] ? args[1].toLowerCase() : "normal";
      if (!["easy", "normal", "hard"].includes(modeArg)) {
        // End gambling session on early return
        client.endGamblingSession(message.author.id);
        message.reply({
          content:
            "Invalid mode provided. Please choose: easy, normal, or hard.",
        });
        return false;
      }

      // Fetch user profile & validate balance
      const userProfile = await profileSchema.findOne({
        userid: message.author.id,
      });
      if (!userProfile) {
        // End gambling session on early return
        client.endGamblingSession(message.author.id);
        message.reply({
          content:
            "You do not have a profile yet. Please use the `start` command first.",
        });
        return false;
      }
      if (userProfile.balance < bet) {
        // End gambling session on early return
        client.endGamblingSession(message.author.id);
        return message.reply({
          content: `You do not have enough Spirit Coins. Your balance is \`${userProfile.balance}\`.`,
        });
      }

      // Slot machine symbols
      const symbols = ["🍒", "🍋", "🔔", "⭐", "7️⃣", "🍀"];
      const roll = () => symbols[Math.floor(Math.random() * symbols.length)];

      // Create the initial embed with a Spin button.
      const initialEmbed = new EmbedBuilder()
        .setColor("#00aaff")
        .setTitle("Slot Machine")
        .setDescription(
          `Place your bet of **${bet} Spirit Coins** in **${modeArg}** mode and try your luck!\n\n` +
            "Press the **Spin** button below when you're ready."
        )
        .setFooter({
          text: `Current Balance: ${userProfile.balance} Spirit Coins`,
        });

      const spinButton = new ButtonBuilder()
        .setCustomId("slot_spin")
        .setLabel("Spin")
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(spinButton);

      const initialMessage = await message.channel.send({
        embeds: [initialEmbed],
        components: [row],
      });

      // Create a collector for the button
      const filter = (i) =>
        i.customId === "slot_spin" && i.user.id === message.author.id;
      const collector = initialMessage.createMessageComponentCollector({
        filter,
        componentType: ComponentType.Button,
        time: 30000,
      });

      collector.on("collect", async (interaction) => {
        try {
          await interaction.deferUpdate();

          // Animation: update the embed several times to simulate spinning reels.
          const animationSteps = 8;
          for (let i = 0; i < animationSteps; i++) {
            const animEmbed = new EmbedBuilder()
              .setColor("#00aaff")
              .setTitle("Slot Machine - Spinning...")
              .setDescription(
                `**Reels:** ${roll()} | ${roll()} | ${roll()}\n` + "Good luck!"
              )
              .setFooter({
                text: `Bet: ${bet} Spirit Coins | Current Balance: ${userProfile.balance} Spirit Coins`,
              });
            await interaction.editReply({ embeds: [animEmbed] });
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          // Final spin result
          const reel1 = roll();
          const reel2 = roll();
          const reel3 = roll();

          let outcome = "";
          let multiplier = 0;
          // Evaluate outcome based on difficulty mode:
          switch (modeArg) {
            case "easy":
              if (reel1 === reel2 && reel2 === reel3) {
                if (reel1 === "7️⃣") {
                  multiplier = 3;
                  outcome = "Triple 7's in Easy mode! Small jackpot!";
                } else {
                  multiplier = 2;
                  outcome = "Triple match in Easy mode! Nice win!";
                }
              } else if (
                reel1 === reel2 ||
                reel2 === reel3 ||
                reel1 === reel3
              ) {
                multiplier = 1.2;
                outcome = "Double match in Easy mode! You win a little.";
              } else {
                // Refund 20% of the bet if no match
                multiplier = -0.2;
                outcome = "No match! But you get a 20% refund in Easy mode.";
              }
              break;
            case "normal":
              if (reel1 === reel2 && reel2 === reel3) {
                if (reel1 === "7️⃣") {
                  multiplier = 5;
                  outcome = "Triple 7's! Jackpot!";
                } else {
                  multiplier = 3;
                  outcome = "Triple match! Great win!";
                }
              } else if (
                reel1 === reel2 ||
                reel2 === reel3 ||
                reel1 === reel3
              ) {
                multiplier = 1.5;
                outcome = "Double match! You win a little.";
              } else {
                multiplier = 0;
                outcome = "No matching symbols. Better luck next time!";
              }
              break;
            case "hard":
              if (reel1 === reel2 && reel2 === reel3) {
                if (reel1 === "7️⃣") {
                  multiplier = 15;
                  outcome = "Triple 7's in Hard mode! Massive jackpot!";
                } else {
                  multiplier = 10;
                  outcome = "Triple match in Hard mode! Huge win!";
                }
              } else if (
                reel1 === reel2 ||
                reel2 === reel3 ||
                reel1 === reel3
              ) {
                multiplier = 0;
                outcome =
                  "Double match in Hard mode yields no reward. Tough luck!";
              } else {
                multiplier = 0;
                outcome = "No match! You lost your bet in Hard mode.";
              }
              break;
          }

          let winAmount = 0;
          let newBalance = userProfile.balance;
          if (multiplier > 0) {
            winAmount = Math.ceil(bet * multiplier);
            newBalance += winAmount;
          } else if (multiplier < 0) {
            // Negative multiplier implies a partial refund loss
            const refund = Math.floor(bet * Math.abs(multiplier));
            newBalance = newBalance - bet + refund;
            winAmount = refund;
          } else {
            newBalance -= bet;
          }

          // Update the profile balance
          await profileSchema.findOneAndUpdate(
            { userid: message.author.id },
            { balance: Math.ceil(newBalance) }
          );

          const resultEmbed = new EmbedBuilder()
            .setColor(multiplier > 0 ? "#00ff00" : "#ff0000")
            .setTitle("Slot Machine Result")
            .setDescription(
              `**Reels:** ${reel1} | ${reel2} | ${reel3}\n` +
                `${outcome}\n\n` +
                (multiplier > 0
                  ? `You've won **${winAmount} Spirit Coins**!`
                  : multiplier < 0
                  ? `You lost **${
                      bet - winAmount
                    } Spirit Coins** (with a partial refund of ${winAmount}).`
                  : `You've lost **${bet} Spirit Coins**.`) +
                `\n\n**New Balance:** ${Math.ceil(newBalance)} Spirit Coins`
            )
            .setFooter({ text: "Thanks for playing!" });

          // Disable button after spin
          const disabledRow = ActionRowBuilder.from(row).setComponents(
            ButtonBuilder.from(spinButton).setDisabled(true)
          );
          await interaction.editReply({
            embeds: [resultEmbed],
            components: [disabledRow],
          });

          // End gambling session after successful game completion
          client.endGamblingSession(message.author.id);

          collector.stop();
        } catch (err) {
          console.error("Error during slot spin:", err);
          // End gambling session if there's an error during gameplay
          client.endGamblingSession(message.author.id);
          await message.channel.send(
            "An error occurred during gameplay. Your bet has been returned."
          );
        }
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          // End gambling session if the user doesn't spin in time
          client.endGamblingSession(message.author.id);

          initialEmbed.setDescription(
            "You did not spin in time. Please try again."
          );
          initialMessage.edit({ embeds: [initialEmbed], components: [] });
        }
      });

      return true; // Signal successful execution
    } catch (error) {
      console.error("Slot machine error:", error);
      // End gambling session on error
      client.endGamblingSession(message.author.id);

      await message.channel.send({
        content:
          "An error occurred while playing the slot machine. Please try again later.",
      });

      return false; // Signal error execution
    }
  },
};
