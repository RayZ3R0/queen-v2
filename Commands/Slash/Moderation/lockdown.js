import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import GuildConfig from "../../../schema/guildConfig.js";

export default {
  name: "lockdown",
  data: new SlashCommandBuilder()
    .setName("lockdown")
    .setDescription("Server lockdown management")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("enable")
        .setDescription("Enable server lockdown")
        .addStringOption((option) =>
          option
            .setName("reason")
            .setDescription("Reason for lockdown")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("disable").setDescription("Disable server lockdown")
    )
    .addSubcommandGroup((group) =>
      group
        .setName("ignore")
        .setDescription("Manage roles ignored during lockdown")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("add")
            .setDescription("Add a role to ignore list")
            .addRoleOption((option) =>
              option
                .setName("role")
                .setDescription("Role to ignore during lockdown")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("remove")
            .setDescription("Remove a role from ignore list")
            .addRoleOption((option) =>
              option
                .setName("role")
                .setDescription("Role to remove from ignore list")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand.setName("list").setDescription("List all ignored roles")
        )
    ),
  category: "Moderation",
  botPermissions: [
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
  ],

  run: async ({ client, interaction }) => {
    await interaction.deferReply();

    try {
      const subcommand = interaction.options.getSubcommand();
      const group = interaction.options.getSubcommandGroup();
      const guildConfig = await GuildConfig.getOrCreate(interaction.guild.id);

      // Handle ignore role subcommands
      if (group === "ignore") {
        switch (subcommand) {
          case "add": {
            const role = interaction.options.getRole("role");

            if (guildConfig.isRoleIgnoredInLockdown(role.id)) {
              throw {
                name: "ValidationError",
                message: "This role is already in the ignore list.",
              };
            }

            await guildConfig.addIgnoredLockdownRole(role.id);
            await interaction.editReply({
              content: `✅ Added ${role.name} to lockdown ignore list.`,
            });
            break;
          }

          case "remove": {
            const role = interaction.options.getRole("role");

            if (!guildConfig.isRoleIgnoredInLockdown(role.id)) {
              throw {
                name: "ValidationError",
                message: "This role is not in the ignore list.",
              };
            }

            await guildConfig.removeIgnoredLockdownRole(role.id);
            await interaction.editReply({
              content: `✅ Removed ${role.name} from lockdown ignore list.`,
            });
            break;
          }

          case "list": {
            const ignoredRoles = guildConfig.ignoredLockdownRoles.map(
              (roleId) => {
                const role = interaction.guild.roles.cache.get(roleId);
                return role ? role.name : `Unknown Role (${roleId})`;
              }
            );

            const embed = new EmbedBuilder()
              .setTitle("Lockdown Ignored Roles")
              .setDescription(
                ignoredRoles.length > 0
                  ? ignoredRoles.join("\n")
                  : "No roles are currently ignored during lockdown."
              )
              .setColor("Blue");

            await interaction.editReply({ embeds: [embed] });
            break;
          }
        }
        return;
      }

      // Handle enable/disable subcommands
      switch (subcommand) {
        case "enable": {
          if (guildConfig.isLockedDown) {
            throw {
              name: "ValidationError",
              message: "Server is already in lockdown.",
            };
          }

          const reason =
            interaction.options.getString("reason") || "No reason provided";
          const channels = interaction.guild.channels.cache;

          // Process channels in batches to avoid rate limits
          const batchSize = 5;
          const channelBatches = Array.from(channels.values())
            .filter((channel) =>
              channel.permissionsFor(interaction.guild.roles.everyone)
            )
            .reduce((acc, curr, i) => {
              const batchIndex = Math.floor(i / batchSize);
              if (!acc[batchIndex]) acc[batchIndex] = [];
              acc[batchIndex].push(curr);
              return acc;
            }, []);

          await interaction.editReply(
            `🔒 Locking down server...\nReason: ${reason}`
          );

          for (const batch of channelBatches) {
            await Promise.all(
              batch.map(async (channel) => {
                const permissionOverwrites = channel.permissionOverwrites.cache;
                const channelPerms = [];

                // Store current permissions
                for (const [roleId, overwrite] of permissionOverwrites) {
                  const role = interaction.guild.roles.cache.get(roleId);
                  if (!role || guildConfig.isRoleIgnoredInLockdown(roleId))
                    continue;

                  channelPerms.push({
                    roleId,
                    allowed: overwrite.allow.toArray(),
                    denied: overwrite.deny.toArray(),
                  });

                  // Update permissions to deny sending messages
                  await channel.permissionOverwrites.edit(roleId, {
                    SendMessages: false,
                    SendMessagesInThreads: false,
                    CreatePublicThreads: false,
                    CreatePrivateThreads: false,
                  });
                }

                // Store the channel's permission state
                await guildConfig.storeLockdownState(channel.id, {
                  channelId: channel.id,
                  permissions: channelPerms,
                });
              })
            );

            // Add a small delay between batches to avoid rate limits
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          await interaction.editReply("✅ Server lockdown enabled.");

          // Log the lockdown
          const logChannel = interaction.guild.channels.cache.find(
            (channel) => channel.name === "mod-logs"
          );

          if (logChannel) {
            await logChannel.send({
              content: `**Server Lockdown Enabled**\n**Moderator:** ${interaction.user.tag}\n**Reason:** ${reason}`,
            });
          }
          break;
        }

        case "disable": {
          if (!guildConfig.isLockedDown) {
            throw {
              name: "ValidationError",
              message: "Server is not in lockdown.",
            };
          }

          await interaction.editReply("🔓 Disabling server lockdown...");

          // Process channels in batches
          const channels = interaction.guild.channels.cache;
          const batchSize = 5;
          const channelBatches = Array.from(channels.values()).reduce(
            (acc, curr, i) => {
              const batchIndex = Math.floor(i / batchSize);
              if (!acc[batchIndex]) acc[batchIndex] = [];
              acc[batchIndex].push(curr);
              return acc;
            },
            []
          );

          for (const batch of channelBatches) {
            await Promise.all(
              batch.map(async (channel) => {
                const savedPerms = guildConfig.getLockdownState(channel.id);
                if (!savedPerms) return;

                // Restore original permissions
                for (const perm of savedPerms.permissions) {
                  try {
                    await channel.permissionOverwrites.edit(perm.roleId, {
                      SendMessages: null,
                      SendMessagesInThreads: null,
                      CreatePublicThreads: null,
                      CreatePrivateThreads: null,
                    });
                  } catch (error) {
                    console.error(
                      `Failed to restore permissions for channel ${channel.id}, role ${perm.roleId}:`,
                      error
                    );
                  }
                }
              })
            );

            // Add a small delay between batches
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          // Clear lockdown state
          await guildConfig.clearLockdownState();
          await interaction.editReply("✅ Server lockdown disabled.");

          // Log the lockdown disable
          const logChannel = interaction.guild.channels.cache.find(
            (channel) => channel.name === "mod-logs"
          );

          if (logChannel) {
            await logChannel.send({
              content: `**Server Lockdown Disabled**\n**Moderator:** ${interaction.user.tag}`,
            });
          }
          break;
        }
      }
    } catch (error) {
      if (error.name === "ValidationError") {
        throw error;
      }
      console.error("Error in lockdown command:", error);
      throw {
        name: "CommandError",
        message: "An error occurred while managing server lockdown.",
      };
    }
  },
};
