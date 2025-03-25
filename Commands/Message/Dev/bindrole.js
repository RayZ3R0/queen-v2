import { EmbedBuilder } from "discord.js";
import CustomRoles from "../../../schema/customRoles.js";

export default {
  name: "bindrole",
  description: "Bind an existing role to a server booster. (Owner Only)",
  owneronly: true,
  aliases: [],
  cooldown: 0,
  userPermissions: [],
  botPermissions: [],
  category: "Dev",
  run: async ({ client, message, args, prefix }) => {
    if (args.length < 2) {
      return message.channel.send({
        content: "Usage: `!bindrole @user @role`",
      });
    }

    try {
      // Get user and role from mentions
      const user = message.mentions.users.first();
      const role = message.mentions.roles.first();

      if (!user || !role) {
        return message.channel.send({
          content: "❌ Please mention both a user and a role.",
        });
      }

      // Get member object
      const member = await message.guild.members.fetch(user.id);

      // Check if user is a booster
      if (!member.premiumSince) {
        return message.channel.send({
          content: "❌ The specified user is not a server booster.",
        });
      }

      // Check for existing custom role
      const existingRole = await CustomRoles.findOne({
        userId: user.id,
        guildId: message.guild.id,
      });

      if (existingRole) {
        // Remove old role if it exists
        const oldRole = await message.guild.roles.fetch(existingRole.roleId);
        if (oldRole) {
          await oldRole.delete("Replaced by new bound role");
        }
        await CustomRoles.findByIdAndDelete(existingRole._id);
      }

      // Save the role binding
      await new CustomRoles({
        userId: user.id,
        guildId: message.guild.id,
        roleId: role.id,
      }).save();

      // Assign role to user if they don't have it
      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role);
      }

      const successEmbed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("Role Binding Successful")
        .setDescription(`Bound role ${role} to booster ${user.tag}`)
        .setTimestamp();

      return message.channel.send({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Error in bindrole command:", error);
      return message.channel.send({
        content: "❌ An error occurred while binding the role.",
      });
    }
  },
};
