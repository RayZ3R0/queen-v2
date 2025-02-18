import { EmbedBuilder } from "discord.js";
import spiritSchema from "../../../schema/spirits.js";
import profileSchema from "../../../schema/profile.js";

const spiritImages = {
  "Kurumi Tokisaki":
    "https://c.tenor.com/E6P9PZdh7W0AAAAC/date-a-live-kurumi.gif",
  "Kotori Itsuka":
    "https://c.tenor.com/HGrptWks7wYAAAAC/kotor-kotori-itsuka.gif",
  "Miku Izayoi":
    "https://c.tenor.com/If7aFNHrWQ4AAAAC/date-a-live-miku-izayoi.gif",
  "Kyouno Natsumi":
    "https://c.tenor.com/5AnJ7qdLJM8AAAAd/natsumi-luckey-queen.gif",
  "Nia Honjou":
    "https://c.tenor.com/JeVhDCfN7rEAAAAd/date-a-live-nia-honjou.gif",
  "Kaguya Yamai":
    "https://c.tenor.com/tTb9YHNtCb4AAAAC/yuzuru-yamai-kaguya-yamai.gif",
  "Yuzuru Yamai":
    "https://c.tenor.com/7rzyPBPlkUkAAAAC/date-a-live-yuzuru-yamai.gif",
  "Mukuro Hoshimiya":
    "https://c.tenor.com/cTR32VHj5tgAAAAC/date-a-live-dal.gif",
  "Tobiichi Origami":
    "https://c.tenor.com/_QXMqWcB5foAAAAd/tobiichi-origami-catty-girlfriend.gif",
  "Himekawa Yoshino":
    "https://c.tenor.com/1lllH_v6rXsAAAAC/yoshino-date-a-live-spirit-pledge.gif",
  "Tohka Yatogami":
    "https://c.tenor.com/r_uDlLNAUrkAAAAC/yatogami-tohka-date-a-live.gif",
};

const getRandomNumber = (min, max) => {
  const minimum = Math.ceil(min);
  const maximum = Math.floor(max);
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
};

export default {
  name: "date",
  aliases: [],
  description: "Date your spirits to keep them happy~",
  usage: "",
  cooldown: 60,
  userPermissions: [],
  botPermissions: [],
  category: "Spirits",
  run: async ({ client, message, args, prefix }) => {
    const randomHappinessIncrease = getRandomNumber(25, 100);

    // Fetch user profile
    const userProfile = await profileSchema.findOne({
      userid: message.author.id,
    });
    if (!userProfile) {
      return message.reply({
        content:
          "You have not started playing. Use the start command and summon a spirit to get started. If you have started, then select a spirit with the select command to date.",
      });
    }

    // Fetch selected spirit
    const selectedSpirit = await spiritSchema.findOne({
      id: userProfile.selected,
    });
    if (!selectedSpirit) {
      return message.reply({
        content:
          "You do not have a spirit selected. Use the `harem` command to check your spirits. Use `select` to select a spirit.",
      });
    }

    const updatedHappiness = selectedSpirit.happiness + randomHappinessIncrease;
    await spiritSchema.findOneAndUpdate(
      { id: userProfile.selected },
      { happiness: updatedHappiness <= 100 ? updatedHappiness : 100 }
    );

    const spiritName = selectedSpirit.name;
    const embed = new EmbedBuilder()
      .setColor("#ff0000")
      .setDescription(
        `You had a nice time with **${spiritName}**~ Her happiness level is now **${
          updatedHappiness <= 100 ? updatedHappiness : 100
        }**`
      )
      .setFooter({ text: "Keep your spirits happy by dating~" })
      .setImage(spiritImages[spiritName]);

    message.reply({ embeds: [embed] });
  },
};
