import {
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import { client } from "../bot.js";

// Configuration
const APPEAL_CHANNEL_ID = "970640479463022613";

/**
 * Handle appeal button interactions
 */
client.on("interactionCreate", async (interaction) => {
  try {
    // Only handle button interactions
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Handle mod appeal (blacklist violations)
    if (customId === "mod_appeal") {
      const modal = new ModalBuilder()
        .setCustomId("mod_appeal_modal")
        .setTitle("Appeal Your Timeout");

      const reasonInput = new TextInputBuilder()
        .setCustomId("appeal_reason")
        .setLabel("Why should your timeout be removed?")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(
          "Explain why you believe the timeout was unjustified or a mistake..."
        )
        .setRequired(true)
        .setMinLength(20)
        .setMaxLength(1000);

      const row = new ActionRowBuilder().addComponents(reasonInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }

    // Handle ban appeal (from moderate command)
    else if (customId === "appeal") {
      const modal = new ModalBuilder()
        .setCustomId("ban_appeal_modal")
        .setTitle("Appeal Your Ban");

      const reasonInput = new TextInputBuilder()
        .setCustomId("appeal_reason")
        .setLabel("Why should you be unbanned?")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder(
          "Explain your reasons and why we should unban you..."
        )
        .setRequired(true)
        .setMinLength(20)
        .setMaxLength(1000);

      const row = new ActionRowBuilder().addComponents(reasonInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
    }
  } catch (error) {
    console.error("Error in appeal button handler:", error);
  }
});

/**
 * Handle modal submissions for appeals
 */
client.on("interactionCreate", async (interaction) => {
  try {
    // Only handle modal submissions
    if (!interaction.isModalSubmit()) return;

    const customId = interaction.customId;

    // Handle mod appeal modal
    if (customId === "mod_appeal_modal") {
      await interaction.deferReply({ ephemeral: true });

      const reason = interaction.fields.getFieldValue("appeal_reason");

      // Find appeal channel
      const appealChannel = interaction.client.channels.cache.get(
        APPEAL_CHANNEL_ID
      );

      if (!appealChannel) {
        await interaction.editReply({
          content: "❌ Appeal channel not found. Please contact a moderator.",
          ephemeral: true,
        });
        return;
      }

      // Create appeal embed
      const appealEmbed = new EmbedBuilder()
        .setColor("Orange")
        .setTitle("⚖️ Timeout Appeal")
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .addFields(
          {
            name: "User",
            value: `${interaction.user} (${interaction.user.id})`,
            inline: true,
          },
          {
            name: "Type",
            value: "Blacklist Violation",
            inline: true,
          },
          {
            name: "Appeal Reason",
            value: reason,
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({
          text: "Use /untimeout to remove the timeout if appeal is approved",
        });

      // Send to appeal channel
      await appealChannel.send({
        embeds: [appealEmbed],
      });

      await interaction.editReply({
        content:
          "✅ Your appeal has been submitted to the moderators. They will review it shortly.",
        ephemeral: true,
      });
    }

    // Handle ban appeal modal
    else if (customId === "ban_appeal_modal") {
      await interaction.deferReply({ ephemeral: true });

      const reason = interaction.fields.getFieldValue("appeal_reason");

      // Find appeal channel
      const appealChannel = interaction.client.channels.cache.get(
        APPEAL_CHANNEL_ID
      );

      if (!appealChannel) {
        await interaction.editReply({
          content: "❌ Appeal channel not found. Please contact a moderator.",
          ephemeral: true,
        });
        return;
      }

      // Create appeal embed
      const appealEmbed = new EmbedBuilder()
        .setColor("Red")
        .setTitle("🔨 Ban Appeal")
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .addFields(
          {
            name: "User",
            value: `${interaction.user} (${interaction.user.id})`,
            inline: true,
          },
          {
            name: "Type",
            value: "Ban",
            inline: true,
          },
          {
            name: "Appeal Reason",
            value: reason,
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({
          text: "Use /unban to remove the ban if appeal is approved",
        });

      // Send to appeal channel
      await appealChannel.send({
        embeds: [appealEmbed],
      });

      await interaction.editReply({
        content:
          "✅ Your appeal has been submitted to the moderators. They will review it shortly.",
        ephemeral: true,
      });
    }
  } catch (error) {
    console.error("Error in appeal modal handler:", error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction
        .reply({
          content: "❌ An error occurred while submitting your appeal.",
          ephemeral: true,
        })
        .catch(console.error);
    }
  }
});

export default (client) => {
  console.log("✅ Appeal handler event loaded");
};
