import spiritSchema from "../../../schema/spirits.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "select",
  description: "Select a Spirit for battle and dating.",
  usage: "<spiritID>",
  cooldown: 10,
  category: "Spirits",
  userPermissions: [],
  botPermissions: [],
  run: async ({ client, message, args, prefix }) => {
    const spiritID = args[0];
    if (!spiritID)
      return message.reply({
        content: `Please provide a spirit ID. Usage: ${prefix}select <spiritID>`,
      });

    // Find the spirit in our database
    const spiritEntity = await spiritSchema.findOne({ id: spiritID });
    if (!spiritEntity)
      return message.reply({
        content:
          "Invalid ID. Provide a valid ID or die. Use the `harem` command to check your spirits and find their ID.",
      });
    if (spiritEntity.husband !== message.author.id)
      return message.reply({
        content:
          "You cannot select a spirit who is married to another person. Don't be a thief bitch.",
      });

    // Find or create the user profile and update the selected spirit
    let userProfile = await profileSchema.findOne({
      userid: message.author.id,
    });
    if (userProfile) {
      userProfile.selected = spiritID;
      await userProfile.save();
    } else {
      userProfile = new profileSchema({
        userid: message.author.id,
        selected: spiritID,
        image: "https://c.tenor.com/E6P9PZdh7W0AAAAC/date-a-live-kurumi.gif",
        color: "#ff0000",
        bio: "None",
        level: 0,
        xp: 0,
        energy: 60,
        balance: 0,
        items: [],
        started: false,
      });
      await userProfile.save();
    }

    return message.channel.send({
      content: `Successfully selected **${
        spiritEntity.name
      }**【${"<a:starSpin:1006138461234937887>".repeat(spiritEntity.stars)}】`,
    });
  },
};
