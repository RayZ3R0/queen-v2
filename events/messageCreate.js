import { getCooldown, setCooldown } from "../handlers/functions.js";
import { client } from "../bot.js";

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

    const command =
      client.mcommands.get(cmd) ||
      client.mcommands.find(
        (cmds) => cmds.aliases && cmds.aliases.includes(cmd)
      );
    if (!command) return;

    const { owneronly = false, userPermissions = [], botPermissions = [] } = command;
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

    // Skip cooldown check for owners
    const isOwner = client.config.Owners.includes(author.id);

    // Check command cooldown without applying it yet (only for non-owners)
    if (!isOwner) {
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
    }

    // Check for gambling command and handle session
    let isGamblingCommand = command.gambling === true;
    if (isGamblingCommand) {
      if (client.activeGambleSessions.has(message.author.id)) {
        return client.sendEmbed(
          message,
          "You already have an active gambling session. Please finish it before starting a new one."
        );
      }
      // Start the gambling session with automatic timeout
      client.startGamblingSession(message.author.id, message);
    }

    try {
      // Execute the command.
      const shouldSetCooldown = await command.run({
        client,
        message,
        args,
        prefix,
      });

      // Only apply cooldown for non-owners
      if (
        !isOwner &&
        shouldSetCooldown !== false &&
        !command.noCooldownOnFail
      ) {
        if (command.cooldown) {
          // Apply the command's defined cooldown
          await setCooldown(message, command);
        } else {
          // Apply a default 5-second cooldown for commands without defined cooldown
          await setCooldown(message, { ...command, cooldown: 5 });
        }
      }
    } catch (error) {
      console.error("Command error:", error);
      await client.sendEmbed(
        message,
        "An error occurred while executing that command. The cooldown will not be applied."
      );
    } finally {
      // If it was a gambling command, end the session
      // Notice we don't automatically end it here anymore!
      // The command itself should call client.endGamblingSession when done
      if (isGamblingCommand && command.autoEndGamblingSession !== false) {
        client.endGamblingSession(message.author.id);
      }
    }
  } catch (error) {
    console.error(
      "An error occurred while processing messageCreate event:",
      error
    );
  }
});

function escapeRegex(newPrefix) {
  return newPrefix?.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`);
}
