import ticketSystem from "../../../utils/ticketSystem.js";

export default {
  name: "ticket",
  aliases: [""],
  cooldown: 3,
  description: "Sets a user's level to a specified value (Dev Only).",
  userPermissions: ["Administrator"],
  botPermissions: [],
  category: "Dev",
  run: async ({ client, message, args, prefix }) => {
    if (!message || !message.channel) {
      console.error("No valid message or channel passed to the command.");
      return;
    }
    // Call the local ticket system function with options.
    await ticketSystem(message, message.channel, {
      embedDesc: "Click the button below to open a ticket. 🎟",
      embedColor: "#ff0000", // Default: #ff0000
      embedFoot: "We will try our best to help you~",
      emoji: "865096697939623936",
      color: "SUCCESS",
      credit: false,
    });
  },
};
