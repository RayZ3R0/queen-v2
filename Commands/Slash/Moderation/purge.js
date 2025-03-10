import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete multiple messages at once")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Number of messages to delete (1-100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addStringOption((option) =>
      option
        .setName("filter")
        .setDescription("Filter messages to delete")
        .setRequired(false)
        .addChoices(
          { name: "bot", value: "bot" },
          { name: "user", value: "user" }
        )
    )
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription(
          "User whose messages to delete (required if filter is 'user')"
        )
        .setRequired(false)
    ),
  category: "Moderation",
  botPermissions: [PermissionFlagsBits.ManageMessages],

  run: async ({ client, interaction }) => {
    await interaction.deferReply({ ephemeral: true });

    try {
      const amount = interaction.options.getInteger("amount");
      const filter = interaction.options.getString("filter");
      const target = interaction.options.getUser("target");

      // Validate filter and target combination
      if (filter === "user" && !target) {
        throw {
          name: "ValidationError",
          message:
            "You must specify a target user when using the 'user' filter.",
        };
      }

      if (!filter && target) {
        throw {
          name: "ValidationError",
          message: "You must specify the 'user' filter when targeting a user.",
        };
      }

      // Fetch messages
      const messages = await interaction.channel.messages.fetch({
        limit: 100,
      });

      // Filter messages
      let messagesToDelete = messages;

      // Filter out messages older than 14 days (Discord limitation)
      messagesToDelete = messagesToDelete.filter(
        (msg) => Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000
      );

      // Apply additional filters if specified
      if (filter === "bot") {
        messagesToDelete = messagesToDelete.filter((msg) => msg.author.bot);
      } else if (filter === "user" && target) {
        messagesToDelete = messagesToDelete.filter(
          (msg) => msg.author.id === target.id
        );
      }

      // Take only the requested amount
      messagesToDelete = messagesToDelete.first(amount);

      if (!messagesToDelete.length) {
        throw {
          name: "ValidationError",
          message: "No messages found matching the criteria.",
        };
      }

      // Delete messages
      const deleted = await interaction.channel.bulkDelete(
        messagesToDelete,
        true
      );

      // Send success message
      let response = `✅ Successfully deleted ${deleted.size} message${
        deleted.size === 1 ? "" : "s"
      }`;
      if (filter) {
        response += ` from ${filter === "bot" ? "bots" : target.tag}`;
      }

      await interaction.editReply({
        content: response,
        ephemeral: true,
      });

      // Log the purge
      const logChannel = interaction.guild.channels.cache.find(
        (channel) => channel.name === "mod-logs"
      );

      if (logChannel) {
        let logMessage = `**Messages Purged**\n`;
        logMessage += `**Channel:** ${interaction.channel}\n`;
        logMessage += `**Moderator:** ${interaction.user.tag}\n`;
        logMessage += `**Amount:** ${deleted.size} message${
          deleted.size === 1 ? "" : "s"
        }\n`;
        if (filter) {
          logMessage += `**Filter:** ${filter}\n`;
        }
        if (target) {
          logMessage += `**Target:** ${target.tag} (${target.id})\n`;
        }

        await logChannel.send({ content: logMessage });
      }
    } catch (error) {
      if (error.name === "ValidationError") {
        throw error;
      }
      console.error("Error in purge command:", error);

      // Handle Discord API errors
      if (error.code === 50034) {
        throw {
          name: "ValidationError",
          message: "Cannot delete messages older than 14 days.",
        };
      }

      throw {
        name: "CommandError",
        message: "An error occurred while purging messages.",
      };
    }
  },
};
