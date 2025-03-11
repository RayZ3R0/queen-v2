import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import profileSchema from "../../../schema/profile.js";
import cooldownSchema from "../../../schema/cooldown.js";
import cooldown from "../../../schema/cooldown.js";

export default {
  name: "daily",
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Claim your daily Spirit Coins reward"),
  category: "Spirits",
  cooldown: 86400, // 24 hours in seconds
  run: async ({ client, interaction }) => {
    let rewardAmount = 300;
    // Bonus amount if the user has the special role
    if (interaction.member.roles.cache.has("927097726934601729"))
      rewardAmount = 600;

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

      // Reply with the embed and buttons
      await interaction.reply({
        embeds: [dailyEmbed],
        components: [row],
      });

      // Fetch the reply message for creating the collector
      const message = await interaction.fetchReply();

      // Create a collector for button clicks (only for the command user)
      const filter = (i) => i.user.id === interaction.user.id;
      const collector = message.createMessageComponentCollector({
        filter,
        componentType: ComponentType.Button,
        time: 86400 * 1000, // active for 24 hours
      });

      const cooldownMs = 86400 * 1000; // 24 hours in milliseconds

      collector.on("collect", async (i) => {
        await i.deferUpdate();

        // Schedule a reminder after the cooldown period
        setTimeout(async () => {
          if (i.customId === "remind_public") {
            interaction.channel.send({
              content: `<@${interaction.user.id}>, your daily reward is now available! Use </daily:${interaction.commandId}> to claim it.`,
            });
          } else if (i.customId === "remind_dm") {
            try {
              await interaction.user.send({
                content: `Hey there! Your daily reward is ready to be claimed! Use </daily:${interaction.commandId}> in the server to receive your coins.`,
              });
            } catch (dmErr) {
              // Fallback to a public reminder if DM fails
              interaction.channel.send({
                content: `<@${interaction.user.id}>, I couldn't send you a DM so here is your reminder: your daily reward is available! Use </daily:${interaction.commandId}>.`,
              });
            }
          }
        }, cooldownMs);

        const updatedEmbed = EmbedBuilder.from(dailyEmbed).setDescription(
          dailyEmbed.data.description + "\n\n⏰ A reminder has been set!"
        );
        await interaction.editReply({ embeds: [updatedEmbed] });
      });

      collector.on("end", () => {
        // Remove buttons after the collector ends
        interaction
          .editReply({ components: [] })
          .catch((err) => console.error("Could not remove buttons:", err));
      });
    } catch (error) {
      console.error("Error claiming daily reward:", error);
      // Handle if the interaction was already replied to
      const replyMethod =
        interaction.replied || interaction.deferred
          ? interaction.followUp
          : interaction.reply;

      replyMethod.call(interaction, {
        content: "Something went wrong while claiming your daily reward.",
        ephemeral: true,
      });
    }
  },
};
