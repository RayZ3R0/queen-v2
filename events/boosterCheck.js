import { client } from "../bot.js";
import CustomRoles from "../schema/customRoles.js";
import { EmbedBuilder } from "discord.js";

const ALERT_CHANNEL_ID = "938770418599337984";

// Function to check boosters and send alerts
async function checkBoosters() {
  try {
    // Get all custom roles
    const allCustomRoles = await CustomRoles.find();

    for (const customRole of allCustomRoles) {
      // Get the guild
      const guild = await client.guilds
        .fetch(customRole.guildId)
        .catch(() => null);
      if (!guild) continue;

      // Get the member
      const member = await guild.members
        .fetch(customRole.userId)
        .catch(() => null);
      if (!member) continue;

      // Check if still boosting
      if (!member.premiumSince) {
        // Get alert channel
        const alertChannel = await guild.channels
          .fetch(ALERT_CHANNEL_ID)
          .catch(() => null);
        if (!alertChannel) continue;

        // Get role info
        const role = await guild.roles
          .fetch(customRole.roleId)
          .catch(() => null);
        const roleName = role ? role.name : "Unknown Role";

        // Create and send alert embed
        const alertEmbed = new EmbedBuilder()
          .setColor("Red")
          .setTitle("🚨 Booster Alert")
          .setDescription("A user with a custom role is no longer boosting")
          .addFields(
            { name: "User", value: `<@${member.id}>`, inline: true },
            {
              name: "Role",
              value: role ? `<@&${role.id}>` : roleName,
              inline: true,
            }
          )
          .setTimestamp();

        await alertChannel.send({ embeds: [alertEmbed] });
      }
    }
  } catch (error) {
    console.error("Error in booster check:", error);
  }
}

client.on("ready", () => {
  // Initial check
  checkBoosters();

  // Set up daily check (24 hours)
  setInterval(checkBoosters, 24 * 60 * 60 * 1000);
});

// Also check when a member loses boost status
client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    // If member lost booster status
    if (oldMember.premiumSince && !newMember.premiumSince) {
      const customRole = await CustomRoles.findOne({
        userId: newMember.id,
        guildId: newMember.guild.id,
      });

      if (customRole) {
        const alertChannel = await newMember.guild.channels
          .fetch(ALERT_CHANNEL_ID)
          .catch(() => null);
        if (!alertChannel) return;

        const role = await newMember.guild.roles
          .fetch(customRole.roleId)
          .catch(() => null);
        const roleName = role ? role.name : "Unknown Role";

        const alertEmbed = new EmbedBuilder()
          .setColor("Red")
          .setTitle("🚨 Booster Alert")
          .setDescription("A user with a custom role has stopped boosting")
          .addFields(
            { name: "User", value: `<@${newMember.id}>`, inline: true },
            {
              name: "Role",
              value: role ? `<@&${role.id}>` : roleName,
              inline: true,
            }
          )
          .setTimestamp();

        await alertChannel.send({ embeds: [alertEmbed] });
      }
    }
  } catch (error) {
    console.error("Error in guildMemberUpdate booster check:", error);
  }
});
