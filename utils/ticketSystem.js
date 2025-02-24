import {
  ButtonBuilder,
  ActionRowBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ButtonStyle,
} from "discord.js";

/**
 * Ticket System Options
 * @typedef {Object} TicketSystemOptions
 * @property {string} [color] - Button color as a string. (Accepted values: "grey", "red", "green", "blurple")
 * @property {string} [emoji] - Emoji (or ID) for the button.
 * @property {boolean} [credit] - Whether to show credit footer.
 * @property {Object} [embed] - Custom embed to use instead of the generated one.
 * @property {string} [embedFoot] - Custom footer text.
 * @property {string} [embedDesc] - Description text for the embed.
 * @property {string} [embedTitle] - Title text for the embed.
 * @property {string} [embedColor] - Hex color for the embed.
 */

/**
 * Sets up a ticket system by sending an embed and button.
 * @param {import("discord.js").Message} message - The original message.
 * @param {import("discord.js").TextChannel} targetChannel - The channel to send the ticket panel.
 * @param {TicketSystemOptions} options - Options for the ticket panel.
 */
async function ticketSystem(message, targetChannel, options = {}) {
  try {
    // Permissions check
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator))
      return message.reply({
        content: "You don't have permissions to set up a ticket system.",
      });

    // In v14, use guild.members.me instead of guild.me.
    if (
      !message.guild.members.me.permissions.has(
        PermissionFlagsBits.ManageChannels
      )
    )
      return message.reply({
        content:
          "I don't have permissions to work with the ticket system. Needed Permission: MANAGE_CHANNELS",
      });

    // Normalize the button style option.
    let normalizedButtonStyle;
    if (options.color) {
      switch (options.color.toLowerCase()) {
        case "grey":
          normalizedButtonStyle = ButtonStyle.Secondary;
          break;
        case "red":
          normalizedButtonStyle = ButtonStyle.Danger;
          break;
        case "green":
          normalizedButtonStyle = ButtonStyle.Success;
          break;
        case "blurple":
          normalizedButtonStyle = ButtonStyle.Primary;
          break;
        default:
          normalizedButtonStyle = ButtonStyle.Secondary;
      }
    } else {
      normalizedButtonStyle = ButtonStyle.Secondary;
    }

    // Create the ticket button.
    const ticketButton = new ButtonBuilder()
      .setStyle(normalizedButtonStyle)
      .setEmoji(options.emoji || "🎫")
      .setLabel("Ticket")
      .setCustomId("create_ticket");

    // Decide on footer text.
    const footerText =
      options.credit === false
        ? options.embedFoot || message.guild.name
        : "©️ Simply Develop. npm i simply-djs";

    // Build an action row with the button.
    const buttonRow = new ActionRowBuilder().addComponents(ticketButton);

    // Build the embed.
    const ticketEmbed =
      options.embed ||
      new EmbedBuilder()
        .setTitle(options.embedTitle || "Create a Ticket")
        .setDescription(
          options.embedDesc || "🎫 Create a ticket by clicking the button 🎫"
        )
        .setThumbnail(message.guild.iconURL())
        .setTimestamp()
        .setColor(options.embedColor || "#075FFF")
        .setFooter({ text: footerText, iconURL: message.guild.iconURL() });

    try {
      // If this is a slash command interaction, use followUp; else, send directly.
      if (message.commandId) {
        await message.followUp("Done. Setting Ticket to that channel");
        await targetChannel.send({
          embeds: [ticketEmbed],
          components: [buttonRow],
        });
      } else {
        await targetChannel.send({
          embeds: [ticketEmbed],
          components: [buttonRow],
        });
      }
    } catch (sendErr) {
      await targetChannel.send({ content: "ERR OCCURRED: " + sendErr });
    }
  } catch (err) {
    console.error(`Error Occurred in ticketSystem | Error: ${err.stack}`);
  }
}

export default ticketSystem;
