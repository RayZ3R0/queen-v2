import { EmbedBuilder } from "discord.js";
import axios from "axios";

/**
 * Extract Discord invite code from URL or text
 * @param {string} text - Text containing invite link
 * @returns {string|null} - Invite code or null
 */
export function extractInviteCode(text) {
  const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/([a-zA-Z0-9-]+)/gi;
  const match = inviteRegex.exec(text);
  return match ? match[1] : null;
}

/**
 * Validate and fetch invite information
 * @param {Client} client - Discord client
 * @param {string} inviteCode - Invite code to validate
 * @returns {Object|null} - Invite data or null if invalid
 */
export async function validateInvite(client, inviteCode) {
  try {
    const invite = await client.fetchInvite(inviteCode);
    
    if (!invite || !invite.guild) {
      return null;
    }

    return {
      code: invite.code,
      url: invite.url,
      guildId: invite.guild.id,
      guildName: invite.guild.name,
      guildIcon: invite.guild.iconURL({ size: 512 }),
      memberCount: invite.memberCount || invite.approximateMemberCount || 0,
      description: invite.guild.description || "",
      expiresAt: invite.expiresAt,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Create partnership embed
 * @param {Object} partnershipData - Partnership data
 * @param {boolean} isExpired - Whether partnership is expired
 * @returns {EmbedBuilder}
 */
export function createPartnershipEmbed(partnershipData, isExpired = false) {
  const embed = new EmbedBuilder()
    .setColor(isExpired ? "#ff6b6b" : "#5865F2")
    .setTitle(`${isExpired ? "⚠️ " : ""}${partnershipData.guildName}`)
    .setDescription(partnershipData.description || "No description available")
    .addFields(
      { name: "Members", value: `${partnershipData.memberCount || "Unknown"}`, inline: true },
      { name: "Added", value: `<t:${Math.floor(new Date(partnershipData.addedAt).getTime() / 1000)}:R>`, inline: true }
    )
    .setFooter({ text: `Partnership • Added by ${partnershipData.addedBy}` })
    .setTimestamp();

  if (partnershipData.guildIcon) {
    embed.setThumbnail(partnershipData.guildIcon);
  }

  if (isExpired) {
    embed.addFields({ name: "Status", value: "❌ Invite Expired", inline: false });
  }

  return embed;
}

/**
 * Create join button for partnership
 * @param {string} inviteUrl - Invite URL
 * @returns {ActionRowBuilder}
 */
export async function createPartnershipButton(inviteUrl) {
  const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = await import("discord.js");
  
  const button = new ButtonBuilder()
    .setLabel("Join")
    .setStyle(ButtonStyle.Link)
    .setURL(inviteUrl);

  return new ActionRowBuilder().addComponents(button);
}

/**
 * Extract all invite codes from a message
 * @param {string} content - Message content
 * @returns {string[]} - Array of invite codes
 */
export function extractAllInvites(content) {
  const inviteRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/([a-zA-Z0-9-]+)/gi;
  const invites = [];
  let match;
  
  while ((match = inviteRegex.exec(content)) !== null) {
    invites.push(match[1]);
  }
  
  return invites;
}

/**
 * Check if user has required role
 * @param {GuildMember} member - Guild member
 * @param {string} requiredRoleId - Required role ID
 * @returns {boolean}
 */
export function hasPartnershipPermission(member, requiredRoleId = "920210140093902868") {
  return member.roles.cache.has(requiredRoleId) || member.permissions.has("Administrator");
}
