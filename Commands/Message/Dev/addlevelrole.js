import { EmbedBuilder } from "discord.js";
import roleSetup from "../../../utils/roleSetup.js";

/**
 * @type {import("../../../index.js").Mcommand}
 */
export default {
  name: "addlevelrole",
  aliases: ["addlvlrole", "alr", "setlevelrole", "setlvlrole"],
  description: "Add or update a level role reward for reaching a specific level. (Dev Only)",
  category: "Dev",
  owneronly: true,
  cooldown: 0,
  userPermissions: [],
  botPermissions: ["ManageRoles"],

  run: async ({ client, message, args, prefix }) => {
    if (args.length < 2) {
      return message.channel.send({
        content: `❌ **Usage:** \`${prefix}addlevelrole <level> <@role | roleID>\``,
      });
    }

    let levelValue = null;
    let targetRole = null;

    // Check if first argument is a number (level)
    const firstNum = Number(args[0]);
    const secondNum = Number(args[1]);

    if (!isNaN(firstNum) && firstNum >= 0) {
      levelValue = firstNum;
      targetRole =
        message.mentions.roles.first() ||
        message.guild.roles.cache.get(args[1]) ||
        (await message.guild.roles.fetch(args[1]).catch(() => null));
    } else if (!isNaN(secondNum) && secondNum >= 0) {
      levelValue = secondNum;
      targetRole =
        message.mentions.roles.first() ||
        message.guild.roles.cache.get(args[0]) ||
        (await message.guild.roles.fetch(args[0]).catch(() => null));
    }

    if (levelValue === null) {
      return message.channel.send({
        content: "❌ Please provide a valid level number (0 or higher).",
      });
    }

    if (!targetRole) {
      return message.channel.send({
        content: "❌ Please mention a valid role or provide a valid Role ID.",
      });
    }

    // Check role hierarchy with bot's highest role
    const botHighestRole = message.guild.members.me.roles.highest.position;
    if (targetRole.position >= botHighestRole) {
      return message.channel.send({
        content: `⚠️ Warning: ${targetRole} is higher than or equal to my highest role. I will not be able to assign it to members upon leveling up.`,
      });
    }

    try {
      const result = await roleSetup.add(client, message.guild.id, {
        level: levelValue,
        role: targetRole.id,
      });

      const embed = new EmbedBuilder()
        .setColor(client.config.embed.color || "Green")
        .setTitle(result.updated ? "Level Role Updated" : "Level Role Added")
        .setDescription(
          result.updated
            ? `Successfully updated level **${levelValue}** reward to ${targetRole}!`
            : `Successfully added ${targetRole} as reward for reaching level **${levelValue}**!`
        )
        .addFields(
          { name: "Required Level", value: `\`${levelValue}\``, inline: true },
          { name: "Role Reward", value: `${targetRole} (\`${targetRole.id}\`)`, inline: true }
        )
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error("Error in addlevelrole command:", error);
      return message.channel.send({
        content: `❌ ${error.message || "An error occurred while adding the level role."}`,
      });
    }
  },
};
