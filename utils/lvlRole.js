import levelModel from "../schema/level.js";
import lvlRoleModel from "../schema/levelrole.js";

/**
 * Assign level roles to a user based on their current level.
 *
 * @param {import("discord.js").Message} message - The Discord message object.
 * @param {string} userID - The ID of the user.
 * @param {string} guildID - The ID of the guild.
 */
export default async function lvlRole(message, userID, guildID) {
  // Retrieve all level role records for the guild.
  const levelRoleRecords = await lvlRoleModel.find({ gid: guildID });
  if (!levelRoleRecords || levelRoleRecords.length === 0) return; // No level roles are set

  // Get the user's level data from the database.
  let userData = await levelModel.findOne({ user: userID, guild: guildID });
  if (!userData) {
    // If the user doesn't exist, create a new record and exit.
    const newUserData = new levelModel({
      user: userID,
      guild: guildID,
    });
    await newUserData
      .save()
      .catch(() => console.log("[XP] Failed to save new user to database"));
    // Since there's no level data yet, we cannot assign roles.
    return;
  }

  // Loop through each level role record.
  for (const roleRecord of levelRoleRecords) {
    // Each record holds an array of level-role assignments.
    const roleEntries = roleRecord.lvlrole;
    for (const roleEntry of roleEntries) {
      // Check if the user's level meets or exceeds the required level.
      if (userData.level >= Number(roleEntry.lvl)) {
        // Get the guild member from the cache.
        const member = message.guild.members.cache.get(userID);
        if (!member) continue; // Skip if member is not found

        // Find the role in the guild using the role ID.
        const guildRole = message.guild.roles.cache.get(roleEntry.role);
        if (!guildRole) continue; // Role not found in guild

        // Add the role if the member doesn't already have it.
        if (!member.roles.cache.has(guildRole.id)) {
          member.roles.add(guildRole).catch(() => {
            message.channel.send(
              "[XP] ERROR: Role is higher than me or I'm missing permissions."
            );
          });
        }
      }
    }
  }
}
