import profileSchema from "../../../schema/profile.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
} from "discord.js";

export default {
  name: "timely",
  description: "Claim your timely rewards every 3 hours.",
  category: "Spirits",
  usage: "",
  cooldown: 10800, // in seconds (3 hours)
  userPermissions: [],
  botPermissions: [],
  aliases: ["t"],
  run: async ({ client, message, args, prefix }) => {
    let rewardAmount = 50;
    // Bonus amount if the user has the special role
    if (message.member.roles.cache.has("927097726934601729"))
      rewardAmount = 100;

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

      // Create the embed for the reward
      const rewardEmbed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("Timely Reward Claimed!")
        .setDescription(
          `You have received **${rewardAmount} Spirit Coins** as your timely reward. Come back in **3 hours** to claim more!`
        )
        .setFooter({
          text: "You can use the buttons below to be reminded when your reward is ready.",
        });

      // Create two buttons – one for a public reminder and one for a DM reminder.
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
        embeds: [rewardEmbed],
        components: [row],
      });

      // Create a collector for the buttons (only valid for the user who claimed the reward)
      const filter = (i) => i.user.id === message.author.id;
      const collector = sentMessage.createMessageComponentCollector({
        filter,
        componentType: ComponentType.Button,
        time: 10800 * 1000, // collector lifetime equal to the cooldown time
      });

      const cooldownMs = 10800 * 1000; // 3 hours in milliseconds

      collector.on("collect", async (interaction) => {
        await interaction.deferUpdate();
        // Schedule the reminder for when the cooldown is done
        setTimeout(async () => {
          if (interaction.customId === "remind_public") {
            message.channel.send({
              content: `<@${message.author.id}>, your timely reward is now available! Use \`${prefix}timely\` to claim it.`,
            });
          } else if (interaction.customId === "remind_dm") {
            try {
              await message.author.send({
                content: `Hey there! Your timely reward is ready to be claimed! Use \`${prefix}timely\` in the server to receive your coins.`,
              });
            } catch (dmErr) {
              // Fall back to public reminder if DM fails
              message.channel.send({
                content: `<@${message.author.id}>, I couldn't send you a DM so here is your reminder: your timely reward is available! Use \`${prefix}timely\`.`,
              });
            }
          }
        }, cooldownMs);

        // Let the user know that a reminder has been set (ephemeral reply not available in messages, so we simply update the embed)
        const updatedEmbed = EmbedBuilder.from(rewardEmbed).setDescription(
          rewardEmbed.data.description +
            "\n\n:alarm_clock: A reminder has been set!"
        );
        await sentMessage.edit({ embeds: [updatedEmbed] });
      });

      collector.on("end", () => {
        // Remove buttons after collector end
        sentMessage.edit({ components: [] });
      });

      return;
    } catch (error) {
      console.error("Error claiming timely reward:", error);
      return message.channel.send({
        content: "Something went wrong while claiming your timely reward.",
      });
    }
  },
};
