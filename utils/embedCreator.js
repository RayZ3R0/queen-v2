import { EmbedBuilder } from "discord.js";

/**
 * Creates a standardized bump reminder embed
 * @param {string} roleId The ID of the role to mention for bump reminders
 * @param {Date} lastBumpTime The timestamp of the last successful bump
 * @returns {EmbedBuilder} The formatted embed ready to send
 */
export function createBumpReminderEmbed(roleId, lastBumpTime) {
  return new EmbedBuilder()
    .setColor(0x00ffff)
    .setTitle("🔥 Time to Bump! 🔥")
    .setDescription(`Hey <@&${roleId}>! It's time to bump the server again!`)
    .addFields(
      {
        name: "Command",
        value: "Use </bump:1234> to bump the server",
        inline: true,
      },
      {
        name: "Last Bump",
        value: `<t:${Math.floor(lastBumpTime.getTime() / 1000)}:R>`,
        inline: true,
      }
    )
    .setFooter({ text: "Thank you for supporting our server growth!" })
    .setTimestamp();
}

/**
 * Creates a standardized bump status embed
 * @param {Object} bumpData The bump data from the database
 * @returns {EmbedBuilder} The formatted embed ready to send
 */
export function createBumpStatusEmbed(bumpData) {
  const embed = new EmbedBuilder()
    .setColor(0x00ffff)
    .setTitle("🔔 Server Bump Status")
    .setTimestamp();

  if (!bumpData || !bumpData.lastBumped) {
    return embed
      .setDescription(
        "This server hasn't been bumped yet, or the last bump wasn't recorded."
      )
      .setFooter({ text: "Use /bump to bump the server for the first time!" });
  }

  const now = new Date();
  const nextBumpTime = new Date(bumpData.nextBumpTime);
  const timeLeft = nextBumpTime - now;

  if (timeLeft <= 0) {
    return embed
      .setDescription("✅ The server can be bumped now!")
      .setColor(0x00ff00)
      .addFields(
        {
          name: "Last Bumped",
          value: `<t:${Math.floor(bumpData.lastBumped.getTime() / 1000)}:R>`,
          inline: true,
        },
        {
          name: "Action Required",
          value: "Use </bump:1234> to bump the server",
          inline: true,
        }
      )
      .setFooter({ text: "Thank you for supporting our server growth!" });
  } else {
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    return embed
      .setDescription("⏳ The server is on cooldown")
      .setColor(0xffaa00)
      .addFields(
        {
          name: "Last Bumped",
          value: `<t:${Math.floor(bumpData.lastBumped.getTime() / 1000)}:R>`,
          inline: true,
        },
        {
          name: "Next Bump Available",
          value: `<t:${Math.floor(nextBumpTime.getTime() / 1000)}:R>`,
          inline: true,
        },
        { name: "Time Remaining", value: `${hours}h ${minutes}m`, inline: true }
      )
      .setFooter({
        text: "A reminder will be sent when it's time to bump again",
      });
  }
}
