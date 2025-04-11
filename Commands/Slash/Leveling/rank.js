import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pkg from "@napi-rs/canvas";
const { createCanvas, loadImage, GlobalFonts } = pkg;
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import levelModel from "../../../schema/level.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Register font on module load
try {
  GlobalFonts.registerFromPath(
    join(__dirname, "Fonts", "Baloo-Regular.ttf"),
    "Sans Serif"
  );
} catch (err) {
  console.warn("Could not load rank card font:", err);
}

export default {
  name: "rank",
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Display your or another user's rank card")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to check rank for")
        .setRequired(false)
    ),

  category: "Leveling",
  cooldown: 60,
  botPermissions: ["ATTACH_FILES"],
  usage: "[user]",
  description: "Display your or another user's rank card",

  run: async ({ client, interaction }) => {
    try {
      await interaction.deferReply();

      const targetUser =
        interaction.options.getUser("user") || interaction.user;

      // Send initial embed while generating rank card
      const preEmbed = new EmbedBuilder()
        .setTitle(`${targetUser.username}'s Rank`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
        .setColor("Random")
        .setFooter({ text: "Generating rank card..." })
        .setTimestamp();

      const initialReply = await interaction.editReply({ embeds: [preEmbed] });

      // Get user's XP data
      const userData = await levelModel.findOne({
        user: targetUser.id,
        guild: interaction.guild.id,
      });

      // Handle first-time users gracefully
      if (!userData) {
        const newUserEmbed = EmbedBuilder.from(preEmbed)
          .setDescription("This user hasn't earned any XP yet!")
          .setFooter({ text: "Start chatting to earn XP!" });
        return interaction.editReply({ embeds: [newUserEmbed] });
      }

      // Calculate rank position
      const leaderboard = await levelModel
        .find({ guild: interaction.guild.id })
        .sort({ xp: -1 })
        .exec();
      const position =
        leaderboard.findIndex((i) => i.user === targetUser.id) + 1;

      // Calculate XP needed for next level
      const targetLevel = userData.level + 1;
      const neededXP = targetLevel * targetLevel * 100;

      // Generate rank card
      try {
        const rankImage = await rankCard(interaction, {
          level: userData.level,
          currentXP: userData.xp,
          neededXP,
          rank: position,
          background: "https://i.ibb.co/SBgxdRH/R-1.jpg",
          color: "#ff0000",
          lvlbar: "#DCD427",
          lvlbarBg: "#000000",
          member: targetUser,
        });

        // Update embed with rank info and card
        const finalEmbed = EmbedBuilder.from(preEmbed)
          .setDescription(
            `**Level:** ${userData.level}\n**XP:** ${userData.xp}\n**Position:** #${position}`
          )
          .setImage(`attachment://${rankImage.name}`)
          .setFooter({ text: "Rank card generated." });

        await interaction.editReply({
          embeds: [finalEmbed],
          files: [{ attachment: rankImage.attachment, name: rankImage.name }],
        });
      } catch (error) {
        console.error("Rank card generation error:", error);
        // Fallback to text-only display if image generation fails
        const fallbackEmbed = EmbedBuilder.from(preEmbed)
          .setDescription(
            `**Level:** ${userData.level}\n**XP:** ${userData.xp}\n**Position:** #${position}`
          )
          .setFooter({ text: "Could not generate rank card image." });
        await interaction.editReply({ embeds: [fallbackEmbed] });
      }
    } catch (error) {
      console.error("Rank command error:", error);
      return interaction.editReply({
        content: "An error occurred while retrieving rank information.",
      });
    }
  },
};

async function rankCard(interaction, options = {}) {
  try {
    const member = options.member;
    const canvas = createCanvas(1080, 400);
    const ctx = canvas.getContext("2d");

    const name = member.tag;
    const noSymbols = (string) => string.replace(/[-]/g, "");

    let fsiz = "45px";
    if (interaction.guild.name.length >= 23) fsiz = "38px";
    if (interaction.guild.name.length >= 40) fsiz = "28px";
    if (interaction.guild.name.length >= 63) fsiz = "22px";

    const BackgroundRadius = 20;
    const BackGroundImg = options.background;
    const AttachmentName = "rank.png";
    const AttachmentDesc = "Rank Card";
    const Username = noSymbols(name);
    const AvatarRoundRadius = 50;
    const DrawLayerColor = "#000000";
    const DrawLayerOpacity = 0.4;
    const BoxColor = options.color;
    const LevelBarFill = options.lvlbar;
    const LevelBarBackground = options.lvlbarBg;
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
    const background = await loadImage(BackGroundImg);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(background, 0, 0, 1080, 400);
    ctx.restore();

    ctx.fillStyle = DrawLayerColor;
    ctx.globalAlpha = DrawLayerOpacity;
    ctx.fillRect(40, 0, 240, canvas.height);
    ctx.globalAlpha = 1;

    const avatar = await loadImage(
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
    ctx.fillText(interaction.guild.name, 720, 355);
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
      attachment: canvas.toBuffer("image/png"),
      description: AttachmentDesc,
      name: AttachmentName,
    };
  } catch (err) {
    console.error("Rank card generation error:", err);
    throw err;
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
