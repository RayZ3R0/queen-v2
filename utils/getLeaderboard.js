import levelModel from "../schema/level.js";

/**
 * Retrieves leaderboard data from the level database.
 *
 * @param {import('discord.js').Client} client - The Discord client.
 * @param {string} guildID - The guild ID.
 * @returns {Promise<Array>} An array of leaderboard entries.
 */
export default async function getLeaderboard(client, guildID) {
  if (!guildID) throw new Error("[XP] Guild ID was not provided.");

  const guild = client.guilds.cache.get(guildID);
  if (!guild) throw new Error("[XP] Guild was not found.");

  // Retrieve level data sorted descending by XP.
  const data = await levelModel
    .find({ guild: guildID })
    .sort({ xp: -1 })
    .exec();
  const led = [];

  function shortener(count) {
    const COUNT_ABBRS = ["", "k", "M", "T"];
    const i = count === 0 ? 0 : Math.floor(Math.log(count) / Math.log(1000));
    let result = parseFloat((count / Math.pow(1000, i)).toFixed(2));
    result += COUNT_ABBRS[i];
    return result;
  }

  const promises = data.map(async (entry) => {
    const member = await guild.members.fetch(entry.user).catch(() => null);
    if (!member) {
      // If the member is not found, delete the entry from the DB.
      await levelModel.deleteOne({ user: entry.user, guild: guildID });
      return;
    }
    if (entry.xp === 0) return;
    const position = data.indexOf(entry) + 1;
    led.push({
      guildID: entry.guild,
      userID: entry.user,
      xp: entry.xp,
      shortxp: shortener(entry.xp),
      level: entry.level,
      position,
      username: member.user.username,
      tag: member.user.tag,
    });
  });

  await Promise.all(promises);
  return led;
}
