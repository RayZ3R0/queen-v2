import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "crash",
  aliases: ["crashgame"],
  description:
    "Crash is an immersive multiplier game where your bet multiplies over time. " +
    "The multiplier starts at 1.0 and steadily increases. You must press 'Cash Out' before " +
    "the game randomly crashes! If you cash out in time, your bet is multiplied by the current multiplier; " +
    "if not, you lose your bet. Risk vs reward is key – the higher you go, the bigger the payout, but with greater risk.",
  usage: "<bet>",
  cooldown: 30,
  category: "Spirits",
  userPermissions: [],
  botPermissions: [],

  run: async ({ client, message, args, prefix }) => {
    try {
      // Parse bet amount from args.
      const bet = parseFloat(args[0]);
      if (isNaN(bet) || bet <= 0) {
        return message.reply({
          content: "Please provide a valid bet amount greater than 0.",
        });
      }

      // Fetch the user's profile.
      const userProfile = await profileSchema.findOne({
        userid: message.author.id,
      });
      if (!userProfile) {
        return message.reply({
          content:
            "You do not have a profile yet. Please use the `start` command first.",
        });
      }
      if (userProfile.balance < bet) {
        return message.reply({
          content: `You do not have enough Spirit Coins. Your balance is \`${userProfile.balance}\`.`,
        });
      }

      // Determine the crash multiplier.
      // For example, choose a random crash value between 1.5 and 5.0.
      const crashValue = (Math.random() * 3.5 + 1.5).toFixed(2); // e.g. "3.25"
      const crashThreshold = parseFloat(crashValue);

      // Build the initial embed.
      const crashEmbed = new EmbedBuilder()
        .setColor("#ff5500")
        .setTitle("Crash Game")
        .setDescription(
          `You are betting **${bet} Spirit Coins**.\n\n` +
            "Watch the multiplier increase—starting from 1.0! When you feel lucky, press the **Cash Out** button to secure your winnings. " +
            `But be careful: the game will crash at a random multiplier (in this round, it will crash at **${crashThreshold.toFixed(
              2
            )}**).\n\n` +
            "If you cash out in time, your bet is multiplied by the current multiplier. If not, you lose your bet!"
        )
        .setFooter({
          text: `Current Balance: ${userProfile.balance} Spirit Coins`,
        });

      const cashOutButton = new ButtonBuilder()
        .setCustomId("crash_cashout")
        .setLabel("Cash Out")
        .setStyle(ButtonStyle.Success);
      const row = new ActionRowBuilder().addComponents(cashOutButton);

      const initialMessage = await message.channel.send({
        embeds: [crashEmbed],
        components: [row],
      });

      // Create button collector.
      const filter = (i) =>
        i.customId === "crash_cashout" && i.user.id === message.author.id;
      const collector = initialMessage.createMessageComponentCollector({
        filter,
        componentType: ComponentType.Button,
        time: 30000,
      });

      // Set initial multiplier.
      let currentMultiplier = 1.0;
      let cashedOut = false;

      // Start animation loop.
      // Increase the multiplier incrementally every 500ms.
      const animationDelay = 500;
      const increment = 0.15; // Adjust rate of increase as desired.

      // Create a function to update the multiplier.
      const updateMultiplier = async () => {
        if (cashedOut) return;
        currentMultiplier = parseFloat(
          (currentMultiplier + increment).toFixed(2)
        );

        // If current multiplier reaches or exceeds crash, stop the loop.
        if (currentMultiplier >= crashThreshold) {
          // Game crashes before cash-out.
          const crashEmbedFinal = new EmbedBuilder()
            .setColor("#ff0000")
            .setTitle("Crash Game - Crashed!")
            .setDescription(
              `Oh no! The multiplier reached **${currentMultiplier.toFixed(
                2
              )}** and the game crashed!\n` +
                `You lost **${bet} Spirit Coins**.`
            )
            .setFooter({ text: "Better luck next time!" });

          await initialMessage.edit({
            embeds: [crashEmbedFinal],
            components: [],
          });

          // Deduct the bet from balance.
          const newBalance = userProfile.balance - bet;
          await profileSchema.findOneAndUpdate(
            { userid: message.author.id },
            { balance: newBalance }
          );

          collector.stop();
          return;
        }

        // Update embed with current multiplier.
        const animEmbed = new EmbedBuilder()
          .setColor("#ff9900")
          .setTitle("Crash Game - In Progress")
          .setDescription(
            `Current Multiplier: **${currentMultiplier.toFixed(
              2
            )}x**\n\nPress **Cash Out** to secure your winnings!`
          )
          .setFooter({
            text: `Game will crash at approximately ${crashThreshold.toFixed(
              2
            )}x`,
          });

        await initialMessage.edit({
          embeds: [animEmbed],
        });

        // Continue loop.
        setTimeout(updateMultiplier, animationDelay);
      };

      // Start the animation loop.
      updateMultiplier();

      collector.on("collect", async (interaction) => {
        // User cashed out before crash.
        cashedOut = true;
        await interaction.deferUpdate();

        // Calculate win amount.
        const winAmount = parseFloat((bet * currentMultiplier).toFixed(2));
        const newBalance = userProfile.balance - bet + winAmount;

        // Update user profile.
        await profileSchema.findOneAndUpdate(
          { userid: message.author.id },
          { balance: newBalance }
        );

        const winEmbed = new EmbedBuilder()
          .setColor("#00ff00")
          .setTitle("Crash Game - You Cashed Out!")
          .setDescription(
            `You cashed out at **${currentMultiplier.toFixed(2)}x**!\n` +
              `Your bet of **${bet} Spirit Coins** has been multiplied to **${winAmount} Spirit Coins**.`
          )
          .setFooter({ text: `New Balance: ${newBalance} Spirit Coins` });

        // Disable the button.
        const disabledRow = ActionRowBuilder.from(row).setComponents(
          ButtonBuilder.from(cashOutButton).setDisabled(true)
        );
        await interaction.editReply({
          embeds: [winEmbed],
          components: [disabledRow],
        });

        collector.stop();
      });

      collector.on("end", async (collected) => {
        // If no cash out was made (should normally be handled in updateMultiplier)
        if (!cashedOut && collected.size === 0) {
          // Do nothing if already crashed.
        }
      });
    } catch (error) {
      console.error("Crash Game error:", error);
      return message.channel.send({
        content:
          "An error occurred while playing Crash. Please try again later.",
      });
    }
  },
};
