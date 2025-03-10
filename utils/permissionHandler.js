import { PermissionFlagsBits } from "discord.js";

/**
 * Validates role hierarchy for moderation commands
 * @param {GuildMember} executor - The member executing the command
 * @param {GuildMember} target - The member being targeted
 * @param {CommandInteraction} interaction - The command interaction
 * @returns {boolean} True if hierarchy check passes, throws error otherwise
 */
export const checkRoleHierarchy = (executor, target, interaction) => {
  // Get role positions
  const executorHighestRole = executor.roles.highest.position;
  const targetHighestRole = target.roles.highest.position;
  const botHighestRole = interaction.guild.members.me.roles.highest.position;

  // Check bot's role position
  if (botHighestRole <= targetHighestRole) {
    throw {
      name: "HierarchyError",
      message:
        "I don't have permission to moderate this user due to role hierarchy.",
    };
  }

  // Check executor's role position
  if (executorHighestRole <= targetHighestRole) {
    throw {
      name: "HierarchyError",
      message: "You cannot moderate a member with equal or higher role.",
    };
  }

  // Prevent self-moderation
  if (executor.id === target.id) {
    throw {
      name: "ValidationError",
      message: "You cannot moderate yourself.",
    };
  }

  // Prevent bot moderation
  if (target.user.bot) {
    throw {
      name: "ValidationError",
      message: "I cannot moderate other bots.",
    };
  }

  return true;
};

/**
 * Validates permissions for command execution
 * @param {CommandInteraction} interaction - The command interaction
 * @param {Object} command - The command object
 * @returns {Object} Validation result with status and error message if any
 */
export const validatePermissions = (interaction, command) => {
  const validationResult = {
    hasPermission: true,
    error: null,
  };

  // Check guild context
  if (!interaction.guild) {
    validationResult.hasPermission = false;
    validationResult.error = "This command can only be used in a server.";
    return validationResult;
  }

  // Check bot permissions
  const botMember = interaction.guild.members.me;
  const missingBotPerms = command.botPermissions.filter(
    (perm) => !botMember.permissions.has(perm)
  );

  if (missingBotPerms.length > 0) {
    validationResult.hasPermission = false;
    validationResult.error = `I'm missing these permissions: ${formatPermissions(
      missingBotPerms
    )}`;
    return validationResult;
  }

  // Check member permissions
  const missingMemberPerms = command.memberPermissions.filter(
    (perm) => !interaction.member.permissions.has(perm)
  );

  if (missingMemberPerms.length > 0) {
    validationResult.hasPermission = false;
    validationResult.error = `You're missing these permissions: ${formatPermissions(
      missingMemberPerms
    )}`;
    return validationResult;
  }

  return validationResult;
};

/**
 * Formats permission flags into readable strings
 * @param {Array<bigint>} permissions - Array of permission flags
 * @returns {string} Formatted permission names
 */
const formatPermissions = (permissions) => {
  return permissions
    .map((perm) => {
      const permName = Object.keys(PermissionFlagsBits).find(
        (key) => PermissionFlagsBits[key] === perm
      );
      return permName.replace(/([A-Z])/g, " $1").trim();
    })
    .join(", ");
};

/**
 * Handles command execution errors
 * @param {CommandInteraction} interaction - The command interaction
 * @param {Error} error - The error that occurred
 */
export const handleCommandError = async (interaction, error) => {
  console.error(`Command Error in ${interaction.commandName}:`, error);

  const errorMessages = {
    PermissionError: "You don't have permission to use this command.",
    HierarchyError:
      error.message || "Cannot moderate a member with equal or higher role.",
    ValidationError: error.message || "Invalid command usage.",
    DatabaseError: "There was an error with the database operation.",
    TimeoutError: "The operation timed out.",
    Default: "An unexpected error occurred.",
  };

  const errorContent = {
    content: `❌ ${
      errorMessages[error.name] || error.message || errorMessages.Default
    }`,
    ephemeral: true,
  };

  try {
    if (interaction.deferred) {
      await interaction.editReply(errorContent);
    } else {
      await interaction.reply(errorContent);
    }
  } catch (err) {
    console.error("Error sending error message:", err);
  }
};
