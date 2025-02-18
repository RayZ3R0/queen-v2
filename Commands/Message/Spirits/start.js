import profileSchema from "../../../schema/profile.js";

export default {
  name: "start",
  description: "Start your journey! You gain 5000 Spirit Coins for starting.",
  usage: "",
  cooldown: 10,
  userPermissions: [],
  botPermissions: [],
  category: "Spirits",
  run: async ({ client, message, args, prefix }) => {
    try {
      const profileData = await profileSchema.findOne({
        userid: message.author.id,
      });

      if (profileData && profileData.started) {
        return message.reply({
          content: "You have already started the game. You cannot do it again.",
        });
      }

      if (profileData) {
        await profileSchema.findOneAndUpdate(
          { userid: message.author.id },
          { balance: profileData.balance + 5000, started: true },
          { new: true }
        );
      } else {
        const newProfile = new profileSchema({
          userid: message.author.id,
          selected: "None",
          image: "https://c.tenor.com/E6P9PZdh7W0AAAAC/date-a-live-kurumi.gif",
          color: "#ff0000",
          bio: "None",
          level: 0,
          xp: 0,
          energy: 60,
          balance: 5000,
          items: [],
          started: true,
        });
        await newProfile.save();
      }

      return message.channel.send({
        content:
          "You have successfully started the game! You have received `5000` Spirit Coins as a reward. Use the `;summon` command to summon a spirit.",
      });
    } catch (error) {
      console.error("Start command error:", error);
      return message.reply({
        content: "An error occurred. Please try again later.",
      });
    }
  },
};
