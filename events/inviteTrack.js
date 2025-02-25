import { EmbedBuilder } from "discord.js";
import { initInviteTracker } from "../utils/inviteTracker.js";

// The channel ID where invite logs should be sent.
const LOG_CHANNEL_ID = "901818838381891624";

/**
 * Initializes the invite tracker and sets up event listeners
 * to log invite-related events to the specified channel.
 * @param {import("discord.js").Client} client - Your Discord client.
 */
export default (client) => {
  // Initialize the invite tracker.
  const tracker = initInviteTracker(client, {
    fetchGuilds: true,
    fetchVanity: true,
  });

  // When a new member joins, log the invite used.
  tracker.on("guildMemberAdd", async (member, type, inviteUsed) => {
    try {
      const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (!logChannel) return;
      let inviter = "Unknown";
      if (type === "normal" && inviteUsed && inviteUsed.inviter) {
        inviter = `<@${inviteUsed.inviter}>`;
      } else if (type === "vanity") {
        inviter = "Vanity Invite";
      }
      const embed = new EmbedBuilder()
        .setTitle("Invite Tracker: Member Joined")
        .setDescription(`${member} joined using **${inviter}**.`)
        .addFields({ name: "Join Type", value: type, inline: true })
        .setColor("Blue")
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error("Error handling guildMemberAdd in inviteTracker:", err);
    }
  });

  // When an invite is created, log its creation.
  tracker.on("inviteCreated", async (invite) => {
    try {
      const guild = invite.guild;
      const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
      if (!logChannel) return;
      const embed = new EmbedBuilder()
        .setTitle("Invite Created")
        .setDescription(
          `A new invite (\`${invite.code}\`) was created by ${
            invite.inviter ? `<@${invite.inviter.id}>` : "Unknown"
          }.`
        )
        .setColor("Green")
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error("Error handling inviteCreated in inviteTracker:", err);
    }
  });

  // When an invite is deleted, log its deletion.
  tracker.on("inviteDeleted", async (invite) => {
    try {
      const guild = invite.guild;
      const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID);
      if (!logChannel) return;
      const embed = new EmbedBuilder()
        .setTitle("Invite Deleted")
        .setDescription(`Invite (\`${invite.code}\`) was deleted.`)
        .setColor("Red")
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    } catch (err) {
      console.error("Error handling inviteDeleted in inviteTracker:", err);
    }
  });
};
