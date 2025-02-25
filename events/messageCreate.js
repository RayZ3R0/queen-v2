import { getCooldown, setCooldown } from "../handlers/functions.js";
import { client } from "../bot.js";

/**
 * Event listener for when a message is created.
 * @param {Message} message - The message object received from Discord.
 */
client.on("messageCreate", async (message) => {
  try {
    // Ignore bot messages or messages outside a guild context
    if (message.author.bot || !message.guild || !message.id) return;

    const prefix = client.config.PREFIX;
    const mentionPrefix = new RegExp(
      `^(<@!?${client.user.id}>|${escapeRegex(prefix)})\\s*`
    );

    if (!mentionPrefix.test(message.content)) return;
    const [, nPrefix] = message.content.match(mentionPrefix);
    const args = message.content.slice(nPrefix.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    // If no command is given, show help if mentioned directly
    if (cmd.length === 0) {
      if (nPrefix.includes(client.user.id)) {
        return client.sendEmbed(
          message,
          ` ${client.config.emoji.success} To see all my commands type \`/help\` or \`${prefix}help\``
        );
      }
    }

    // Find the command by name or alias.
    /**
     * @type {import("../index.js").Mcommand}
     */
    const command =
      client.mcommands.get(cmd) ||
      client.mcommands.find(
        (cmds) => cmds.aliases && cmds.aliases.includes(cmd)
      );
    if (!command) return;

    const { owneronly, userPermissions, botPermissions } = command;
    const { author, member, guild } = message;

    // Check if the command is owner-only.
    if (owneronly && !client.config.Owners.includes(author.id)) {
      return client.sendEmbed(
        message,
        "This command is restricted to authorized persons only."
      );
    }

    // Check user permissions.
    const missingUserPerms = userPermissions.filter(
      (perm) => !member.permissions.has(perm)
    );
    if (missingUserPerms.length > 0) {
      await client.sendEmbed(
        message,
        `You are missing the following permissions: \`${missingUserPerms.join(
          ", "
        )}\``
      );
      return;
    }

    // Check bot permissions.
    const missingBotPerms = botPermissions.filter(
      (perm) => !guild.members.me.permissions.has(perm)
    );
    if (missingBotPerms.length > 0) {
      await client.sendEmbed(
        message,
        `I am missing the following permissions: \`${missingBotPerms.join(
          ", "
        )}\``
      );
      return;
    }

    // Check command cooldown without applying it yet.
    const cd = await getCooldown(message, command);
    if (cd) {
      const totalSeconds = Math.floor(cd);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const timeParts = [];
      if (days) timeParts.push(`${days} day${days !== 1 ? "s" : ""}`);
      if (hours) timeParts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
      if (minutes)
        timeParts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
      if (seconds)
        timeParts.push(`${seconds} second${seconds !== 1 ? "s" : ""}`);
      const timeString = timeParts.join(" ");
      return client.sendEmbed(
        message,
        `You are currently on cooldown. Please wait for **${timeString}** before trying again.`
      );
    }

    // If the command is gambling, check if the user is already in a session.
    let isGamblingCommand = command.gambling === true;
    if (isGamblingCommand) {
      if (client.activeGambleSessions.has(message.author.id)) {
        return client.sendEmbed(
          message,
          "You already have an active gambling session. Please finish it before starting a new one."
        );
      }
      // Mark the user as active.
      client.activeGambleSessions.add(message.author.id);
    }

    try {
      // Execute the command.
      const shouldSetCooldown = await command.run({
        client,
        message,
        args,
        prefix,
      });
      if (shouldSetCooldown !== false && !command.noCooldownOnFail) {
        await setCooldown(message, command);
      }
    } catch (error) {
      console.error("Command error:", error);
      await client.sendEmbed(
        message,
        "An error occurred while executing that command. The cooldown will not be applied."
      );
    } finally {
      // If it was a gambling command, remove the active session flag.
      if (isGamblingCommand) {
        client.activeGambleSessions.delete(message.author.id);
      }
    }
  } catch (error) {
    console.error(
      "An error occurred while processing messageCreate event:",
      error
    );
  }
});

/**
 * Escapes special characters in a string to create a regex pattern.
 * @param {string} newPrefix - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeRegex(newPrefix) {
  return newPrefix?.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`);
}
