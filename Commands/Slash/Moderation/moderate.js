import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
} from "discord.js";
import { checkRoleHierarchy } from "../../../utils/permissionHandler.js";

export default {
  data: new SlashCommandBuilder()
    .setName("moderate")
    .setDescription("Moderate a user (kick/ban)")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to moderate")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for the moderation")
        .setRequired(false)
    ),
  category: "Moderation",
  botPermissions: [
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers,
  ],

  run: async ({ client, interaction }) => {
    await interaction.deferReply();

    try {
      const targetUser = interaction.options.getUser("user");
      const reason =
        interaction.options.getString("reason") || "No reason provided";
      const targetMember = await interaction.guild.members
        .fetch(targetUser.id)
        .catch(() => null);

      if (!targetMember) {
        throw {
          name: "ValidationError",
          message: "Could not find that user in this server.",
        };
      }

      // Check role hierarchy
      checkRoleHierarchy(interaction.member, targetMember, interaction);

      // Create embeds for DM messages
      const kickEmbed = new EmbedBuilder()
        .setColor("Red")
        .setDescription(
          `You have been kicked from **${interaction.guild.name}**\n**Reason:** ${reason}`
        );

      const banEmbed = new EmbedBuilder()
        .setColor("Red")
        .setDescription(
          `You have been banned from **${interaction.guild.name}**\n**Reason:** ${reason}`
        );

      // Create buttons
      const kickButton = new ButtonBuilder()
        .setCustomId("kick")
        .setLabel("Kick")
        .setStyle(ButtonStyle.Danger);

      const banButton = new ButtonBuilder()
        .setCustomId("ban")
        .setLabel("Ban")
        .setStyle(ButtonStyle.Danger);

      const actionRow = new ActionRowBuilder().addComponents(
        kickButton,
        banButton
      );

      // Send initial message with buttons
      const reply = await interaction.editReply({
        content: `Select an action to moderate ${targetUser.tag}`,
        components: [actionRow],
      });

      // Create collector for button interactions
      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30000,
      });

      collector.on("collect", async (i) => {
        // Ensure only command invoker can use buttons
        if (i.user.id !== interaction.user.id) {
          await i.reply({
            content: "This button is not for you.",
            ephemeral: true,
          });
          return;
        }

        await i.deferUpdate();

        try {
          if (i.customId === "kick") {
            // Attempt to send DM
            try {
              await targetUser.send({ embeds: [kickEmbed] });
            } catch (err) {
              console.error("Failed to send DM to kicked user:", err);
            }

            // Kick the user
            await targetMember.kick(reason);
            kickButton.setDisabled(true);
            banButton.setDisabled(true);

            await i.editReply({
              content: `✅ ${targetUser.tag} has been kicked\n**Reason:** ${reason}`,
              components: [
                new ActionRowBuilder().addComponents(kickButton, banButton),
              ],
            });

            // Log the kick
            const logChannel = interaction.guild.channels.cache.find(
              (channel) => channel.name === "mod-logs"
            );

            if (logChannel) {
              await logChannel.send({
                content: `**User Kicked**\n**User:** ${targetUser.tag} (${targetUser.id})\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`,
              });
            }
          }

          if (i.customId === "ban") {
            // Attempt to send DM
            try {
              await targetUser.send({ embeds: [banEmbed] });
            } catch (err) {
              console.error("Failed to send DM to banned user:", err);
            }

            // Ban the user
            await targetMember.ban({ reason });
            kickButton.setDisabled(true);
            banButton.setDisabled(true);

            await i.editReply({
              content: `✅ ${targetUser.tag} has been banned\n**Reason:** ${reason}`,
              components: [
                new ActionRowBuilder().addComponents(kickButton, banButton),
              ],
            });

            // Log the ban
            const logChannel = interaction.guild.channels.cache.find(
              (channel) => channel.name === "mod-logs"
            );

            if (logChannel) {
              await logChannel.send({
                content: `**User Banned**\n**User:** ${targetUser.tag} (${targetUser.id})\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`,
              });
            }
          }
        } catch (error) {
          console.error("Error in button interaction:", error);
          await i.editReply({
            content:
              "❌ An error occurred while processing the moderation action.",
            components: [],
          });
        }
      });

      collector.on("end", () => {
        // Disable buttons when collector ends
        kickButton.setDisabled(true);
        banButton.setDisabled(true);
        if (reply.editable) {
          interaction
            .editReply({
              components: [
                new ActionRowBuilder().addComponents(kickButton, banButton),
              ],
            })
            .catch(console.error);
        }
      });
    } catch (error) {
      if (error.name === "ValidationError" || error.name === "HierarchyError") {
        throw error;
      }
      console.error("Error in moderate command:", error);
      throw {
        name: "CommandError",
        message: "An error occurred while moderating the user.",
      };
    }
  },
};
