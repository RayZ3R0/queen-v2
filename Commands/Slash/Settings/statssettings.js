import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import GuildConfig from "../../../schema/guildConfig.js";

export default {
  name: "statssettings",
  data: new SlashCommandBuilder()
    .setName("statssettings")
    .setDescription("Configure server statistics settings")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("ignore")
        .setDescription("Add a channel to the stats ignore list")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel to ignore")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("unignore")
        .setDescription("Remove a channel from the stats ignore list")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel to stop ignoring")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("ignorelist")
        .setDescription("View all ignored channels")
    ),
  category: "Settings",

  run: async ({ client, interaction }) => {
    // Defer reply to prevent timeout
    await interaction.deferReply({ ephemeral: true });

    try {
      const subcommand = interaction.options.getSubcommand();

      // Get or create guild config with error handling
      const guildConfig = await GuildConfig.getOrCreate(
        interaction.guildId
      ).catch((error) => {
        console.error(`Error fetching guild config: ${error.message}`);
        throw new Error("Failed to fetch server configuration");
      });

      // Make sure ignoredChannels exists even if it's not in the schema
      if (!guildConfig.ignoredChannels) {
        guildConfig.ignoredChannels = [];
      }

      switch (subcommand) {
        case "ignore": {
          const channel = interaction.options.getChannel("channel");

          // Define isChannelIgnored if it doesn't exist
          const isIgnored =
            typeof guildConfig.isChannelIgnored === "function"
              ? guildConfig.isChannelIgnored(channel.id)
              : guildConfig.ignoredChannels.includes(channel.id);

          if (isIgnored) {
            return await interaction.editReply({
              content: `⚠️ ${channel} is already being ignored for stats tracking.`,
            });
          }

          // Add channel to ignored list
          if (typeof guildConfig.addIgnoredChannel === "function") {
            await guildConfig.addIgnoredChannel(channel.id);
          } else {
            // Fallback if method doesn't exist
            if (!guildConfig.ignoredChannels.includes(channel.id)) {
              guildConfig.ignoredChannels.push(channel.id);
              await guildConfig.save();
            }
          }

          return await interaction.editReply({
            content: `✅ ${channel} will now be ignored for stats tracking.`,
          });
        }

        case "unignore": {
          const channel = interaction.options.getChannel("channel");

          // Define isChannelIgnored if it doesn't exist
          const isIgnored =
            typeof guildConfig.isChannelIgnored === "function"
              ? guildConfig.isChannelIgnored(channel.id)
              : guildConfig.ignoredChannels.includes(channel.id);

          if (!isIgnored) {
            return await interaction.editReply({
              content: `⚠️ ${channel} is not currently being ignored.`,
            });
          }

          // Remove channel from ignored list
          if (typeof guildConfig.removeIgnoredChannel === "function") {
            await guildConfig.removeIgnoredChannel(channel.id);
          } else {
            // Fallback if method doesn't exist
            guildConfig.ignoredChannels = guildConfig.ignoredChannels.filter(
              (id) => id !== channel.id
            );
            await guildConfig.save();
          }

          return await interaction.editReply({
            content: `✅ ${channel} will no longer be ignored for stats tracking.`,
          });
        }

        case "ignorelist": {
          const ignoredChannels = guildConfig.ignoredChannels || [];

          if (ignoredChannels.length === 0) {
            return await interaction.editReply({
              content: "No channels are currently being ignored.",
            });
          }

          const channelMentions = ignoredChannels
            .map((id) => `<#${id}>`)
            .join("\n");

          return await interaction.editReply({
            content: `**Ignored Channels:**\n${channelMentions}`,
          });
        }

        default:
          return await interaction.editReply({
            content: "❌ Invalid subcommand.",
          });
      }
    } catch (error) {
      console.error("Error in statssettings command:", error);

      // Check if the reply has already been sent
      if (interaction.replied || interaction.deferred) {
        return await interaction.editReply({
          content: `❌ An error occurred: ${error.message || "Unknown error"}`,
        });
      } else {
        return await interaction.reply({
          content: `❌ An error occurred: ${error.message || "Unknown error"}`,
          ephemeral: true,
        });
      }
    }
  },
};
