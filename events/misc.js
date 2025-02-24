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
