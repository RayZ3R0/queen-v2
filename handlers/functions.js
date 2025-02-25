import Cooldown from "../schema/cooldown.js";

/**
 * Checks the command cooldown for the given user.
 * @param {Object} message - The message object from Discord.
 * @param {Object} cmd - The command object containing cooldown information.
 * @returns {number | false} Seconds left on cooldown or false if not on cooldown.
 */
export async function getCooldown(message, cmd) {
  if (!message || !cmd) return false;

  const now = Date.now();
  const cooldownAmount = cmd.cooldown * 1000; // cooldown in milliseconds
  const userID = message.member.id;

  const record = await Cooldown.findOne({ userID, commandName: cmd.name });
  if (record) {
    const lastUsed = parseInt(record.cooldown, 10);
    if (now < lastUsed + cooldownAmount) {
      const timeLeft = (lastUsed + cooldownAmount - now) / 1000;
      return timeLeft;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

/**
 * Sets/updates the command cooldown for the given user.
 * @param {Object} message - The message object from Discord.
 * @param {Object} cmd - The command object containing cooldown information.
 */
export async function setCooldown(message, cmd) {
  if (!message || !cmd) return;
  const now = Date.now();
  const userID = message.member.id;

  let record = await Cooldown.findOne({ userID, commandName: cmd.name });
  if (record) {
    record.cooldown = now.toString();
    await record.save();
  } else {
    record = new Cooldown({
      userID,
      commandName: cmd.name,
      cooldown: now.toString(),
    });
    await record.save();
  }
}
