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

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildConfig = await GuildConfig.getOrCreate(interaction.guildId);

    switch (subcommand) {
      case "ignore": {
        const channel = interaction.options.getChannel("channel");

        if (guildConfig.isChannelIgnored(channel.id)) {
          await interaction.reply({
            content: `⚠️ ${channel} is already being ignored for stats tracking.`,
            ephemeral: true,
          });
          return;
        }

        await guildConfig.addIgnoredChannel(channel.id);
        await interaction.reply({
          content: `✅ ${channel} will now be ignored for stats tracking.`,
          ephemeral: true,
        });
        break;
      }

      case "unignore": {
        const channel = interaction.options.getChannel("channel");

        if (!guildConfig.isChannelIgnored(channel.id)) {
          await interaction.reply({
            content: `⚠️ ${channel} is not currently being ignored.`,
            ephemeral: true,
          });
          return;
        }

        await guildConfig.removeIgnoredChannel(channel.id);
        await interaction.reply({
          content: `✅ ${channel} will no longer be ignored for stats tracking.`,
          ephemeral: true,
        });
        break;
      }

      case "ignorelist": {
        const ignoredChannels = guildConfig.ignoredChannels;

        if (ignoredChannels.length === 0) {
          await interaction.reply({
            content: "No channels are currently being ignored.",
            ephemeral: true,
          });
          return;
        }

        const channelMentions = ignoredChannels
          .map((id) => `<#${id}>`)
          .join("\n");

        await interaction.reply({
          content: `**Ignored Channels:**\n${channelMentions}`,
          ephemeral: true,
        });
        break;
      }
    }
  },
};
