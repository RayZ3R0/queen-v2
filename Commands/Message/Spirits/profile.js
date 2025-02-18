import { EmbedBuilder } from "discord.js";
import profileSchema from "../../../schema/profile.js";
import spiritSchema from "../../../schema/spirits.js";

export default {
  name: "profile",
  aliases: [],
  description: "Check your or someone's profile or edit your profile.",
  usage:
    "[@user] | ;profile set image <image link> | ;profile set bio <bio> | ;profile set color <hex code>",
  cooldown: 10,
  userPermissions: [],
  botPermissions: [],
  category: "Spirits",

  run: async ({ client, message, args, prefix }) => {
    // Handle updating profile image
    if (args[0] === "set" && args[1] === "image") {
      if (!args[2])
        return message.reply({
          content: "Provide a valid image URL to set!",
        });

      let userProfile = await profileSchema.findOne({
        userid: message.author.id,
      });

      if (userProfile) {
        await profileSchema.findOneAndUpdate(
          { userid: message.author.id },
          { image: args[2] }
        );
      } else {
        userProfile = new profileSchema({
          userid: message.author.id,
          selected: "None",
          image: args[2],
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
      return message.reply({
        content: `Set ${args[2]} as your profile image.`,
      });
    }
    // Handle updating profile bio
    else if (args[0] === "set" && args[1] === "bio") {
      if (!args[2])
        return message.reply({
          content: "Provide a valid bio to set!",
        });
      const bioText = args.slice(2).join(" ");
      let userProfile = await profileSchema.findOne({
        userid: message.author.id,
      });
      if (userProfile) {
        await profileSchema.findOneAndUpdate(
          { userid: message.author.id },
          { bio: bioText }
        );
      } else {
        userProfile = new profileSchema({
          userid: message.author.id,
          selected: "None",
          image: "https://c.tenor.com/E6P9PZdh7W0AAAAC/date-a-live-kurumi.gif",
          color: "#ff0000",
          bio: bioText,
          level: 0,
          xp: 0,
          energy: 60,
          balance: 0,
          items: [],
          started: false,
        });
        await userProfile.save();
      }
      return message.reply({
        content: `Set \`${bioText}\` as your profile bio.`,
      });
    }
    // Handle updating profile color
    else if (args[0] === "set" && args[1] === "color") {
      if (!args[2])
        return message.reply({
          content: "Provide a valid color to set!",
        });
      let userProfile = await profileSchema.findOne({
        userid: message.author.id,
      });
      if (userProfile) {
        await profileSchema.findOneAndUpdate(
          { userid: message.author.id },
          { color: args[2] }
        );
      } else {
        userProfile = new profileSchema({
          userid: message.author.id,
          selected: "None",
          image: "https://c.tenor.com/E6P9PZdh7W0AAAAC/date-a-live-kurumi.gif",
          color: args[2],
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
      return message.reply({
        content: `Set \`${args[2]}\` as your profile color.`,
      });
    }
    // Display profile information
    else {
      const targetMember =
        message.mentions.members.first() ||
        message.guild.members.cache.get(args[0]) ||
        message.member;

      let userProfile = await profileSchema.findOne({
        userid: targetMember.user.id,
      });
      if (!userProfile) {
        userProfile = new profileSchema({
          userid: targetMember.user.id,
          selected: "None",
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

      const spiritData = await spiritSchema.findOne({
        id: userProfile.selected,
      });
      const allSpirits = await spiritSchema.find({
        husband: targetMember.user.id,
      });
      const selectedSpirit = spiritData
        ? `${spiritData.name} 【${"<a:starSpin:1006138461234937887>".repeat(
            spiritData.stars
          )}】`
        : "None";

      const profileEmbed = new EmbedBuilder()
        .setColor(userProfile.color)
        .setAuthor({
          name: targetMember.user.username,
          iconURL: targetMember.user.displayAvatarURL({ dynamic: true }),
        })
        .addFields(
          { name: "Selected Spirit", value: selectedSpirit, inline: false },
          {
            name: "Total Spirits",
            value: `${allSpirits.length}`,
            inline: false,
          },
          { name: "Bio", value: userProfile.bio, inline: false }
        )
        .setImage(userProfile.image);

      return message.reply({ embeds: [profileEmbed] });
    }
  },
};
