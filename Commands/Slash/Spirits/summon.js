import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import spiritSchema from "../../../schema/spirits.js";
import profileSchema from "../../../schema/profile.js";

const SUMMON_COST = 2500;

const SPIRIT_IMAGES = {
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

const SPIRITS = [
  "Kurumi Tokisaki",
  "Tohka Yatogami",
  "Himekawa Yoshino",
  "Kotori Itsuka",
  "Kaguya Yamai",
  "Yuzuru Yamai",
  "Miku Izayoi",
  "Kyouno Natsumi",
  "Mukuro Hoshimiya",
  "Nia Honjou",
  "Tobiichi Origami",
];

const getRandomColor = () => Math.floor(Math.random() * 0xffffff);

export default {
  name: "summon",
  category: "Spirits",
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName("summon")
    .setDescription("Summon a spirit (costs 2500 Spirit Coins)"),

  run: async ({ client, interaction }) => {
    try {
      await interaction.deferReply();

      // Get the user profile and verify if user started
      const userProfile = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      if (!userProfile) {
        return interaction.editReply({
          content:
            "You have not started yet, use the `/start` command to get started!",
        });
      }

      if (userProfile.balance < SUMMON_COST) {
        return interaction.editReply({
          content: `You do not have enough Spirit Coins to summon. You require \`${SUMMON_COST}\` Spirit Coins to summon.`,
        });
      }

      // Deduct summon cost from balance
      await profileSchema.findOneAndUpdate(
        { userid: interaction.user.id },
        { balance: userProfile.balance - SUMMON_COST }
      );

      // Randomly select a spirit
      const selectedSpirit =
        SPIRITS[Math.floor(Math.random() * SPIRITS.length)];

      // Determine star rating with weighted probabilities
      const roll = Math.random() * 100;
      let spiritStars;
      if (roll < 40) spiritStars = 1; // 40%
      else if (roll < 70) spiritStars = 2; // 30%
      else if (roll < 90) spiritStars = 3; // 20%
      else if (roll < 98) spiritStars = 4; // 8%
      else spiritStars = 5; // 2%

      // Check if the spirit already exists with equal or higher stars
      const existingSpirits = await spiritSchema.find({
        husband: interaction.user.id,
        name: selectedSpirit,
      });
      let convertToShard = false;
      existingSpirits.forEach((spiritData) => {
        if (spiritStars <= spiritData.stars) convertToShard = true;
      });

      // Initiate summon embed
      const initiatingEmbed = new EmbedBuilder()
        .setColor(getRandomColor())
        .setTitle("Initiating Summon~")
        .setFooter({
          text: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
        })
        .setImage(
          "https://cdn.discordapp.com/attachments/1009408632317804544/1012665603347185664/ezgif.com-gif-maker_14.gif?size=4096"
        );

      // Send initial embed and process summon result
      await interaction.editReply({ embeds: [initiatingEmbed] });

      // Wait for animation
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Process summon result
      let finalEmbed;
      if (!convertToShard) {
        // Summon new spirit
        const newSpirit = new spiritSchema({
          name: selectedSpirit,
          husband: interaction.user.id,
          stars: spiritStars > 0 ? spiritStars : 1,
          happiness: 100,
          id: Math.floor(Math.random() * Date.now()).toString(36),
          skin: "Normal",
          attackboost: 0,
          defenceboost: 0,
          agilityboost: 0,
          spiritPowerBoost: 0,
          items: [],
          nickname: "None",
        });
        await newSpirit.save();

        finalEmbed = new EmbedBuilder()
          .setColor(getRandomColor())
          .setTitle("Successful Summoning!")
          .setDescription(
            `You have successfully summoned **${selectedSpirit} 【${"<a:starSpin:1006138461234937887>".repeat(
              spiritStars > 0 ? spiritStars : 1
            )}】**`
          )
          .setFooter({
            text: interaction.user.tag,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
          })
          .setImage(SPIRIT_IMAGES[selectedSpirit]);
      } else {
        // Convert summon to spirit shards
        const profileData = await profileSchema.findOne({
          userid: interaction.user.id,
        });
        const itemsArray = profileData.items || [];
        const shardName = `${selectedSpirit} Shards`;
        const existingShard = itemsArray.find(
          (item) => item.name === shardName
        );
        if (!existingShard) {
          itemsArray.push({ name: shardName, count: spiritStars });
        } else {
          // Update shard count
          const index = itemsArray.indexOf(existingShard);
          itemsArray.splice(index, 1, {
            name: shardName,
            count: existingShard.count + spiritStars,
          });
        }
        await profileSchema.findOneAndUpdate(
          { userid: interaction.user.id },
          { items: itemsArray }
        );

        finalEmbed = new EmbedBuilder()
          .setColor(getRandomColor())
          .setTitle("Successful Summoning!")
          .setDescription(
            `You have received \`${spiritStars}\` **${selectedSpirit} Shards**!`
          )
          .setFooter({
            text: interaction.user.tag,
            iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
          })
          .setImage(SPIRIT_IMAGES[selectedSpirit]);
      }

      // Edit the reply with the final result
      await interaction.editReply({ embeds: [finalEmbed] });
      return true;
    } catch (error) {
      console.error("Summon command error:", error);
      await interaction.editReply({
        content: "An error occurred while summoning the spirit.",
      });
      return false;
    }
  },
};
