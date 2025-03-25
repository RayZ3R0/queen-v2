import { client } from "../bot.js";
import { EmbedBuilder } from "discord.js";
import CustomRoles from "../schema/customRoles.js";

const ALERT_CHANNEL_ID = "938770418599337984"; // Channel for booster alerts

client.on("guildMemberAdd", async (member) => {
  try {
    // Check if member had a custom role
    const customRole = await CustomRoles.findOne({
      userId: member.id,
      guildId: member.guild.id,
    });

    if (!customRole) return; // No custom role to restore

    const role = await member.guild.roles.fetch(customRole.roleId);
    if (!role) {
      // Role was deleted, clean up database
      await CustomRoles.findByIdAndDelete(customRole._id);
      return;
    }

    // Check if still boosting
    if (!member.premiumSince) {
      const alertChannel = await member.guild.channels.fetch(ALERT_CHANNEL_ID);
      if (alertChannel) {
        const embed = new EmbedBuilder()
          .setColor("Red")
          .setTitle("Booster Custom Role Alert")
          .setDescription(
            `${member.user.tag} rejoined but is no longer boosting.\nTheir custom role "${role.name}" has been removed.`
          )
          .setTimestamp();

        await alertChannel.send({ embeds: [embed] });
      }

      // Delete role and database entry
      await role.delete("User no longer boosting");
      await CustomRoles.findByIdAndDelete(customRole._id);
      return;
    }

    // Still boosting, restore role
    await member.roles.add(role);

    const alertChannel = await member.guild.channels.fetch(ALERT_CHANNEL_ID);
    if (alertChannel) {
      const embed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("Custom Role Restored")
        .setDescription(
          `${member.user.tag} rejoined and their custom role "${role.name}" has been restored.`
        )
        .setTimestamp();

      await alertChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error("Error in guildMemberAdd custom role handler:", error);

    // Try to send error to alert channel
    try {
      const alertChannel = await member.guild.channels.fetch(ALERT_CHANNEL_ID);
      if (alertChannel) {
        await alertChannel.send({
          content: `❌ Error handling custom role for ${member.user.tag}: ${error.message}`,
        });
      }
    } catch (err) {
      console.error("Error sending alert:", err);
    }
  }
});
