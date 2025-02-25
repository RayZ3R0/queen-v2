import profileSchema from "../../../schema/profile.js";

export default {
  name: "timely",
  description: "Claim your timely rewards every 3 hours.",
  category: "Spirits",
  usage: "",
  cooldown: 10800,
  userPermissions: [],
  botPermissions: [],
  aliases: ["t"],
  run: async ({ client, message, args, prefix }) => {
    let rewardAmount = 50;
    // Bonus amount if the user has the special role
    if (message.member.roles.cache.has("927097726934601729"))
      rewardAmount = 100;

    try {
      const userProfile = await profileSchema.findOne({
        userid: message.author.id,
      });

      if (userProfile) {
        await profileSchema.findOneAndUpdate(
          { userid: message.author.id },
          { balance: userProfile.balance + rewardAmount }
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
          balance: rewardAmount,
          items: [],
          started: false,
        });
        await newProfile.save();
      }

      return message.channel.send({
        content: `You have received \`${rewardAmount}\` Spirit Coins as a timely reward. Come back again after 3 hours to receive more.`,
      });
    } catch (error) {
      console.error("Error claiming timely reward:", error);
      return message.channel.send({
        content: "Something went wrong while claiming your timely reward.",
      });
    }
  },
};
