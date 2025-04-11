import { SlashCommandBuilder } from "discord.js";
import cooldown from "../../../schema/cooldown.js";
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
  data: new SlashCommandBuilder()
    .setName("timely")
    .setDescription("Claim your hourly Spirit Coins reward"),
  category: "Spirits",
  cooldown: 10800, // 3 hours
  run: async ({ client, interaction }) => {
    let rewardAmount = 50;
    // Bonus amount if the user has the special role
    if (interaction.member.roles.cache.has("927097726934601729"))
      rewardAmount = 100;

    try {
      const userProfile = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      if (userProfile) {
        await profileSchema.findOneAndUpdate(
          { userid: interaction.user.id },
          { balance: userProfile.balance + rewardAmount }
        );
      } else {
        const newProfile = new profileSchema({
          userid: interaction.user.id,
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

      // Initial reply with buttons
      await interaction.reply({
        embeds: [rewardEmbed],
        components: [row],
      });

      // Create a collector for the buttons (only valid for the user who claimed the reward)
      const message = await interaction.fetchReply();
      const filter = (i) => i.user.id === interaction.user.id;
      const collector = message.createMessageComponentCollector({
        filter,
        componentType: ComponentType.Button,
        time: 10800 * 1000, // collector lifetime equal to the cooldown time
      });

      const cooldownMs = 10800 * 1000; // 3 hours in milliseconds

      collector.on("collect", async (i) => {
        await i.deferUpdate();
        // Schedule the reminder for when the cooldown is done
        setTimeout(async () => {
          if (i.customId === "remind_public") {
            interaction.channel.send({
              content: `<@${interaction.user.id}>, your timely reward is now available! Use </timely:${interaction.commandId}> to claim it.`,
            });
          } else if (i.customId === "remind_dm") {
            try {
              await interaction.user.send({
                content: `Hey there! Your timely reward is ready to be claimed! Use </timely:${interaction.commandId}> in the server to receive your coins.`,
              });
            } catch (dmErr) {
              // Fall back to public reminder if DM fails
              interaction.channel.send({
                content: `<@${interaction.user.id}>, I couldn't send you a DM so here is your reminder: your timely reward is available! Use </timely:${interaction.commandId}>.`,
              });
            }
          }
        }, cooldownMs);

        // Let the user know that a reminder has been set
        const updatedEmbed = EmbedBuilder.from(rewardEmbed).setDescription(
          rewardEmbed.data.description +
            "\n\n:alarm_clock: A reminder has been set!"
        );
        await interaction.editReply({ embeds: [updatedEmbed] });
      });

      collector.on("end", () => {
        // Remove buttons after collector end
        interaction
          .editReply({ components: [] })
          .catch((err) => console.error("Could not remove buttons:", err));
      });
    } catch (error) {
      console.error("Error claiming timely reward:", error);
      // Handle if the interaction was already replied to
      const replyMethod =
        interaction.replied || interaction.deferred
          ? interaction.followUp
          : interaction.reply;

      replyMethod.call(interaction, {
        content: "Something went wrong while claiming your timely reward.",
        ephemeral: true,
      });
    }
  },
};
