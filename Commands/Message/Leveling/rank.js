import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Canvas from "@napi-rs/canvas";
import { EmbedBuilder } from "discord.js";
import levelModel from "../../../schema/level.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
  name: "rank",
  description: "Displays your current level, XP, and rank.",
  userPermissions: [],
  botPermissions: [],
  cooldown: 3,
  category: "Leveling",

  run: async ({ message, args }) => {
    try {
      const targetMember =
        message.mentions.members.first() ||
        message.guild.members.cache.find(
          (m) =>
            m.user.tag === args[0] ||
            m.user.username === args[0] ||
            m.user.id === args[0]
        ) ||
        message.member;
      const userID = targetMember.id;
      // Instead of replying immediately with the image,
      // we call rank() which sends a preliminary embed then updates the message with the rank card image.
      await rank(message, userID, message.guild.id, {
        background: "https://i.ibb.co/SBgxdRH/R-1.jpg", // default background
        color: "#ff0000",
        lvlbar: "#DCD427",
        lvlbarBg: "#000000",
      });
    } catch (error) {
      console.error("Rank command error:", error);
      return message.channel.send({
        content: "An error occurred while generating the rank card.",
      });
    }
  },
};

async function rank(message, userID, guildID, options = {}) {
  if (!userID) throw new Error("[XP] User ID was not provided.");
  if (!guildID) throw new Error("[XP] Guild ID was not provided.");

  // Retrieve the user's XP data from your level schema
  const userData = await levelModel
    .findOne({ user: userID, guild: guildID })
    .exec();
  if (!userData) throw new Error("[XP] NO_DATA | User has no XP data.");

  // Get full leaderboard for rank calculation
  const leaderboard = await levelModel
    .find({ guild: guildID })
    .sort({ xp: -1 })
    .exec();
  userData.position = leaderboard.findIndex((i) => i.user === userID) + 1;

  const targetLevel = userData.level + 1;
  const neededXP = targetLevel * targetLevel * 100;

  // Prepare a beautiful preliminary embed with the rank info
  const member = message.guild.members.cache.get(userID)?.user;
  const preEmbed = new EmbedBuilder()
    .setTitle(`${member.username}'s Rank`)
    .setDescription(
      `**Level:** ${userData.level}\n**XP:** ${userData.xp}\n**Position:** #${userData.position}`
    )
    .setThumbnail(member.displayAvatarURL({ dynamic: true, size: 512 }))
    .setColor(options.color || "Random")
    .setFooter({ text: "Generating your rank card..." })
    .setTimestamp();

  // Send initial message with the embed
  const sentMessage = await message.channel.send({ embeds: [preEmbed] });

  // Generate the rank card image
  const rankImage = await rankCard(message, {
    level: userData.level,
    currentXP: userData.xp,
    neededXP,
    rank: userData.position,
    background: options.background,
    color: options.color,
    lvlbar: options.lvlbar,
    lvlbarBg: options.lvlbarBg,
    member,
  });

  // Create a new embed that includes the rank card image
  const finalEmbed = EmbedBuilder.from(preEmbed)
    .setImage(`attachment://${rankImage.name}`)
    .setFooter({ text: "Rank card generated." });

  // Update the previously sent message with the rank card image attached
  await sentMessage.edit({
    embeds: [finalEmbed],
    files: [{ attachment: rankImage.attachment, name: rankImage.name }],
  });

  return rankImage;
}

async function rankCard(message, options = {}) {
  try {
    // Register the font (ensure the Fonts folder exists with Baloo-Regular.ttf)
    Canvas.GlobalFonts.registerFromPath(
      join(__dirname, "Fonts", "Baloo-Regular.ttf"),
      "Sans Serif"
    );

    const member = options.member;
    const canvas = Canvas.createCanvas(1080, 400);
    const ctx = canvas.getContext("2d");

    const name = member.tag;
    const noSymbols = (string) => string.replace(/[\u007f-\uffff]/g, "");

    let fsiz = "45px";
    if (message.guild.name.length >= 23) fsiz = "38px";
    if (message.guild.name.length >= 40) fsiz = "28px";
    if (message.guild.name.length >= 63) fsiz = "22px";

    const BackgroundRadius = 20;
    const BackGroundImg =
      options.background || "https://i.ibb.co/QQvMqf7/gradient.jpg";
    const AttachmentName = "rank.png";
    const AttachmentDesc = "Rank Card";
    const Username = noSymbols(name);
    const AvatarRoundRadius = 50;
    const DrawLayerColor = "#000000";
    const DrawLayerOpacity = 0.4;
    const BoxColor = options.color || "#096DD1";
    const LevelBarFill = options.lvlbar || "#ffffff";
    const LevelBarBackground = options.lvlbarBg || "#ffffff";
    const Rank = options.rank;
    const TextEXP = shortener(options.currentXP) + " XP";
    const LvlText = `Level ${shortener(options.level)}`;
    const BarRadius = 20;
    const TextXpNeededTemplate = "{current}/{needed}";
    const CurrentXP = options.currentXP;
    const NeededXP = options.neededXP;

    // Draw rounded background
    ctx.beginPath();
    ctx.moveTo(BackgroundRadius, 0);
    ctx.lineTo(1080 - BackgroundRadius, 0);
    ctx.quadraticCurveTo(1080, 0, 1080, BackgroundRadius);
    ctx.lineTo(1080, 400 - BackgroundRadius);
    ctx.quadraticCurveTo(1080, 400, 1080 - BackgroundRadius, 400);
    ctx.lineTo(BackgroundRadius, 400);
    ctx.quadraticCurveTo(0, 400, 0, 400 - BackgroundRadius);
    ctx.lineTo(0, BackgroundRadius);
    ctx.quadraticCurveTo(0, 0, BackgroundRadius, 0);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 1080, 400);
    const background = await Canvas.loadImage(BackGroundImg);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(background, 0, 0, 1080, 400);
    ctx.restore();

    ctx.fillStyle = DrawLayerColor;
    ctx.globalAlpha = DrawLayerOpacity;
    ctx.fillRect(40, 0, 240, canvas.height);
    ctx.globalAlpha = 1;

    const avatar = await Canvas.loadImage(
      member.displayAvatarURL({ extension: "png", size: 512 })
    );
    ctx.save();
    RoundedBox(ctx, 70, 30, 180, 180, AvatarRoundRadius);
    ctx.strokeStyle = BoxColor;
    ctx.lineWidth = 15;
    ctx.stroke();
    ctx.clip();
    ctx.drawImage(avatar, 70, 30, 180, 180);
    ctx.restore();

    ctx.save();
    RoundedBox(ctx, 70, 320, 180, 50, 20);
    ctx.strokeStyle = "#BFC85A22";
    ctx.stroke();
    ctx.clip();
    ctx.fillStyle = BoxColor;
    ctx.fillRect(70, 320, 180, 50);
    ctx.fillStyle = "#ffffff";
    ctx.font = '32px "Sans Serif"';
    ctx.textAlign = "center";
    ctx.fillText(TextEXP, 160, 358);
    ctx.restore();

    ctx.save();
    RoundedBox(ctx, 70, 240, 180, 50, 20);
    ctx.strokeStyle = "#BFC85A22";
    ctx.stroke();
    ctx.clip();
    ctx.fillStyle = BoxColor;
    ctx.fillRect(70, 240, 180, 50);
    ctx.fillStyle = "#ffffff";
    ctx.font = '32px "Sans Serif"';
    ctx.textAlign = "center";
    ctx.fillText(LvlText, 160, 278);
    ctx.restore();

    ctx.save();
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.font = '39px "Sans Serif"';
    ctx.fillText(Username, 390, 80);
    ctx.restore();

    ctx.save();
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.font = '55px "Sans Serif"';
    ctx.fillText("#" + Rank, canvas.width - 55, 80);
    ctx.restore();

    ctx.save();
    RoundedBox(ctx, 390, 305, 660, 70, 20);
    ctx.strokeStyle = "#BFC85A22";
    ctx.stroke();
    ctx.clip();
    ctx.fillStyle = "#ffffff";
    ctx.font = `${fsiz} "Sans Serif"`;
    ctx.textAlign = "center";
    ctx.fillText(message.guild.name, 720, 355);
    ctx.globalAlpha = 0.2;
    ctx.fillRect(390, 305, 660, 70);
    ctx.restore();

    ctx.save();
    RoundedBox(ctx, 390, 145, 660, 50, BarRadius);
    ctx.strokeStyle = "#BFC85A22";
    ctx.stroke();
    ctx.clip();
    ctx.fillStyle = LevelBarBackground;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(390, 145, 660, 50);
    ctx.restore();

    const percent = (100 * CurrentXP) / NeededXP;
    const progress = (percent * 660) / 100;

    ctx.save();
    RoundedBox(ctx, 390, 145, progress, 50, BarRadius);
    ctx.strokeStyle = "#BFC85A22";
    ctx.stroke();
    ctx.clip();
    ctx.fillStyle = LevelBarFill;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(390, 145, progress, 50);
    ctx.restore();

    ctx.save();
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.8;
    ctx.font = '30px "Sans Serif"';
    ctx.fillText("Next Level: " + shortener(NeededXP) + " XP", 390, 230);
    ctx.restore();

    const textXPEdited = TextXpNeededTemplate.replace(
      /{needed}/g,
      shortener(NeededXP).toString()
    ).replace(/{current}/g, shortener(CurrentXP).toString());
    ctx.textAlign = "center";
    ctx.fillStyle = "#474747";
    ctx.globalAlpha = 1;
    ctx.font = '30px "Sans Serif"';
    ctx.fillText(textXPEdited, 730, 180);

    return {
      attachment: canvas.toBuffer("image/webp"),
      description: AttachmentDesc,
      name: AttachmentName,
    };
  } catch (err) {
    console.log(`[XP] Error Occured. | rankCard | Error: ${err.stack}`);
  }
}

function RoundedBox(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function shortener(count) {
  const COUNT_ABBRS = [
    "",
    "k",
    "M",
    "B",
    "T",
    "Q",
    "Q+",
    "S",
    "S+",
    "O",
    "N",
    "D",
    "U",
  ];
  const i = count === 0 ? 0 : Math.floor(Math.log(count) / Math.log(1000));
  let result = parseFloat((count / Math.pow(1000, i)).toFixed(2));
  result += COUNT_ABBRS[i];
  return result;
}
