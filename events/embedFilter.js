import { client } from "../bot.js";
import { EmbedBuilder } from "discord.js";
import levelModel from "../schema/level.js";

client.on("messageCreate", async (message) => {
  try {
    // Ignore bot messages or messages outside a guild
    if (message.author.bot || !message.guild) return;

    // Check if message is in the specified category
    if (message.channel.parentId !== "747483802741506130") return;

    // Check if message contains embeds, links, or attachments
    const hasEmbed = message.embeds && message.embeds.length > 0;
    const hasLink = /(https?:\/\/[^\s]+)/g.test(message.content);
    const hasAttachment = message.attachments && message.attachments.size > 0;
    
    if (!hasEmbed && !hasLink && !hasAttachment) return;

    // Check if user has the required role
    const requiredRoleId = "1011566110354710650";
    if (message.member.roles.cache.has(requiredRoleId)) return;

    // Check user's level
    const levelData = await levelModel.findOne({ 
      user: message.author.id, 
      guild: message.guild.id 
    });
    
    const userLevel = levelData ? levelData.level : 0;
    
    if (userLevel >= 5) return;

    // Send warning message
    const warningEmbed = new EmbedBuilder()
      .setColor("#FFA500")
      .setDescription(
        `👋 Hi ${message.author}! To send embeds, links, or images in this category, you need to be **Level 5**. ` +
        `Keep chatting to level up! 💬✨`
      );

    try {
      const responseMessage = await message.channel.send({ 
        embeds: [warningEmbed] 
      });

      // Auto-delete the bot's message after 2 minutes
      setTimeout(() => {
        responseMessage.delete().catch(console.error);
      }, 120000); // 2 minutes in milliseconds
    } catch (sendError) {
      console.error("Failed to send warning message:", sendError);
    }

  } catch (error) {
    console.error("Error in embedFilter event:", error);
  }
});
