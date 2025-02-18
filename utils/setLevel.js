import levelModel from "../schema/level.js";
import roleSetup from "./roleSetup.js";

/**
 * Sets the level for a user in a guild.
 *
 * @param {import("discord.js").Message} message - The Discord message object.
 * @param {string} userID - The user's ID.
 * @param {string} guildID - The guild's ID.
 * @param {number} level - The desired level.
 * @returns {Promise<{ level: number, xp: number }>} The updated level and xp.
 * @throws Will throw an error if userID, guildID, or level are not provided.
 */
async function setLevel(message, userID, guildID, level) {
  if (!userID) throw new Error("[XP] User ID was not provided.");
  if (!guildID) throw new Error("[XP] Guild ID was not provided.");
  if (level === undefined || level === null)
    throw new Error("[XP] Level amount is not provided.");

  const { client } = message;
  let userDoc = await levelModel
    .findOne({ user: userID, guild: guildID })
    .exec();

  // If the user has no entry yet, create a new one
  if (!userDoc) {
    userDoc = new levelModel({
      user: userID,
      guild: guildID,
      xp: 0,
      level: 0,
    });

    await userDoc
      .save()
      .catch(() => console.log("[XP] Failed to save new user to database"));

    const xp = (level * 10) ** 2;
    return {
      level: level,
      xp: xp,
    };
  }

  const previousLevel = userDoc.level;
  // Update user's xp and recalc level
  userDoc.xp = (level * 10) ** 2;
  userDoc.level = Math.floor(0.1 * Math.sqrt(userDoc.xp));

  await userDoc
    .save()
    .catch((e) =>
      console.log(`[XP] Failed to set Level | User: ${userID} | Err: ${e}`)
    );

  // If level has changed, fetch the role (if any) and emit levelUp event.
  if (previousLevel !== userDoc.level) {
    const data = {
      xp: userDoc.xp,
      level: userDoc.level,
      userID,
      guildID,
    };

    try {
      const role = await roleSetup.find(client, guildID, level);
      client.emit("levelUp", message, data, role);
    } catch (e) {
      console.log(`[XP] Failed to fetch role via roleSetup: ${e}`);
    }
  }

  return {
    level: userDoc.level,
    xp: userDoc.xp,
  };
}

export default setLevel;
