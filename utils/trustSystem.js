import { GuildMember, PermissionsBitField } from "discord.js";

// Time constants in milliseconds
const ONE_HOUR = 3600000;
const ONE_DAY = ONE_HOUR * 24;

// Configuration constants
const TRUSTED_ROLE_IDS = ["902045721983844382", "902045721983844382"]; // Update with actual role IDs
const NEW_USER_THRESHOLD_HOURS = 24;

/**
 * Calculate user's trust level based on various factors
 * @param {GuildMember} member Discord guild member
 * @returns {Object} Trust analysis results
 */
export const analyzeTrust = async (member) => {
  const { user, guild, joinedTimestamp } = member;
  const now = Date.now();

  // Calculate time-based metrics
  const accountAge = now - user.createdTimestamp;
  const serverAge = now - joinedTimestamp;
  const isNewMember = serverAge < ONE_DAY * 2; // Less than 2 days
  const isNewAccount = accountAge < ONE_DAY * 7; // Less than 7 days

  // Check for trusted roles
  const hasTrustedRole = member.roles.cache.some((role) =>
    TRUSTED_ROLE_IDS.includes(role.id)
  );

  // Calculate base trust score (0-100)
  let trustScore = 50; // Start at neutral

  // Account age factor (up to +20)
  trustScore += Math.min(20, Math.floor(accountAge / (ONE_DAY * 30))); // +1 per month up to 20

  // Server membership length factor (up to +15)
  trustScore += Math.min(15, Math.floor(serverAge / (ONE_DAY * 14))); // +1 per 2 weeks up to 15

  // Role-based trust (up to +15)
  if (hasTrustedRole) {
    trustScore += 15;
  }

  // Normalize score to 0-100 range
  trustScore = Math.max(0, Math.min(100, trustScore));

  return {
    trustScore,
    isNewMember,
    isNewAccount,
    hasTrustedRole,
    accountAgeDays: Math.floor(accountAge / ONE_DAY),
    serverAgeDays: Math.floor(serverAge / ONE_DAY),
    thresholdMultiplier: calculateThresholdMultiplier(trustScore),
  };
};

/**
 * Calculate threshold multiplier based on trust score
 * @param {number} trustScore User's trust score (0-100)
 * @returns {number} Threshold multiplier for spam detection
 */
function calculateThresholdMultiplier(trustScore) {
  if (trustScore >= 80) return 1.5; // More lenient for trusted users
  if (trustScore <= 30) return 0.7; // Stricter for untrusted users
  return 1.0; // Normal thresholds
}

/**
 * Check if a user should be exempt from spam detection
 * @param {GuildMember} member Discord guild member
 * @returns {boolean} Whether user should be exempt
 */
export const isUserExempt = (member) => {
  // Exempt administrators using proper permission flag
  if (member.permissions.has(PermissionsBitField.Flags.Administrator))
    return true;

  // Exempt users with trusted roles
  return member.roles.cache.some((role) => TRUSTED_ROLE_IDS.includes(role.id));
};

// Export configuration for external use
export const trustConfig = {
  TRUSTED_ROLE_IDS,
  NEW_USER_THRESHOLD_HOURS,
};
