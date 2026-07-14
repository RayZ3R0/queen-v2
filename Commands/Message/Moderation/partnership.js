import { PermissionsBitField } from "discord.js";

/**
 * Partnership command.
 * @type {import("../../structure/Command.js").default}
 */
export default {
  name: "partnership",
  description: "Sends the partnership advertisement message.",
  cooldown: 5,
  userPermissions: [PermissionsBitField.Flags.ManageMessages],
  botPermissions: [PermissionsBitField.Flags.ManageMessages],
  category: "Moderation",
  run: async ({ client, message, args, prefix }) => {
    try {
      // Partnership advertisement content.
      const partnershipContent = `
      # ･ﾟ✧𝕶𝖚𝖗𝖚𝖒𝖎'𝖘 𝕰𝖒𝖕𝖎𝖗𝖊　駅院ン

## ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵
｛‧͙⁺˚･༓☾ ｝:･ﾟ✧Kurumi's Empire, a community centered around **Kurumi Tokisaki from the Date A Live series**!

 ◌ Kurumi fans from around the globe converge here! It is here that we appreciate Best Girl, but there is so much more to see and do in our lovely community! ꒱ ꒱ ୨୧
︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵

｛✧･ﾟ: ✧･ﾟ ｝𝐇𝐞𝐫𝐞 𝐀𝐫𝐞 𝐒𝐨𝐦𝐞 𝐓𝐡𝐢𝐧𝐠𝐬 𝐖𝐞 𝐎𝐟𝐟𝐞𝐫 (๑>◡<๑)

⭐ Partnerships!
🌙 Primarily Kurumi Tokisaki-themed, but join us if you are also a DAL fan!
⭐ Giveaways and streams!
🌙 Interact with our exclusive bots White Queen and Kurumi!
⭐ A friendly and easy-going community!
🌙 Cute and aesthetically pleasing stickers and emojis!
⭐ Self-assignable roles!
🌙 Unique DAL-themed level roles!
⭐ And much more!

︶︶︶︶︶︶︶︶︶︶

✦ Come join our community as we grow and prosper under the watch of our glorious waifu Kurumi! 

https://discord.gg/kurumi
      `;

      await message.channel.send({ content: partnershipContent });
    } catch (error) {
      console.error("Error in partnership command:", error);
      await message.channel.send({
        content:
          "An error occurred while sending the partnership message. Please try again later.",
      });
    }
  },
};
