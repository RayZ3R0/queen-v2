import { client } from "../bot.js";
import { EmbedBuilder } from "discord.js";
import spiritSchema from "../schema/spirits.js";
import profileSchema from "../schema/profile.js";
import translate from "@iamtraction/google-translate";

// --------------------- Update Spirit Happiness --------------------- //
client.on("messageCreate", async (message) => {
  try {
    // Ignore messages from bots or commands (e.g. those starting with ';')
    if (message.author.bot || message.content.startsWith(";")) return;

    // Retrieve the user's profile and selected spirit.
    const profile = await profileSchema.findOne({ userid: message.author.id });
    if (!profile) return;

    const spirit = await spiritSchema.findOne({ id: profile.selected });
    if (!spirit) return;

    // Deduct 0.25 happiness (ensuring it does not drop below 0)
    const updatedHappiness = spirit.happiness - 0.25;
    await spiritSchema.findOneAndUpdate(
      { id: profile.selected },
      { happiness: updatedHappiness >= 0 ? updatedHappiness : 0 }
    );
  } catch (error) {
    console.error("Error in spirit happiness update:", error);
  }
});

// --------------------- Translate Messages --------------------- //
client.on("messageCreate", async (message) => {
  try {
    // Only process messages from the designated source channel.
    if (message.channel.id !== "901338477021499413") return;

    // Retrieve the target channel for translated messages.
    const targetChannel =
      message.guild.channels.cache.get("978577409353863168");
    if (!targetChannel) return;

    const targetLanguage = "en";
    const originalText = message.content;

    // Translate the content using Google's translate API.
    const translationResult = await translate(originalText, {
      to: targetLanguage,
    });

    // Build the translation embed with proper footer and fields.
    const translationEmbed = new EmbedBuilder()
      .setFooter({
        text: message.author.username,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .addFields(
        { name: "Original Message:", value: `\`\`\`${originalText}\`\`\`` },
        {
          name: "Translated Message:",
          value: `\`\`\`${translationResult.text}\`\`\``,
        }
      )
      .setColor("Random")
      .setTimestamp();

    // Send the embed to the target channel.
    await targetChannel.send({ embeds: [translationEmbed] });
  } catch (error) {
    console.error("Error in translation handler:", error);
  }
});

// --------------------- Partnership Check --------------------- //
client.on("messageCreate", async (message) => {
  try {
    // Ignore messages from bots or commands (e.g. those starting with ';')
    if (message.author.bot || message.content.startsWith(";")) return;

    // Ignore if the message is in the specified category
    if (message.channel.parentId === "968036263678591036") return;

    // Check if the message contains "partnership", "partnerships", or "partner" (case-insensitive)
    const lowerContent = message.content.toLowerCase();
    if (
      lowerContent.includes("partnership") ||
      lowerContent.includes("partnerships") ||
      lowerContent.includes("partner")
    ) {
      // Send the response message
      const responseMessage = await message.channel.send(
        "Please check <#1026411687089274910> first."
      );

      // Delete the bot's message after 1 minute (60,000 milliseconds)
      setTimeout(() => {
        responseMessage.delete().catch(console.error);
      }, 60000);
    }
  } catch (error) {
    console.error("Error in partnership check:", error);
  }
});
