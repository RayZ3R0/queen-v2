import {
  ButtonBuilder,
  ActionRowBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";
import fs from "fs";

/**
 * Converts a color string to a corresponding Discord ButtonStyle.
 * @param {string} colorStr - Accepts "grey", "red", "green", "blurple"
 * @returns {ButtonStyle}
 */
function convertButtonStyle(colorStr) {
  if (!colorStr) return ButtonStyle.Secondary;
  switch (colorStr.toLowerCase()) {
    case "grey":
      return ButtonStyle.Secondary;
    case "red":
      return ButtonStyle.Danger;
    case "green":
      return ButtonStyle.Success;
    case "blurple":
      return ButtonStyle.Primary;
    default:
      return ButtonStyle.Secondary;
  }
}

/**
 * Processes a button interaction to handle ticket/giveaway actions.
 *
 * @param {import("discord.js").ButtonInteraction} interaction
 * @param {object} options Click button options.
 *
 * --- Options ---
 *
 * credit => Boolean
 * ticketname => String (template with {username}, {id}, {tag})
 *
 * embed => EmbedBuilder (custom embed)
 * logembed => EmbedBuilder (custom log embed)
 * confirmEmb => EmbedBuilder (confirmation embed)
 *
 * logChannel => String (Channel ID)
 *
 * closeColor, openColor, delColor, trColor => ButtonColor as String
 * cooldownMsg => String
 * role => String or String[] (Role ID(s))
 * categoryID => String
 *
 * embedDesc => String
 * embedColor => HexColor (String)
 * embedTitle => String
 *
 * delEmoji, closeEmoji, openEmoji, trEmoji => String (Emoji ID or emoji)
 *
 * timeout => Boolean
 * pingRole => String or String[] (Role ID(s))
 *
 * db => Database instance
 */
export default async function clickBtn(interaction, options = {}) {
  if (!interaction.isButton()) return;
  try {
    // Determine footer text.
    let footerText;
    if (options.credit === false) {
      footerText = options.embedFoot || interaction.message.guild.name;
    } else {
      footerText = "©️ Simply Develop. npm i simply-djs";
    }

    // ----- ROLE BUTTON HANDLING -----
    if (interaction.customId.startsWith("role-")) {
      await interaction.deferUpdate({ ephemeral: true });
      const roleId = interaction.customId.replace("role-", "");
      const targetRole = interaction.guild.roles.cache.get(roleId);
      if (!targetRole) return;
      if (interaction.member.roles.cache.has(targetRole.id)) {
        await interaction.followUp({
          content: "You already have the role. Removing it now.",
          ephemeral: true,
        });
        interaction.member.roles.remove(targetRole).catch((err) => {
          interaction.channel.send(
            "ERROR: Role is higher than me. MISSING_PERMISSIONS"
          );
        });
      } else {
        await interaction.followUp({
          content: `Gave you the role ${targetRole} | ID: ${targetRole.id}`,
          ephemeral: true,
        });
        interaction.member.roles.add(targetRole).catch((err) => {
          interaction.channel.send(
            "ERROR: Role is higher than me. MISSING_PERMISSIONS"
          );
        });
      }
      return; // End processing for role button.
    }

    // ----- CREATE TICKET -----
    if (interaction.customId === "create_ticket") {
      // Check for existing ticket first
      const topicText = `Ticket opened by <@${interaction.user.id}>`;
      const existingTicket = interaction.guild.channels.cache.find(
        (ch) => ch.type === ChannelType.GuildText && ch.topic === topicText
      );

      if (existingTicket) {
        await interaction.reply({
          content:
            options.cooldownMsg ||
            "You already have a ticket open. Please delete it before opening another ticket.",
          ephemeral: true,
        });
        return;
      }

      // Show confirmation dialog
      const confirmEmbed = new EmbedBuilder()
        .setTitle("Create Support Ticket")
        .setDescription("Are you sure you want to open a ticket?")
        .setColor("#075FFF")
        .setTimestamp();

      const confirmButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("confirm_ticket_yes")
          .setLabel("Yes")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("confirm_ticket_no")
          .setLabel("No")
          .setStyle(ButtonStyle.Secondary)
      );

      const confirmMsg = await interaction.reply({
        embeds: [confirmEmbed],
        components: [confirmButtons],
        ephemeral: true,
        fetchReply: true,
      });

      // Create collector for confirmation buttons with 1 minute timeout
      const confirmCollector = confirmMsg.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === interaction.user.id &&
          (i.customId === "confirm_ticket_yes" ||
            i.customId === "confirm_ticket_no"),
        time: 60000, // 1 minute
        max: 1, // Only collect one response
      });

      confirmCollector.on("collect", async (buttonInt) => {
        if (buttonInt.customId === "confirm_ticket_yes") {
          // Update confirmation message
          await buttonInt.update({
            content: "✅ Creating your ticket...",
            embeds: [],
            components: [],
          });

          // Proceed with ticket creation
          let ticketName = `ticket_${interaction.user.id}`;
          if (options.ticketname) {
            ticketName = options.ticketname
              .replace("{username}", interaction.user.username)
              .replace("{id}", interaction.user.id)
              .replace("{tag}", interaction.user.tag);
          }

          // Normalize color options for transcript, close, open, and delete buttons.
          const transcriptStyle = convertButtonStyle(options.trColor);
          const closeStyle = convertButtonStyle(options.closeColor);
          const openStyle = convertButtonStyle(options.openColor);
          const deleteStyle = convertButtonStyle(options.delColor);

          const parentId = options.categoryID || null;
          let parentCategory = null;
          if (parentId) {
            const categoryChannel =
              interaction.guild.channels.cache.get(parentId);
            if (
              categoryChannel &&
              categoryChannel.type === ChannelType.GuildCategory
            ) {
              parentCategory = categoryChannel;
            }
          }

          // Create the ticket channel
          const ticketChannel = await interaction.guild.channels.create({
            name: ticketName,
            type: ChannelType.GuildText,
            topic: topicText,
            parent: parentCategory,
            permissionOverwrites: [
              {
                id: interaction.guild.roles.everyone.id,
                deny: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                ],
              },
              {
                id: interaction.user.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory,
                ],
              },
            ],
          });

          // Handle role assignments and pingRoles.
          let roleIds = [];
          if (options.role) {
            if (Array.isArray(options.role)) {
              roleIds.push(...options.role);
            } else {
              roleIds.push(options.role);
            }
          }
          if (options.pingRole) {
            if (Array.isArray(options.pingRole)) {
              roleIds.push(...options.pingRole);
            } else {
              roleIds.push(options.pingRole);
            }
          }

          for (const rId of roleIds) {
            ticketChannel.permissionOverwrites
              .create(rId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true,
              })
              .catch((er) => {
                console.error(
                  `Error setting permission for role ${rId}: ${er.stack}`
                );
                ticketChannel.send({
                  content: `Error: \n\`\`\`${er.stack}\`\`\``,
                });
              });
          }

          const timeoutText =
            options.timeout === false
              ? ""
              : "\nThis channel will be deleted after 10 minutes to reduce clutter";
          const ticketEmbed =
            options.embed ||
            new EmbedBuilder()
              .setTitle("Ticket Created")
              .setDescription(
                options.embedDesc ||
                  `Ticket has been raised by ${interaction.user}.\n**User ID:** \`${interaction.user.id}\` | **User Tag:** \`${interaction.user.tag}\`${timeoutText}`
              )
              .setThumbnail(interaction.guild.iconURL())
              .setTimestamp()
              .setColor(options.embedColor || "#075FFF")
              .setFooter({
                text: footerText,
                iconURL: interaction.guild.iconURL(),
              });

          // Create a close button.
          const closeButton = new ButtonBuilder()
            .setStyle(closeStyle || ButtonStyle.Primary)
            .setEmoji(options.closeEmoji || "🔒")
            .setLabel("Close")
            .setCustomId("close_ticket");
          const closeRow = new ActionRowBuilder().addComponents(closeButton);

          // Send the ticket panel in the newly created channel and pin it.
          ticketChannel
            .send({
              content: `${interaction.user} ${
                roleIds.length ? roleIds.map((r) => `<@&${r}>`).join(" ") : ""
              }`,
              embeds: [ticketEmbed],
              components: [closeRow],
            })
            .then(async (msg) => {
              await msg.pin();
            });
        } else if (buttonInt.customId === "confirm_ticket_no") {
          // User clicked No
          await buttonInt.update({
            content: "❌ Ticket creation cancelled",
            embeds: [],
            components: [],
          });
        }
      });

      confirmCollector.on("end", async (collected, reason) => {
        if (reason === "time" && collected.size === 0) {
          // Timeout - update the ephemeral message
          await interaction
            .editReply({
              content: "❌ Ticket creation timed out - please try again",
              embeds: [],
              components: [],
            })
            .catch(() => {}); // Ignore errors if message was already handled
        }
      });

      return; // End create_ticket processing here
    } // End create_ticket branch

    // ----- TRANSCRIPT TICKET -----
    if (interaction.customId === "tr_ticket") {
      await interaction.deferUpdate();
      let messagesCollection = await interaction.channel.messages.fetch({
        limit: 100,
      });
      messagesCollection = messagesCollection.sort(
        (a, b) => a.createdTimestamp - b.createdTimestamp
      );
      const transcriptLines = [];
      messagesCollection.forEach((m) => {
        if (m.author.bot) return;
        const attachment = m.attachments.first();
        const url = attachment ? attachment.url : null;
        if (url !== null) m.content = url;
        transcriptLines.push(`| ${m.author.tag} | => ${m.content}`);
      });
      const processingEmbed = new EmbedBuilder().setColor("#075FFF").setAuthor({
        name: "Transcripting...",
        iconURL: "https://cdn.discordapp.com/emojis/757632044632375386.gif?v=1",
      });
      const responseMsg = await interaction.followUp({
        embeds: [processingEmbed],
      });
      const transcriptBuffer = Buffer.from(
        transcriptLines.join("\n").replace(/,/g, "\n"),
        "utf-8"
      );
      const transcriptAttachment = new AttachmentBuilder(transcriptBuffer, {
        name: `${interaction.channel.topic}.txt`,
      });
      setTimeout(async () => {
        await responseMsg.edit({ embeds: [], files: [transcriptAttachment] });
      }, 3000);
    }

    // ----- CLOSE TICKET -----
    if (interaction.customId === "close_ticket") {
      await interaction.deferUpdate();
      // Deny sending messages for the ticket opener.
      await interaction.channel.permissionOverwrites
        .edit(interaction.user.id, {
          SendMessages: false,
          ViewChannel: true,
        })
        .catch(() => {});

      // Define the necessary style variables here:
      const transcriptStyle = convertButtonStyle(options.trColor);
      const closeStyle = convertButtonStyle(options.closeColor);
      const openStyle = convertButtonStyle(options.openStyle);
      const deleteStyle = convertButtonStyle(options.delColor);

      // Build Delete, Reopen, and Transcript buttons.
      const deleteButton = new ButtonBuilder()
        .setStyle(deleteStyle || ButtonStyle.Secondary)
        .setEmoji(options.delEmoji || "❌")
        .setLabel("Delete")
        .setCustomId("delete_ticket");
      const reopenButton = new ButtonBuilder()
        .setStyle(openStyle || ButtonStyle.Success)
        .setEmoji(options.openEmoji || "🔓")
        .setLabel("Reopen")
        .setCustomId("open_ticket");
      const transcriptButton = new ButtonBuilder()
        .setStyle(transcriptStyle || ButtonStyle.Primary)
        .setEmoji(options.trEmoji || "📜")
        .setLabel("Transcript")
        .setCustomId("tr_ticket");
      const controlRow = new ActionRowBuilder().addComponents(
        reopenButton,
        deleteButton,
        transcriptButton
      );
      await interaction.message.edit({
        content: `${interaction.user}`,
        components: [controlRow],
      });
    }
    // ----- OPEN TICKET -----
    if (interaction.customId === "open_ticket") {
      await interaction.deferUpdate();
      await interaction.channel.permissionOverwrites
        .edit(interaction.user.id, {
          SendMessages: true,
          ViewChannel: true,
        })
        .catch(() => {});
      // Define the closeStyle variable locally.
      const closeStyle = convertButtonStyle(options.closeColor);
      const closeBtn = new ButtonBuilder()
        .setStyle(closeStyle || ButtonStyle.Primary)
        .setEmoji(options.closeEmoji || "🔒")
        .setLabel("Close")
        .setCustomId("close_ticket");
      const closeRow = new ActionRowBuilder().addComponents(closeBtn);
      await interaction.message.edit({
        content: `${interaction.user}`,
        components: [closeRow],
      });
      await interaction.followUp({
        content: "Reopened the ticket ;)",
        ephemeral: true,
      });
    }

    // ----- DELETE TICKET -----
    if (interaction.customId === "delete_ticket") {
      await interaction.deferUpdate();
      const sureButton = new ButtonBuilder()
        .setStyle(ButtonStyle.Danger)
        .setLabel("Sure")
        .setCustomId("s_ticket");
      const cancelButton = new ButtonBuilder()
        .setStyle(ButtonStyle.Success)
        .setLabel("Cancel")
        .setCustomId("no_ticket");
      const confirmRow = new ActionRowBuilder().addComponents(
        sureButton,
        cancelButton
      );
      const confirmEmbed =
        options.confirmEmb ||
        new EmbedBuilder()
          .setTitle("Are you sure?")
          .setDescription(
            "This will delete the channel and the ticket. You cannot undo this action."
          )
          .setTimestamp()
          .setColor("#c90000")
          .setFooter({
            text: footerText,
            iconURL: interaction.guild.iconURL(),
          });
      await interaction.followUp({
        embeds: [confirmEmbed],
        components: [confirmRow],
      });
    }

    // ----- CONFIRM DELETE TICKET (s_ticket) -----
    if (interaction.customId === "s_ticket") {
      // Cache channel data before deletion
      const channelName = interaction.channel?.name || "unknown";
      const channelTopic = interaction.channel?.topic || channelName;
      const channelId = interaction.channel?.id || "unknown";

      await interaction.reply({
        content: "Deleting the ticket and channel.. Please wait.",
        ephemeral: true,
      });
      const logChannel = interaction.guild.channels.cache.get(
        options.logChannel
      );
      if (logChannel) {
        let msgColl = await interaction.channel.messages.fetch({ limit: 100 });
        msgColl = msgColl.sort(
          (a, b) => a.createdTimestamp - b.createdTimestamp
        );
        const transcriptData = [];
        msgColl.forEach((m) => {
          if (m.author.bot) return;
          const attachment = m.attachments.first();
          const url = attachment ? attachment.url : null;
          if (url !== null) m.content = url;
          transcriptData.push(
            `| ${m.author.tag} | => ${m.content || "No Content"}`
          );
        });
        const attach = new AttachmentBuilder(
          Buffer.from(transcriptData.join("\n").replace(/,/g, "\n"), "utf-8"),
          { name: `${channelTopic}.txt` }
        );
        const deletionEmbed = new EmbedBuilder()
          .setTitle("Ticket Deleted!")
          .setDescription(
            `Ticket deleted by <@${interaction.user.id}> (Tag: **${interaction.user.tag}**)\n` +
              `Ticket Name: \`${channelName}\` | Ticket ID: \`${channelId}\`\n${channelTopic}`
          )
          .setTimestamp()
          .setColor("#cc0000")
          .setFooter({
            text: footerText,
            iconURL: interaction.guild.iconURL(),
          });
        if (options.logembed) {
          options.logembed.description = options.logembed.description
            .replaceAll("{username}", interaction.user.username)
            .replaceAll("{id}", interaction.user.id)
            .replaceAll("{tag}", interaction.user.tag)
            .replaceAll("{chname}", channelName)
            .replaceAll("{chtopic}", channelTopic)
            .replaceAll("{chid}", channelId);
        }
        setTimeout(async () => {
          await logChannel
            .send({
              embeds: [options.logembed || deletionEmbed],
              components: [],
            })
            .then((c) => {
              c.channel.send({
                content: `***Transcript:*** \`#${channelName}\``,
                files: [attach],
              });
            });
        }, 3000);
      }
      setTimeout(async () => {
        // Use cached channelId to retrieve the channel
        const delChannel = interaction.guild.channels.cache.get(channelId);
        if (delChannel && !delChannel.deleted) {
          delChannel.delete().catch((err) => {
            // In case interaction.channel is now null, log to console
            console.error("Error deleting channel:", err);
          });
        }
      }, 2000);
    }

    // ----- CANCEL DELETE TICKET (no_ticket) -----
    if (interaction.customId === "no_ticket") {
      await interaction.deferUpdate({ ephemeral: true });
      await interaction.followUp({
        content: "Ticket Deletion canceled",
        ephemeral: true,
      });
      await interaction.message.delete();
    }
  } catch (err) {
    console.error(`Error Occurred in clickBtn: ${err.stack}`);
  }
}
