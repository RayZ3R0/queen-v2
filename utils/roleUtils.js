import { EmbedBuilder } from "discord.js";

const LEVEL_ROLES_DIVIDER = "--------------𝓛𝓮𝓿𝓮𝓵 𝓡𝓸𝓵𝓮𝓼--------------";

/**
 * Set role position above level roles divider
 * @param {Role} role - The role to position
 * @param {Guild} guild - The guild object
 * @returns {Promise<Role>} - The updated role
 */
export async function setRoleAboveDivider(role, guild) {
  try {
    const dividerRole = guild.roles.cache.find(
      (r) => r.name === LEVEL_ROLES_DIVIDER
    );

    if (!dividerRole) {
      throw new Error("Could not find level roles divider");
    }

    await role.setPosition(dividerRole.position + 1);
    return role;
  } catch (error) {
    console.error("Error setting role position:", error);
    throw error;
  }
}

/**
 * Find the level roles divider position
 * @param {Guild} guild - The guild object
 * @returns {Promise<Role>} - The divider role
 */
export async function findDividerRole(guild) {
  const dividerRole = guild.roles.cache.find(
    (r) => r.name === LEVEL_ROLES_DIVIDER
  );

  if (!dividerRole) {
    throw new Error("Could not find level roles divider");
  }

  return dividerRole;
}

/**
 * Create error embed for role management
 * @param {string} message - The error message
 * @returns {EmbedBuilder} - The error embed
 */
export function createRoleErrorEmbed(message) {
  return new EmbedBuilder()
    .setColor("Red")
    .setTitle("Role Management Error")
    .setDescription(message)
    .setTimestamp();
}

/**
 * Create success embed for role management
 * @param {string} message - The success message
 * @returns {EmbedBuilder} - The success embed
 */
export function createRoleSuccessEmbed(message) {
  return new EmbedBuilder()
    .setColor("Green")
    .setTitle("Role Management Success")
    .setDescription(message)
    .setTimestamp();
}

// Export the divider name for consistency
export { LEVEL_ROLES_DIVIDER };
