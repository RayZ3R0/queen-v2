import { client } from "../bot.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
} from "discord.js";

// Role IDs allowed to send embeds, links, or attachments
const LEVEL_2_ROLE_ID = "1547324129189822484";
const BOOSTER_ROLE_ID = "927097726934601729";
const MOD_ROLE_ID = "920210140093902868";

const ALLOWED_ROLES = [LEVEL_2_ROLE_ID, BOOSTER_ROLE_ID, MOD_ROLE_ID];

client.on("messageCreate", async (message) => {
  try {
    // Ignore bot messages or messages outside a guild
    if (message.author.bot || !message.guild) return;

    // Check if message contains embeds, links, or attachments
    const hasEmbed = message.embeds && message.embeds.length > 0;
    const hasLink = /(https?:\/\/[^\s]+)/i.test(message.content);
    const hasAttachment = message.attachments && message.attachments.size > 0;

    if (!hasEmbed && !hasLink && !hasAttachment) return;

    // Ensure member is available
    const member =
      message.member ||
      (await message.guild.members.fetch(message.author.id).catch(() => null));
    if (!member) return;

    // Bypass check: Administrators, Server Boosters, Mods, and Level 2 role holders
    if (
      member.permissions.has(PermissionsBitField.Flags.Administrator) ||
      ALLOWED_ROLES.some((roleId) => member.roles.cache.has(roleId))
    ) {
      return;
    }

    // Send warning message
    const warningEmbed = new EmbedBuilder()
      .setColor("#FFA500")
      .setDescription(
        `Hi ${message.author}, to send embeds, links, or attachments, you need to be **Level 2** or higher. ` +
        `Please continue chatting to increase your level.`
      );

    const deleteButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`delete_embed_warn_${message.author.id}`)
        .setLabel("Delete")
        .setEmoji("🗑️")
        .setStyle(ButtonStyle.Secondary)
    );

    try {
      const responseMessage = await message.channel.send({
        embeds: [warningEmbed],
        components: [deleteButton],
      });

      // Auto-delete the bot's message after 2 minutes
      setTimeout(() => {
        responseMessage.delete().catch(() => {});
      }, 120000); // 2 minutes in milliseconds
    } catch (sendError) {
      console.error("Failed to send warning message in embedFilter:", sendError);
    }
  } catch (error) {
    console.error("Error in embedFilter event:", error);
  }
});

