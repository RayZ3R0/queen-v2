import { Client, Message } from "discord.js";
import spiritSchema from "../../../schema/spirits.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "sharden",
  aliases: [],
  description: "Convert a spirit to shards.",
  usage: "<spiritID>",
  cooldown: 10,
  userPermissions: [],
  botPermissions: [],
  category: "Spirits",

  run: async ({ client, message, args, prefix }) => {
    const spirit = await spiritSchema.findOne({ id: args[0] });
    if (!spirit) {
      return message.reply({ content: "Invalid ID." });
    }

    if (spirit.husband !== message.author.id) {
      return message.reply({
        content:
          "You cannot sharden a spirit who is married to another person. Don't be a thief bitch.",
      });
    }

    message.channel.send({
      content: `Successfully shardened **${
        spirit.name
      }**【${"<a:starSpin:1006138461234937887>".repeat(spirit.stars)}】 to \`${
        spirit.stars
      }\` **${spirit.name} Shards**`,
    });

    // Delete the spirit record after shardened
    await spiritSchema.deleteOne({ id: args[0] });

    const profile = await profileSchema.findOne({ userid: spirit.husband });
    if (!profile) return; // safety check if profile doesn't exist

    const items = profile.items;
    const existingItem = items.find(
      (item) => item.name === `${spirit.name} Shards`
    );

    if (existingItem) {
      // Remove the old item and push the updated one
      items.splice(items.indexOf(existingItem), 1);
      items.push({
        name: `${spirit.name} Shards`,
        count: existingItem.count + spirit.stars,
      });
    } else {
      items.push({
        name: `${spirit.name} Shards`,
        count: spirit.stars,
      });
    }

    await profileSchema.findOneAndUpdate({ userid: spirit.husband }, { items });
  },
};
