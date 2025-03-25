import { EmbedBuilder } from "discord.js";
import CustomRoles from "../../../schema/customRoles.js";

export default {
  name: "delcustomrole",
  description: "Delete custom role by user or role mention. (Owner Only)",
  owneronly: true,
  aliases: [],
  cooldown: 0,
  userPermissions: [],
  botPermissions: [],
  category: "Dev",
  run: async ({ client, message, args, prefix }) => {
    if (args.length < 1) {
      return message.channel.send({
        content: "Usage: `!delcustomrole @user` or `!delcustomrole @role`",
      });
    }

    try {
      // Check if user or role is mentioned
      const user = message.mentions.users.first();
      const role = message.mentions.roles.first();

      if (!user && !role) {
        return message.channel.send({
          content: "❌ Please mention either a user or a role.",
        });
      }

      let customRole;
      if (user) {
        // Find by user
        customRole = await CustomRoles.findOne({
          userId: user.id,
          guildId: message.guild.id,
        });

        if (!customRole) {
          return message.channel.send({
            content: "❌ This user doesn't have a custom role.",
          });
        }
      } else {
        // Find by role
        customRole = await CustomRoles.findOne({
          roleId: role.id,
          guildId: message.guild.id,
        });

        if (!customRole) {
          return message.channel.send({
            content: "❌ This is not a custom role.",
          });
        }
      }

      // Get role object
      const roleToDelete = await message.guild.roles.fetch(customRole.roleId);

      // Delete the role if it exists
      if (roleToDelete) {
        await roleToDelete.delete("Custom role deleted by admin");
      }

      // Delete from database
      await CustomRoles.findByIdAndDelete(customRole._id);

      const successEmbed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("Custom Role Deleted")
        .setDescription(
          user
            ? `Deleted custom role from ${user.tag}`
            : `Deleted custom role: ${role.name}`
        )
        .setTimestamp();

      return message.channel.send({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Error in delcustomrole command:", error);
      return message.channel.send({
        content: "❌ An error occurred while deleting the custom role.",
      });
    }
  },
};
