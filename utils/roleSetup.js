import lrole from "../schema/levelrole.js";

class roleSetup {
  /**
   * @param {import("discord.js").Client} client
   * @param {string} guildID
   * @param {object} options - { level: number, role: string }
   */
  static async add(client, guildID, options = {}) {
    const guild = client.guilds.cache.get(guildID) || (await client.guilds.fetch(guildID).catch(() => null));
    if (!guild) {
      throw new Error(`Guild with ID ${guildID} not found.`);
    }

    const role =
      guild.roles.cache.get(options.role) ||
      (await guild.roles.fetch(options.role).catch(() => null));

    if (!role) {
      throw new Error(
        `Role ID is invalid or not found. | Guild ID: ${guildID} | Role ID: ${options.role}`
      );
    }

    const level = Number(options.level);
    if (isNaN(level) || level < 0) {
      throw new Error("Invalid level number specified.");
    }

    let doc = await lrole.findOne({ gid: guildID });
    if (!doc) {
      doc = new lrole({
        gid: guildID,
        lvlrole: [],
      });
    }

    if (!Array.isArray(doc.lvlrole)) {
      doc.lvlrole = [];
    }

    // Check if level already exists
    const existingIndex = doc.lvlrole.findIndex(
      (item) => Number(item.lvl) === level
    );

    let updated = false;
    if (existingIndex !== -1) {
      doc.lvlrole[existingIndex].role = role.id;
      updated = true;
    } else {
      doc.lvlrole.push({ lvl: level, role: role.id });
    }

    // Keep level roles sorted ascending by level
    doc.lvlrole.sort((a, b) => Number(a.lvl) - Number(b.lvl));
    doc.markModified("lvlrole");
    await doc.save();

    return { updated, level, role };
  }

  /**
   * @param {import("discord.js").Client} client
   * @param {string} guildID
   * @param {object} options - { level: number }
   */
  static async remove(client, guildID, options = {}) {
    const level = Number(options.level);
    if (isNaN(level) || level < 0) {
      throw new Error("Invalid level number specified.");
    }

    const doc = await lrole.findOne({ gid: guildID });
    if (!doc || !Array.isArray(doc.lvlrole) || doc.lvlrole.length === 0) {
      throw new Error("No level roles configured for this server.");
    }

    const existingIndex = doc.lvlrole.findIndex(
      (item) => Number(item.lvl) === level
    );

    if (existingIndex === -1) {
      throw new Error(`No level role found for level ${level}.`);
    }

    const removedEntry = doc.lvlrole.splice(existingIndex, 1)[0];
    doc.markModified("lvlrole");
    await doc.save();

    return removedEntry;
  }

  /**
   * @param {import("discord.js").Client} client
   * @param {string} guildID
   */
  static async fetch(client, guildID) {
    let rol = await lrole.find({ gid: guildID });
    if (!rol || rol.length === 0) return;
    return rol[0].lvlrole;
  }

  /**
   * @param {import("discord.js").Client} client
   * @param {string} guildID
   * @param {number|string} level
   */
  static async find(client, guildID, level) {
    let rol = await lrole.find({ gid: guildID });
    if (!rol || !rol.length) return;
    rol = rol[0].lvlrole.filter((i) => i.lvl == level) || undefined;
    if (rol) {
      return rol;
    }
  }
}

export default roleSetup;
