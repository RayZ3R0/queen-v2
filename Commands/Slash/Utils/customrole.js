import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
} from "discord.js";
import CustomRoles from "../../../schema/customRoles.js";
import {
  setRoleAboveDivider,
  createRoleErrorEmbed,
  createRoleSuccessEmbed,
  LEVEL_ROLES_DIVIDER,
} from "../../../utils/roleUtils.js";

export default {
  name: "customrole",
  data: new SlashCommandBuilder()
    .setName("customrole")
    .setDescription("Manage your custom booster role")
    .addSubcommand((subcommand) =>
      subcommand.setName("create").setDescription("Create your custom role")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("edit").setDescription("Edit your custom role")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("delete").setDescription("Delete your custom role")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("leaderboard")
        .setDescription("View server boosters and their boost duration")
    ),
  category: "Utils",
  botPermissions: [PermissionFlagsBits.ManageRoles],

  run: async ({ client, interaction }) => {
    try {
      const subcommand = interaction.options.getSubcommand();

      // Only check premium status for non-leaderboard commands
      if (subcommand !== "leaderboard" && !interaction.member.premiumSince) {
        return await interaction.reply({
          embeds: [
            createRoleErrorEmbed(
              "You need to be a server booster to use this command."
            ),
          ],
          ephemeral: true,
        });
      }

      const customRole = await CustomRoles.findOne({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      });

      switch (subcommand) {
        case "create":
          if (customRole) {
            return await interaction.reply({
              embeds: [
                createRoleErrorEmbed(
                  "You already have a custom role. Use `/customrole edit` to modify it."
                ),
              ],
              ephemeral: true,
            });
          }

          // Create modal for role creation
          const createModal = new ModalBuilder()
            .setCustomId("create_role_modal")
            .setTitle("Create Custom Role");

          const nameInput = new TextInputBuilder()
            .setCustomId("role_name")
            .setLabel("Role Name")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

          const colorInput = new TextInputBuilder()
            .setCustomId("role_color")
            .setLabel("Role Color (Hex format: #FF0000)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("#FF0000");

          const firstRow = new ActionRowBuilder().addComponents(nameInput);
          const secondRow = new ActionRowBuilder().addComponents(colorInput);

          createModal.addComponents(firstRow, secondRow);
          await interaction.showModal(createModal);
          break;

        case "edit":
          if (!customRole) {
            return await interaction.reply({
              embeds: [
                createRoleErrorEmbed(
                  "You don't have a custom role yet. Use `/customrole create` first."
                ),
              ],
              ephemeral: true,
            });
          }

          const role = await interaction.guild.roles.fetch(customRole.roleId);
          if (!role) {
            await CustomRoles.findByIdAndDelete(customRole._id);
            return await interaction.reply({
              embeds: [
                createRoleErrorEmbed(
                  "Your custom role was deleted. Please create a new one."
                ),
              ],
              ephemeral: true,
            });
          }

          const editEmbed = new EmbedBuilder()
            .setColor(role.color)
            .setTitle("Edit Custom Role")
            .setDescription("Choose what you want to edit")
            .addFields(
              { name: "Current Name", value: role.name },
              {
                name: "Current Color",
                value: `#${role.color
                  .toString(16)
                  .padStart(6, "0")
                  .toUpperCase()}`,
              }
            );

          const editButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("edit_name")
              .setLabel("Edit Name")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("edit_color")
              .setLabel("Edit Color")
              .setStyle(ButtonStyle.Primary)
          );

          await interaction.reply({
            embeds: [editEmbed],
            components: [editButtons],
          });
          break;

        case "delete":
          if (!customRole) {
            return await interaction.reply({
              embeds: [
                createRoleErrorEmbed("You don't have a custom role to delete."),
              ],
              ephemeral: true,
            });
          }

          const confirmButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("confirm_delete")
              .setLabel("Confirm Delete")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId("cancel_delete")
              .setLabel("Cancel")
              .setStyle(ButtonStyle.Secondary)
          );

          await interaction.reply({
            content:
              "⚠️ Are you sure you want to delete your custom role? This cannot be undone.",
            components: [confirmButtons],
          });
          break;

        case "leaderboard":
          // Get all boosters
          let boosters = (await interaction.guild.members.fetch())
            .filter((m) => m.premiumSince)
            .map((m) => ({
              user: m.user,
              boostingSince: m.premiumSince,
              duration: Date.now() - m.premiumSince,
              customRole: null,
            }));

          // Add custom role info
          for (const booster of boosters) {
            const customRoleData = await CustomRoles.findOne({
              userId: booster.user.id,
              guildId: interaction.guild.id,
            });
            if (customRoleData) {
              const role = await interaction.guild.roles.fetch(
                customRoleData.roleId
              );
              booster.customRole = role;
            }
          }

          // Sort by boost duration
          boosters.sort((a, b) => b.duration - a.duration);

          // Setup pagination
          const itemsPerPage = 10;
          const maxPages = Math.ceil(boosters.length / itemsPerPage);
          let currentPage = 0;

          const generateEmbed = (page) => {
            const embed = new EmbedBuilder()
              .setColor("#FF73FA")
              .setTitle("Server Booster Leaderboard")
              .setDescription("Thanks y'all <:KurumiHehe:968779460943949875>")
              .setFooter({
                text: `Page ${page + 1}/${maxPages} • Total Boosters: ${
                  boosters.length
                }`,
              });

            const start = page * itemsPerPage;
            const end = Math.min(start + itemsPerPage, boosters.length);

            for (let i = start; i < end; i++) {
              const booster = boosters[i];
              embed.addFields({
                name: `${i + 1}. ${booster.user.tag}`,
                value: `Boosting since: <t:${Math.floor(
                  booster.boostingSince.getTime() / 1000
                )}:R>\n${
                  booster.customRole
                    ? `Custom Role: ${booster.customRole.name}`
                    : "No custom role"
                }`,
              });
            }

            return embed;
          };

          // Create navigation buttons
          const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("prev_page")
              .setLabel("Previous")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId("next_page")
              .setLabel("Next")
              .setStyle(ButtonStyle.Primary)
              .setDisabled(maxPages <= 1),
            new ButtonBuilder()
              .setCustomId("refresh_lb")
              .setLabel("🔄 Refresh")
              .setStyle(ButtonStyle.Secondary)
          );

          const response = await interaction.reply({
            embeds: [generateEmbed(0)],
            components: [buttons],
            fetchReply: true,
          });

          // Create button collector
          const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300000, // 5 minutes
          });

          collector.on("collect", async (i) => {
            if (i.user.id !== interaction.user.id) {
              await i.reply({
                content: "These buttons aren't for you!",
                ephemeral: true,
              });
              return;
            }

            // Handle button interactions
            if (i.customId === "prev_page") {
              currentPage--;
            } else if (i.customId === "next_page") {
              currentPage++;
            } else if (i.customId === "refresh_lb") {
              try {
                // Refresh booster list
                const newBoosters = (await interaction.guild.members.fetch())
                  .filter((m) => m.premiumSince)
                  .map((m) => ({
                    user: m.user,
                    boostingSince: m.premiumSince,
                    duration: Date.now() - m.premiumSince,
                    customRole: null,
                  }));

                // Update roles
                for (const booster of newBoosters) {
                  const customRoleData = await CustomRoles.findOne({
                    userId: booster.user.id,
                    guildId: interaction.guild.id,
                  });
                  if (customRoleData) {
                    const role = await interaction.guild.roles.fetch(
                      customRoleData.roleId
                    );
                    booster.customRole = role;
                  }
                }

                boosters = newBoosters.sort((a, b) => b.duration - a.duration);
                currentPage = 0; // Reset to first page

                const newMaxPages = Math.ceil(boosters.length / itemsPerPage);
                buttons.components[0].setDisabled(true);
                buttons.components[1].setDisabled(newMaxPages <= 1);
              } catch (error) {
                console.error("Error refreshing booster list:", error);
                await i.reply({
                  embeds: [
                    createRoleErrorEmbed("Failed to refresh booster list."),
                  ],
                  ephemeral: true,
                });
                return;
              }
            }

            // Update button states
            buttons.components[0].setDisabled(currentPage === 0);
            buttons.components[1].setDisabled(currentPage === maxPages - 1);

            await i.update({
              embeds: [generateEmbed(currentPage)],
              components: [buttons],
            });
          });

          // Handle collector end
          collector.on("end", () => {
            buttons.components.forEach((button) => button.setDisabled(true));
            interaction.editReply({ components: [buttons] }).catch(() => {});
          });
          break;
      }
    } catch (error) {
      console.error("Error in customrole command:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ An error occurred while managing your custom role.",
          ephemeral: true,
        });
      }
    }
  },

  // Handle button interactions
  buttonHandler: async (interaction) => {
    try {
      if (interaction.customId === "confirm_delete") {
        const customRole = await CustomRoles.findOne({
          userId: interaction.user.id,
          guildId: interaction.guild.id,
        });

        if (!customRole) {
          await interaction.update({
            embeds: [createRoleErrorEmbed("No custom role found to delete.")],
            components: [],
          });
          return;
        }

        const role = await interaction.guild.roles.fetch(customRole.roleId);
        if (role) {
          await role.delete("Custom role deleted by user");
        }

        await CustomRoles.findByIdAndDelete(customRole._id);
        await interaction.update({
          embeds: [
            createRoleSuccessEmbed("Your custom role has been deleted."),
          ],
          components: [],
        });
      }

      if (interaction.customId === "cancel_delete") {
        await interaction.update({
          content: "Operation cancelled.",
          components: [],
        });
      }

      if (
        ["edit_name", "edit_color", "edit_icon"].includes(interaction.customId)
      ) {
        const modalId = {
          edit_name: "edit_name_modal",
          edit_color: "edit_color_modal",
          edit_icon: "edit_icon_modal",
        }[interaction.customId];

        const modal = new ModalBuilder()
          .setCustomId(modalId)
          .setTitle(
            "Edit Role " +
              interaction.customId.split("_")[1].charAt(0).toUpperCase() +
              interaction.customId.split("_")[1].slice(1)
          );

        let input;
        if (interaction.customId === "edit_name") {
          input = new TextInputBuilder()
            .setCustomId("new_name")
            .setLabel("New Role Name")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);
        } else if (interaction.customId === "edit_color") {
          input = new TextInputBuilder()
            .setCustomId("new_color")
            .setLabel("New Role Color (Hex format: #FF0000)")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder("#FF0000");
        }

        if (input) {
          const row = new ActionRowBuilder().addComponents(input);
          modal.addComponents(row);
          await interaction.showModal(modal);
        }
      }
    } catch (error) {
      console.error("Error in button handler:", error);
      await interaction.reply({
        content: "❌ An error occurred while processing your request.",
        ephemeral: true,
      });
    }
  },

  // Handle modal submissions
  modalHandler: async (interaction) => {
    try {
      const customRole = await CustomRoles.findOne({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      });

      if (interaction.customId === "create_role_modal") {
        const name = interaction.fields.getTextInputValue("role_name");
        const color = interaction.fields.getTextInputValue("role_color");

        // Validate color format
        if (!/^#[0-9A-F]{6}$/i.test(color)) {
          await interaction.reply({
            embeds: [
              createRoleErrorEmbed(
                "Invalid color format. Please use hex format (e.g., #FF0000)."
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        // Create and position the role
        const newRole = await interaction.guild.roles.create({
          name: name,
          color: color,
          reason: `Custom role created for ${interaction.user.tag}`,
        });

        try {
          await setRoleAboveDivider(newRole, interaction.guild);
        } catch (error) {
          console.error("Error setting role position:", error);
          await interaction.reply({
            embeds: [
              createRoleErrorEmbed(
                "Role created but position could not be set above level roles."
              ),
            ],
            ephemeral: true,
          });
        }

        // Save to database
        await new CustomRoles({
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          roleId: newRole.id,
        }).save();

        // Assign role to user
        await interaction.member.roles.add(newRole);

        await interaction.reply({
          embeds: [
            createRoleSuccessEmbed(
              `Custom role has been created and assigned to you!\nName: ${name}\nColor: ${color}`
            ),
          ],
        });
        return;
      }

      if (interaction.customId === "edit_name_modal") {
        if (!customRole) {
          await interaction.reply({
            embeds: [
              createRoleErrorEmbed("You don't have a custom role to edit."),
            ],
            ephemeral: true,
          });
          return;
        }

        const newName = interaction.fields.getTextInputValue("new_name");
        const role = await interaction.guild.roles.fetch(customRole.roleId);

        if (!role) {
          await interaction.reply({
            embeds: [
              createRoleErrorEmbed(
                "Your custom role could not be found. Please create a new one."
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        await role.setName(
          newName,
          `Custom role name edited by ${interaction.user.tag}`
        );
        customRole.lastUpdated = new Date();
        await customRole.save();

        await interaction.reply({
          embeds: [
            createRoleSuccessEmbed(
              `Your custom role name has been updated to: ${newName}`
            ),
          ],
        });
        return;
      }

      if (interaction.customId === "edit_color_modal") {
        if (!customRole) {
          await interaction.reply({
            content: "❌ You don't have a custom role to edit.",
            ephemeral: true,
          });
          return;
        }

        const newColor = interaction.fields.getTextInputValue("new_color");
        if (!/^#[0-9A-F]{6}$/i.test(newColor)) {
          await interaction.reply({
            embeds: [
              createRoleErrorEmbed(
                "Invalid color format. Please use hex format (e.g., #FF0000)."
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        const role = await interaction.guild.roles.fetch(customRole.roleId);
        if (!role) {
          await interaction.reply({
            embeds: [
              createRoleErrorEmbed(
                "Your custom role could not be found. Please create a new one."
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        await role.setColor(
          newColor,
          `Custom role color edited by ${interaction.user.tag}`
        );
        customRole.lastUpdated = new Date();
        await customRole.save();

        await interaction.reply({
          embeds: [
            createRoleSuccessEmbed(
              `Your custom role color has been updated to: ${newColor}`
            ),
          ],
        });
        return;
      }
    } catch (error) {
      console.error("Error in modal handler:", error);
      await interaction.reply({
        embeds: [
          createRoleErrorEmbed(
            "An error occurred while processing your request."
          ),
        ],
        ephemeral: true,
      });
    }
  },
};
