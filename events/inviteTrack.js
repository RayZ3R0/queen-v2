import { EmbedBuilder } from "discord.js";
import { initInviteTracker } from "../utils/inviteTracker.js";

const LOG_CHANNEL_ID = "901818838381891624";

/**
 * Sets up invite tracking and logs invite events to a designated channel.
 * @param {import("discord.js").Client} client
 */
export default (client) => {
  const tracker = initInviteTracker(client, {
    fetchGuilds: true,
    fetchVanity: true,
  });

  tracker.on("guildMemberAdd", async (member, type, inviteUsed) => {
    try {
      console.log("member add initialized");
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

  tracker.on("inviteCreated", async (invite) => {
    try {
      const logChannel = invite.guild.channels.cache.get(LOG_CHANNEL_ID);
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

  tracker.on("inviteDeleted", async (invite) => {
    try {
      const logChannel = invite.guild.channels.cache.get(LOG_CHANNEL_ID);
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
