import { PermissionsBitField } from "discord.js";

export default {
  name: "purge",
  aliases: [],
  description:
    "Purges messages in the channel. Options: \n• !purge 100\n• !purge @user 100\n• !purge bot 100",
  usage: "<@user|bot> <number> or <number>",
  cooldown: 5,
  userPermissions: [PermissionsBitField.Flags.ManageMessages],
  botPermissions: [PermissionsBitField.Flags.ManageMessages],
  category: "Moderation",

  run: async ({ client, message, args, prefix }) => {
    // Validate arguments and determine filter type and amount.
    let filterType = null; // Can be "user", "bot", or null for no filter.
    let amount;

    if (!args.length) {
      return message.reply(
        "You must specify the number of messages to purge. You can also filter by @user or 'bot'."
      );
    }

    // Case where first argument is not a number (i.e. filter provided)
    if (isNaN(args[0])) {
      // If a user is mentioned, use user filter.
      const targetUser = message.mentions.users.first();
      if (targetUser) {
        filterType = "user";
        amount = parseInt(args[1]);
        if (!amount || isNaN(amount))
          return message.reply(
            "Please provide a valid number after the user mention."
          );
      } else if (args[0].toLowerCase() === "bot") {
        // If first argument is 'bot', filter bot messages.
        filterType = "bot";
        amount = parseInt(args[1]);
        if (!amount || isNaN(amount))
          return message.reply("Please provide a valid number after 'bot'.");
      } else {
        return message.reply(
          "Invalid filter. Use a user mention or 'bot' followed by the number."
        );
      }
    } else {
      // No filter provided; first argument is the number
      amount = parseInt(args[0]);
      if (!amount || isNaN(amount))
        return message.reply(
          "Please provide a valid number of messages to purge."
        );
    }

    // Limit the amount to between 1 and 100, as bulk delete only supports a maximum of 100 messages.
    if (amount < 1 || amount > 100) {
      return message.reply(
        "You can only purge between 1 and 100 messages at a time."
      );
    }

    try {
      // Exclude the command message by filtering out message with id equal to message.id.
      if (!filterType) {
        // Fetch one extra message to account for filtering the command message.
        const fetched = await message.channel.messages.fetch({
          limit: amount + 1,
        });
        let messagesToDelete = fetched.filter((msg) => msg.id !== message.id);
        const deleted = await message.channel.bulkDelete(
          messagesToDelete,
          true
        );
        return message.reply(`Successfully deleted ${deleted.size} messages.`);
      } else {
        // For filters (user or bot), fetch a collection of messages (limit: 100)
        const fetched = await message.channel.messages.fetch({ limit: 100 });
        let messagesToDelete;

        // Make sure the messages are not older than 14 days as they cannot be deleted in bulk.
        const validMessage = (msg) =>
          Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000;

        if (filterType === "user") {
          const targetUser = message.mentions.users.first();
          messagesToDelete = fetched.filter(
            (msg) =>
              msg.id !== message.id &&
              msg.author.id === targetUser.id &&
              validMessage(msg)
          );
        } else if (filterType === "bot") {
          messagesToDelete = fetched.filter(
            (msg) =>
              msg.id !== message.id && msg.author.bot && validMessage(msg)
          );
        }

        // Select up to the number of messages specified.
        messagesToDelete = messagesToDelete.first(amount);
        if (!messagesToDelete || messagesToDelete.length === 0) {
          return message.reply(
            "No messages found to delete with the given filter."
          );
        }

        const deleted = await message.channel.bulkDelete(
          messagesToDelete,
          true
        );
        return message.reply(`Successfully deleted ${deleted.size} messages.`);
      }
    } catch (error) {
      console.error(error);
      return message.reply(
        "An error occurred while trying to purge messages. Ensure the messages are not older than 14 days."
      );
    }
  },
};
