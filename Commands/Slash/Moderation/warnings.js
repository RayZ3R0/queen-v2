import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import warndb from "../../../schema/warndb.js";
import { checkRoleHierarchy } from "../../../utils/permissionHandler.js";

export default {
  name: "warnings",
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("Manage warnings for users")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add a warning to a user")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to warn")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("The reason for the warning")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("show")
        .setDescription("Show warnings for a user")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription(
              "The user to check warnings for (defaults to yourself)"
            )
            .setRequired(false)
        )
    ),
  category: "Moderation",
  botPermissions: [
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
  ],

  run: async ({ client, interaction }) => {
    await interaction.deferReply();

    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case "add": {
          const targetMember = interaction.options.getMember("user");
          const reason = interaction.options.getString("reason");

          // Check if target is valid
          if (!targetMember) {
            throw {
              name: "ValidationError",
              message: "Please provide a valid user to warn.",
            };
          }

          // Validate role hierarchy
          checkRoleHierarchy(interaction.member, targetMember, interaction);

          // Create warning object
          const warningObject = {
            moderator: interaction.user.id,
            reason: reason,
            time: Math.floor(Date.now() / 1000),
            id: Math.floor(Math.random() * Date.now()).toString(36),
          };

          // Find or create warning data
          let data = await warndb.findOne({
            guild: interaction.guild.id,
            user: targetMember.id,
          });

          if (!data) {
            data = new warndb({
              guild: interaction.guild.id,
              user: targetMember.id,
              content: [warningObject],
            });
          } else {
            data.content.push(warningObject);
          }

          await data.save();

          // Send success message
          await interaction.editReply({
            content: `✅ Successfully warned ${targetMember.user.tag}\n**Reason:** ${reason}\n**Total Warnings:** ${data.content.length}`,
          });

          // Try to DM the warned user
          try {
            await targetMember.send(
              `You have been warned in ${interaction.guild.name}\n**Reason:** ${reason}`
            );
          } catch (err) {
            await interaction.followUp({
              content:
                "⚠️ Could not send DM to the user, but the warning was recorded.",
              ephemeral: true,
            });
          }

          // Log the warning
          const logChannel = interaction.guild.channels.cache.find(
            (channel) => channel.name === "mod-logs"
          );

          if (logChannel) {
            await logChannel.send({
              content: `**Warning**\n**User:** ${targetMember.user.tag} (${targetMember.id})\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}\n**Total Warnings:** ${data.content.length}`,
            });
          }
          break;
        }

        case "show": {
          const targetUser =
            interaction.options.getUser("user") || interaction.user;
          const targetMember = await interaction.guild.members
            .fetch(targetUser.id)
            .catch(() => null);

          if (!targetMember) {
            throw {
              name: "ValidationError",
              message: "Could not find that user in this server.",
            };
          }

          // Find warnings in database
          const data = await warndb.findOne({
            guild: interaction.guild.id,
            user: targetUser.id,
          });

          if (!data || data.content.length === 0) {
            const noWarnsEmbed = new EmbedBuilder()
              .setColor("Green")
              .setDescription(`${targetUser.tag} does not have any warnings.`)
              .setThumbnail(
                targetUser.displayAvatarURL({ dynamic: true, size: 512 })
              )
              .setTimestamp();

            return interaction.editReply({ embeds: [noWarnsEmbed] });
          }

          // Format warnings list
          const warningsList = data.content
            .map((w, i) => {
              const modUser = client.users.cache.get(w.moderator);
              const modTag = modUser ? modUser.tag : "Unknown Moderator";
              return `\n\`${i + 1}\` - **Moderator:** ${modTag}\n**Reason:** ${
                w.reason
              }\n**ID:** ${w.id || "No ID"}\n**Time:** <t:${w.time}:R>`;
            })
            .join("\n");

          // Create embed
          const embed = new EmbedBuilder()
            .setTitle(`Warnings for ${targetUser.tag}`)
            .setColor("DarkRed")
            .setThumbnail(
              targetUser.displayAvatarURL({ dynamic: true, size: 512 })
            )
            .setDescription(warningsList)
            .setFooter({
              text: `Total Warnings: ${data.content.length}`,
            })
            .setTimestamp();

          // Create buttons
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`delete_${targetUser.id}`)
              .setLabel("Delete Warning")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId(`clear_${targetUser.id}`)
              .setLabel("Clear All")
              .setStyle(ButtonStyle.Secondary)
          );

          const message = await interaction.editReply({
            embeds: [embed],
            components: [row],
          });

          // Create button collector
          const collector = message.createMessageComponentCollector({
            time: 60000,
          });

          collector.on("collect", async (i) => {
            // Check if user has permission
            if (!i.member.permissions.has(PermissionFlagsBits.KickMembers)) {
              await i.reply({
                content: "You need Kick Members permission to manage warnings.",
                ephemeral: true,
              });
              return;
            }

            // Check user hierarchy
            try {
              checkRoleHierarchy(i.member, targetMember, i);
            } catch (error) {
              await i.reply({
                content: error.message,
                ephemeral: true,
              });
              return;
            }

            const [action, userId] = i.customId.split("_");

            if (action === "delete") {
              const modal = new ModalBuilder()
                .setCustomId(`delete_modal_${userId}`)
                .setTitle("Delete Warning");

              const warnIdInput = new TextInputBuilder()
                .setCustomId("warnid")
                .setLabel("Warning ID")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("Enter the warning ID to delete")
                .setRequired(true);

              modal.addComponents(
                new ActionRowBuilder().addComponents(warnIdInput)
              );

              await i.showModal(modal);
            } else if (action === "clear") {
              // Delete all warnings
              await warndb.findOneAndDelete({
                guild: interaction.guild.id,
                user: userId,
              });

              // Update the embed to show no warnings
              const newEmbed = new EmbedBuilder()
                .setColor("Green")
                .setTitle(`Warnings for ${targetUser.tag}`)
                .setDescription("All warnings have been cleared.")
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setTimestamp();

              await message.edit({
                embeds: [newEmbed],
                components: [],
              });

              await i.reply({
                content: `Successfully cleared all warnings for ${targetUser.tag}`,
                ephemeral: true,
              });

              // Log the warning clearance
              const logChannel = interaction.guild.channels.cache.find(
                (channel) => channel.name === "mod-logs"
              );

              if (logChannel) {
                await logChannel.send({
                  content: `**Warnings Cleared**\n**User:** ${targetUser.tag} (${targetUser.id})\n**Moderator:** ${i.user.tag}`,
                });
              }
            }
          });

          // Handle modal submit for delete warning
          client.on("interactionCreate", async (i) => {
            if (!i.isModalSubmit()) return;
            if (!i.customId.startsWith("delete_modal_")) return;

            const userId = i.customId.split("_")[2];
            const warnId = i.fields.getTextInputValue("warnid");

            try {
              const data = await warndb.findOne({
                guild: interaction.guild.id,
                user: userId,
              });

              if (!data || !data.content.find((w) => w.id === warnId)) {
                await i.reply({
                  content: "Could not find a warning with that ID.",
                  ephemeral: true,
                });
                return;
              }

              // Get warning info for logging
              const warning = data.content.find((w) => w.id === warnId);

              // Remove the warning
              data.content = data.content.filter((w) => w.id !== warnId);
              if (data.content.length === 0) {
                await data.deleteOne();
              } else {
                await data.save();
              }

              await i.reply({
                content: "Warning successfully deleted!",
                ephemeral: true,
              });

              // Update the original message
              if (data.content.length === 0) {
                const newEmbed = new EmbedBuilder()
                  .setColor("Green")
                  .setTitle(`Warnings for ${targetUser.tag}`)
                  .setDescription("No warnings remaining.")
                  .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                  .setTimestamp();

                await message.edit({
                  embeds: [newEmbed],
                  components: [],
                });
              } else {
                const newWarningsList = data.content
                  .map((w, index) => {
                    const modUser = client.users.cache.get(w.moderator);
                    const modTag = modUser ? modUser.tag : "Unknown Moderator";
                    return `\n\`${
                      index + 1
                    }\` - **Moderator:** ${modTag}\n**Reason:** ${
                      w.reason
                    }\n**ID:** ${w.id}\n**Time:** <t:${w.time}:R>`;
                  })
                  .join("\n");

                const newEmbed = EmbedBuilder.from(message.embeds[0])
                  .setDescription(newWarningsList)
                  .setFooter({
                    text: `Total Warnings: ${data.content.length}`,
                  });

                await message.edit({
                  embeds: [newEmbed],
                });
              }

              // Log the warning deletion
              const logChannel = interaction.guild.channels.cache.find(
                (channel) => channel.name === "mod-logs"
              );

              if (logChannel) {
                await logChannel.send({
                  content: `**Warning Deleted**\n**User:** ${targetUser.tag} (${targetUser.id})\n**Moderator:** ${i.user.tag}\n**Deleted Warning Reason:** ${warning.reason}`,
                });
              }
            } catch (error) {
              console.error("Error deleting warning:", error);
              await i.reply({
                content: "An error occurred while deleting the warning.",
                ephemeral: true,
              });
            }
          });

          collector.on("end", () => {
            const disabledRow = new ActionRowBuilder().addComponents(
              ButtonBuilder.from(row.components[0]).setDisabled(true),
              ButtonBuilder.from(row.components[1]).setDisabled(true)
            );
            message.edit({ components: [disabledRow] }).catch(() => {});
          });
          break;
        }
      }
    } catch (error) {
      if (error.name === "ValidationError" || error.name === "HierarchyError") {
        throw error;
      }
      console.error("Error in warnings command:", error);
      throw {
        name: "DatabaseError",
        message: "An error occurred while managing warnings.",
      };
    }
  },
};
