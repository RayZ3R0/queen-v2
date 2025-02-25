import profileSchema from "../../../schema/profile.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
} from "discord.js";

export default {
  name: "daily",
  description: "Claim your daily rewards every 24 hours.",
  category: "Spirits",
  usage: "",
  cooldown: 86400,
  userPermissions: [],
  botPermissions: [],
  run: async ({ client, message, args, prefix }) => {
    let rewardAmount = 300;
    // Bonus amount if the user has the special role
    if (message.member.roles.cache.has("927097726934601729"))
      rewardAmount = 600;

    try {
      const userProfile = await profileSchema.findOne({
        userid: message.author.id,
      });

      if (userProfile) {
        await profileSchema.findOneAndUpdate(
          { userid: message.author.id },
          { balance: userProfile.balance + rewardAmount }
        );
      } else {
        const newProfile = new profileSchema({
          userid: message.author.id,
          selected: "None",
          image: "https://c.tenor.com/E6P9PZdh7W0AAAAC/date-a-live-kurumi.gif",
          color: "#ff0000",
          bio: "None",
          level: 0,
          xp: 0,
          energy: 60,
          balance: rewardAmount,
          items: [],
          started: false,
        });
        await newProfile.save();
      }

      // Create a prettified embed with buttons
      const dailyEmbed = new EmbedBuilder()
        .setColor("#00AAFF")
        .setTitle("Daily Reward Claimed!")
        .setDescription(
          `You have received **${rewardAmount} Spirit Coins** as your daily reward.\n\nCome back after 24 hours to claim more!`
        )
        .setFooter({
          text: "Use the buttons below to be reminded when your next reward is ready.",
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("remind_public")
          .setLabel("Remind Me")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("remind_dm")
          .setLabel("Remind Me (DM)")
          .setStyle(ButtonStyle.Secondary)
      );

      const sentMessage = await message.channel.send({
        embeds: [dailyEmbed],
        components: [row],
      });

      // Create a collector for button clicks (only for the command user)
      const filter = (i) => i.user.id === message.author.id;
      const collector = sentMessage.createMessageComponentCollector({
        filter,
        componentType: ComponentType.Button,
        time: 86400 * 1000, // active for 24 hours
      });

      const cooldownMs = 86400 * 1000; // 24 hours in milliseconds

      collector.on("collect", async (interaction) => {
        await interaction.deferUpdate();

        // Schedule a reminder after the cooldown period
        setTimeout(async () => {
          if (interaction.customId === "remind_public") {
            message.channel.send({
              content: `<@${message.author.id}>, your daily reward is now available! Use \`${prefix}daily\` to claim it.`,
            });
          } else if (interaction.customId === "remind_dm") {
            try {
              await message.author.send({
                content: `Hey there! Your daily reward is ready to be claimed! Use \`${prefix}daily\` in the server to receive your coins.`,
              });
            } catch (dmErr) {
              // Fallback to a public reminder if DM fails
              message.channel.send({
                content: `<@${message.author.id}>, I couldn't send you a DM so here is your reminder: your daily reward is available! Use \`${prefix}daily\`.`,
              });
            }
          }
        }, cooldownMs);

        const updatedEmbed = EmbedBuilder.from(dailyEmbed).setDescription(
          dailyEmbed.data.description + "\n\n⏰ A reminder has been set!"
        );
        await sentMessage.edit({ embeds: [updatedEmbed] });
      });

      collector.on("end", () => {
        // Remove buttons after the collector ends
        sentMessage.edit({ components: [] });
      });

      return;
    } catch (error) {
      console.error("Error claiming daily reward:", error);
      return message.channel.send({
        content: "Something went wrong while claiming your daily reward.",
      });
    }
  },
};
