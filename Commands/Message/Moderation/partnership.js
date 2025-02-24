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
      const partnershipContent = `╲⠀╲⠀╲ ╲
⠀╲⠀╲⠀☆ ⠀ ╲ ⠀⠀⠀⠀⠀
⠀ ☆⠀ ╲⠀⠀⠀⠀⠀⠀⠀ ★
⠀⠀⠀ ⠀⠀★
__**Ｗｅｌｃｏｍｅ　Ｔｏ　＊：･ﾟ✧𝕶𝖚𝖗𝖚𝖒𝖎'𝖘 𝕰𝖒𝖕𝖎𝖗𝖊　駅院ン !**__
︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵
｛‧͙⁺˚･༓☾ ｝:･ﾟ✧Kurumi's Empire, is a safe for work and wholesome community! We offer countless of things here to do at this server! The server is also a support server for the Kurumi bot so ask away if you have problems with the bot!

:ribbon: ◌ Meet new people from different countries as everyone here is allowed to join! You will have a lot of cute and lovely Kurumi and Queen emojis from the server, and so much more! Come and join *:･ﾟ✧Kurumi's Empire for a lovely time! ꒱ ꒱ ୨୧
︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵ ︶ ︵
｛✧･ﾟ: ✧･ﾟ ｝𝐇𝐞𝐫𝐞 𝐀𝐫𝐞 𝐒𝐨𝐦𝐞 𝐓𝐡𝐢𝐧𝐠𝐬 𝐖𝐞 𝐎𝐟𝐟𝐞𝐫 (๑>◡<๑)
+ 　　　 　 ·　 * ✫ 　　 * ⊹ * ˚ 　　　 　. . 　　　 　　· 　 ⋆
╭─────────────── ・*。 . 　˚ 　　　 ⋆

:star:꒱ Bot support for Kurumi bot!
:crescent_moon: ꒱ Partnerships!
:star: ꒱ Join if you are also a Date a Live fan!
:crescent_moon: ꒱ Giveaways coming soon when we have more members!
:star: ꒱ Interact with our Exclusive bot White Queen!
:crescent_moon: ꒱ A friendly and easy-going community
:star: ꒱ Cute and Aesthetically pleasing ~
:crescent_moon: ꒱ Self Assignable Roles
:star: ꒱ An exclusive chatbot named Nia-San!
:crescent_moon: ꒱ Levelling function, with level roles!
:star: ꒱ And much more coming up!
︶︶︶︶︶︶︶︶︶︶︶┊
✦┊ Watch this server grow with us! :heart:

Invite link:
https://discord.gg/kurumin`;

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
