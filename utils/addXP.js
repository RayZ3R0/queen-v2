import levelModel from "../schema/level.js";
import roleSetup from "./roleSetup.js";
/**
 * Adds XP to a user.
 * @param {import("discord.js").Message} message
 * @param {string} userID
 * @param {string} guildID
 * @param {object} xp - Either a number or an object with {min, max} properties.
 * @throws Will throw an error if userID, guildID, or xp is not provided (or if numeric conversion fails).
 */
export default async function addXP(message, userID, guildID, xp) {
  if (!userID) throw new Error("[XP] User ID was not provided.");
  if (!guildID) throw new Error("[XP] Guild ID was not provided.");
  if (!xp) throw new Error("[XP] XP amount is not provided.");

  // If xp is provided as an object with min and max, pick a random value
  let min, max;
  if (xp.min) {
    if (!xp.max)
      throw new Error(
        "[XP] XP min amount is provided but max amount is not provided."
      );
    min = Number(xp.min);
    if (isNaN(min)) throw new Error("[XP] XP amount (min) is not a number.");
  }
  if (xp.max) {
    if (!xp.min)
      throw new Error(
        "[XP] XP max amount is provided but min amount is not provided."
      );
    max = Number(xp.max);
    if (isNaN(max)) throw new Error("[XP] XP amount (max) is not a number.");
  }
  if (xp.min && xp.max) {
    xp = Math.floor(Math.random() * (max - min) + min);
  } else if (typeof xp === "object") {
    xp = Number(xp) || 0;
  }

  // Look up user data in the level database.
  const userData = await levelModel.findOne({ user: userID, guild: guildID });
  // Calculate initial level from the added xp (this formula can be adjusted)
  let lvl = Math.floor(0.1 * Math.sqrt(xp));

  // If no record exists then create one.
  if (!userData) {
    const newUser = new levelModel({
      user: userID,
      guild: guildID,
      xp: xp,
      level: lvl,
    });
    await newUser
      .save()
      .catch(() => console.log("[XP] Failed to save new user to database"));
    return { level: 0, xp: 0 };
  }

  let previousLevel = userData.level;
  userData.xp += parseInt(xp, 10);
  userData.level = Math.floor(0.1 * Math.sqrt(userData.xp));

  await userData
    .save()
    .catch((e) =>
      console.log(`[XP] Failed to add XP | User: ${userID} | Err: ${e}`)
    );

  let updatedLevel = userData.level;
  let updatedXP = userData.xp;

  if (userData.xp === 0 || Math.sign(userData.xp) === -1) {
    updatedXP = 0;
  }

  // If level has increased then trigger the levelUp event.
  if (previousLevel !== updatedLevel) {
    const data = {
      xp: updatedXP,
      level: updatedLevel,
      userID,
      guildID,
    };
    // roleSetup.find should retrieve the appropriate level role for the new level.
    let role = await roleSetup.find(client, guildID, updatedLevel);
    client.emit("levelUp", message, data, role);
  }

  return { level: updatedLevel, xp: updatedXP };
}
