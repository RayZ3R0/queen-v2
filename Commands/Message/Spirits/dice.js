import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "dice",
  aliases: ["diceduel", "dd"],
  description:
    "Dice Duel is an immersive gambling command where you challenge the bot in a dice rolling duel. You wager your Spirit Coins and both you and the bot roll two dice. Watch a brief animation simulating the dice roll, and then see your final totals. If your total is higher than the bot's, you win double your bet. If it's lower, you lose your bet, and if it's a tie, it's a push and your bet is returned. Bet wisely and may luck be on your side!",
  usage: "<bet>",
  cooldown: 10,
  category: "Spirits",
  userPermissions: [],
  botPermissions: [],
  gambling: true,

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
      const diceEmbed = new EmbedBuilder()
        .setColor("#00aaff")
        .setTitle("Dice Duel")
        .setDescription(
          `You are betting **${bet} Spirit Coins** in Dice Duel!\n\n` +
            "Press the **Roll Dice** button below to roll your dice against the bot.\n\n" +
            "In this game, both you and the bot roll two dice. If your total is greater than the bot's, you win double your bet; if it's lower, you lose your bet; if equal, it's a push and your bet is returned."
        )
        .setFooter({
          text: `Current Balance: ${userProfile.balance} Spirit Coins`,
        });

      const rollButton = new ButtonBuilder()
        .setCustomId("dice_roll")
        .setLabel("Roll Dice")
        .setStyle(ButtonStyle.Primary);
      const row = new ActionRowBuilder().addComponents(rollButton);

      const initialMessage = await message.channel.send({
        embeds: [diceEmbed],
        components: [row],
      });

      // Create a button collector.
      const filter = (i) =>
        i.customId === "dice_roll" && i.user.id === message.author.id;
      const collector = initialMessage.createMessageComponentCollector({
        filter,
        componentType: ComponentType.Button,
        time: 30000,
      });

      collector.on("collect", async (interaction) => {
        await interaction.deferUpdate();

        // Animation: Simulate the dice roll over multiple steps.
        const animationSteps = 8;
        for (let i = 0; i < animationSteps; i++) {
          const userDie1 = Math.floor(Math.random() * 6) + 1;
          const userDie2 = Math.floor(Math.random() * 6) + 1;
          const botDie1 = Math.floor(Math.random() * 6) + 1;
          const botDie2 = Math.floor(Math.random() * 6) + 1;

          const animEmbed = new EmbedBuilder()
            .setColor("#00aaff")
            .setTitle("Dice Duel - Rolling...")
            .setDescription(
              `**You:** ${userDie1} 🎲 ${userDie2}   (Total: ${
                userDie1 + userDie2
              })\n` +
                `**Bot:** ${botDie1} 🎲 ${botDie2}   (Total: ${
                  botDie1 + botDie2
                })`
            )
            .setFooter({ text: "Rolling, please wait..." });

          await interaction.editReply({ embeds: [animEmbed] });
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Final dice roll outcome.
        const userRoll1 = Math.floor(Math.random() * 6) + 1;
        const userRoll2 = Math.floor(Math.random() * 6) + 1;
        const botRoll1 = Math.floor(Math.random() * 6) + 1;
        const botRoll2 = Math.floor(Math.random() * 6) + 1;

        const userTotal = userRoll1 + userRoll2;
        const botTotal = botRoll1 + botRoll2;

        let resultDesc =
          `**You:** ${userRoll1} 🎲 ${userRoll2}   (Total: ${userTotal})\n` +
          `**Bot:** ${botRoll1} 🎲 ${botRoll2}   (Total: ${botTotal})\n\n`;

        let win = false;
        let push = false;

        if (userTotal > botTotal) {
          win = true;
          resultDesc += "Congratulations, you win this duel! 🎉";
        } else if (userTotal < botTotal) {
          resultDesc += "Sorry, you lost this duel. Better luck next time!";
        } else {
          push = true;
          resultDesc += "It's a tie! Your bet is returned.";
        }

        let newBalance = userProfile.balance;
        let winAmount = 0;
        if (win) {
          winAmount = bet * 2;
          newBalance += winAmount - bet;
        } else if (push) {
          // Do nothing; balance remains unchanged.
        } else {
          newBalance -= bet;
        }

        // Update the user's profile.
        await profileSchema.findOneAndUpdate(
          { userid: message.author.id },
          { balance: Math.ceil(newBalance) }
        );

        const resultEmbed = new EmbedBuilder()
          .setTitle("Dice Duel - Result")
          .setColor(win ? "#00ff00" : push ? "#ffff00" : "#ff0000")
          .setDescription(
            resultDesc +
              `\n\n**New Balance:** ${Math.ceil(newBalance)} Spirit Coins`
          )
          .setFooter({ text: "Thanks for playing!" });

        // Disable the button.
        const disabledRow = ActionRowBuilder.from(row).setComponents(
          ButtonBuilder.from(rollButton).setDisabled(true)
        );

        await interaction.editReply({
          embeds: [resultEmbed],
          components: [disabledRow],
        });

        collector.stop();
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          diceEmbed.setDescription(
            "You did not roll in time. Please try again."
          );
          initialMessage.edit({ embeds: [diceEmbed], components: [] });
        }
      });
    } catch (error) {
      console.error("Dice Duel error:", error);
      return message.channel.send(
        "An error occurred while playing Dice Duel. Please try again later."
      );
    }
  },
};
