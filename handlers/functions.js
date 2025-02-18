import Cooldown from "../schema/cooldown.js";

/**
 * Checks and updates command cooldown in the database.
 * @param {Object} message - The message object from Discord.
 * @param {Object} cmd - The command object containing cooldown information.
 * @returns {number | false} Seconds left on cooldown or false if not on cooldown.
 */
export async function cooldown(message, cmd) {
  if (!message || !cmd) return false;

  const now = Date.now();
  const cooldownAmount = cmd.cooldown * 1000; // cooldown in milliseconds
  const userID = message.member.id;

  // Find the cooldown record for this user and command
  let record = await Cooldown.findOne({ userID, commandName: cmd.name });
  if (record) {
    const lastUsed = parseInt(record.cooldown, 10);
    // If current time is still within the cooldown window, return time left
    if (now < lastUsed + cooldownAmount) {
      const timeLeft = (lastUsed + cooldownAmount - now) / 1000;
      return timeLeft;
    } else {
      // Otherwise, update the timestamp and allow execution
      record.cooldown = now.toString();
      await record.save();
      return false;
    }
  } else {
    // If no record exists, create one
    record = new Cooldown({
      userID,
      commandName: cmd.name,
      cooldown: now.toString(),
    });
    await record.save();
    return false;
  }
}
