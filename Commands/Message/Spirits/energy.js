import profileSchema from "../../../schema/profile.js";

export default {
  name: "energy",
  aliases: [],
  description: "Check how much energy you have.",
  usage: "",
  cooldown: 10,
  userPermissions: [],
  botPermissions: [],
  category: "Spirits",

  run: async ({ client, message, args, prefix }) => {
    try {
      const userProfile = await profileSchema.findOne({
        userid: message.author.id,
      });
      if (!userProfile) {
        return message.reply({
          content: "Profile not found. Please register before checking energy.",
        });
      }
      return message.reply({
        content: `You have __${userProfile.energy}/60__ Energy.`,
      });
    } catch (error) {
      console.error("Error fetching energy:", error);
      return message.reply({
        content: "An error occurred while retrieving your energy status.",
      });
    }
  },
};
