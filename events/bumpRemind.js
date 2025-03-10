import { client } from "../bot.js";
import bumpSchema from "../schema/bump.js";
import { EmbedBuilder } from "discord.js";

// Constants
const BUMP_CHANNEL_ID = "747780089151881258";
const DISBOARD_BOT_ID = "302050872383242240";
const REMINDER_ROLE_ID = "903144348647055410";
const TWO_HOURS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

client.on("messageCreate", async (message) => {
  // Only check messages in the bump channel from DISBOARD bot
  if (
    message.channel.id !== BUMP_CHANNEL_ID ||
    message.author.id !== DISBOARD_BOT_ID
  ) {
    return;
  }

  // Check if the message is a successful bump
  const isBumpSuccess =
    message.embeds.length > 0 &&
    message.embeds[0].description &&
    message.embeds[0].description.includes("Bump done!");

  if (!isBumpSuccess) return;

  const guildId = message.guild.id;
  const now = new Date();

  // Check if there's an existing bump within the last 2 hours
  const existingBump = await bumpSchema.findOne({
    guildId: guildId,
    lastBumped: { $gt: new Date(now.getTime() - TWO_HOURS) },
  });

  // If there's already a bump registered within the cooldown period, ignore this one
  if (existingBump) {
    console.log(
      `Ignoring bump as server was already bumped within last 2 hours`
    );
    return;
  }

  const nextBumpTime = new Date(now.getTime() + TWO_HOURS);

  try {
    // Update or create bump document
    await bumpSchema.findOneAndUpdate(
      { guildId: guildId },
      {
        guildId: guildId,
        channelId: BUMP_CHANNEL_ID,
        lastBumped: now,
        nextBumpTime: nextBumpTime,
        isReminded: false,
      },
      { upsert: true, new: true }
    );

    console.log(
      `Bump detected! Next bump scheduled for ${nextBumpTime.toLocaleString()}`
    );
  } catch (error) {
    console.error("Error updating bump data:", error);
  }
});

// Check for due reminders every minute
setInterval(async () => {
  try {
    const now = new Date();
    // Find bumps that need reminders
    const bumpsToRemind = await bumpSchema.find({
      nextBumpTime: { $lte: now },
      isReminded: false,
    });

    for (const bump of bumpsToRemind) {
      try {
        const guild = client.guilds.cache.get(bump.guildId);
        if (!guild) continue;

        const channel = guild.channels.cache.get(bump.channelId);
        if (!channel) continue;

        // Create a pretty embed for the reminder
        const reminderEmbed = new EmbedBuilder()
          .setColor(0x00ffff)
          .setTitle("🔥 Time to Bump! 🔥")
          .setDescription(
            `Hey <@&${REMINDER_ROLE_ID}>! It's time to bump the server again!`
          )
          .addFields(
            {
              name: "Command",
              value: "Use </bump:1234> to bump the server",
              inline: true,
            },
            {
              name: "Last Bump",
              value: `<t:${Math.floor(bump.lastBumped.getTime() / 1000)}:R>`,
              inline: true,
            }
          )
          .setFooter({ text: "Thank you for supporting our server growth!" })
          .setTimestamp();

        // Send reminder with embed
        await channel.send({
          content: `<@&${REMINDER_ROLE_ID}>`,
          embeds: [reminderEmbed],
        });

        // Update reminder status
        await bumpSchema.findOneAndUpdate(
          { guildId: bump.guildId },
          { isReminded: true }
        );

        console.log(`Sent bump reminder in guild ${bump.guildId}`);
      } catch (innerError) {
        console.error(
          `Failed to send reminder for guild ${bump.guildId}:`,
          innerError
        );
      }
    }
  } catch (error) {
    console.error("Error in bump reminder check interval:", error);
  }
}, 60 * 1000); // Check every minute
