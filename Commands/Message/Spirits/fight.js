import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import { Character, BattleEngine } from "../../../utils/BattleEngine.js";
import profileSchema from "../../../schema/profile.js";
import spiritSchema from "../../../schema/spirits.js";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get __dirname in an ES module.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the spirits JSON data.
const spiritJsonPath = join(__dirname, "../../../spirits.json");
const spiritJson = JSON.parse(fs.readFileSync(spiritJsonPath, "utf-8"));

// Fallback defaults if JSON lookup fails.
const defaultStats = {
  hp: 500,
  strength: 100,
  defence: 30,
  agility: 20,
  abilities: ["PowerStrike"],
};
const enemyDefaultStats = {
  hp: 450,
  strength: 90,
  defence: 25,
  agility: 15,
  abilities: ["Bash"],
};

const STARMOJI = "<:starSpin:1341872573348315136>";

// Helper to return the stars string for cosmetic display in the description.
const printStars = (starCount) => {
  const maxStars = 5;
  const displayCount = Math.min(starCount, maxStars);
  const extraStars = starCount > maxStars ? `+${starCount - maxStars}` : "";
  return `【${STARMOJI.repeat(displayCount)}${extraStars}】`;
};

const SPIRIT_IMAGES = {
  "Kurumi Tokisaki": join(__dirname, "../../../SpiritImages/kurumi.jpg"),
  "Miku Izayoi": join(__dirname, "../../../SpiritImages/miku.jpg"),
  "Nia Honjou": join(__dirname, "../../../SpiritImages/nia.jpg"),
  "Tohka Yatogami": join(__dirname, "../../../SpiritImages/tohka.jpeg"),
  "Tobiichi Origami": join(__dirname, "../../../SpiritImages/origami.png"),
};

export default {
  name: "fight",
  aliases: ["duel", "ft"],
  description: "Fight!",
  usage: "[@user]",
  cooldown: 10,
  userPermissions: [],
  botPermissions: [],
  category: "Spirits",
  owneronly: true,
  run: async ({ client, message, args, prefix }) => {
    // Determine enemy user.
    const enemyUser = message.mentions.users.first() || message.author;

    // --- FETCH PLAYER SPIRIT ---
    // Get player profile and then the selected spirit from the database.
    const playerProfile = await profileSchema.findOne({
      userid: message.author.id,
    });
    let playerDbSpirit;
    if (playerProfile && playerProfile.selected) {
      playerDbSpirit = await spiritSchema.findOne({
        id: playerProfile.selected,
        husband: message.author.id,
      });
    }
    // If no valid spirit found in DB, fallback default name and stars.
    if (!playerDbSpirit) {
      playerDbSpirit = {
        name: "Kurumi Tokisaki",
        stars: 3,
      };
    }
    // Use the spirit name from DB to lookup stats from the JSON.
    const playerName = playerDbSpirit.name;
    const playerData = spiritJson[playerName] || defaultStats; // fallback if not found in JSON
    // Preserve stars from DB.
    const playerStars = playerDbSpirit.stars || 3;

    // --- FETCH ENEMY SPIRIT ---
    let enemyDbSpirit;
    if (enemyUser.id !== message.author.id) {
      const enemyProfile = await profileSchema.findOne({
        userid: enemyUser.id,
      });
      if (enemyProfile && enemyProfile.selected) {
        enemyDbSpirit = await spiritSchema.findOne({
          id: enemyProfile.selected,
          husband: enemyUser.id,
        });
      }
    }
    // Fallback if no valid enemy spirit found.
    if (!enemyDbSpirit) {
      enemyDbSpirit = {
        name: "Miku Izayoi",
        stars: enemyUser.id === message.author.id ? 3 : 2,
      };
    }
    const enemyName = enemyDbSpirit.name;
    const enemyData = spiritJson[enemyName] || enemyDefaultStats;
    const enemyStars =
      enemyDbSpirit.stars || (enemyUser.id === message.author.id ? 3 : 2);

    // Build character stat objects.
    const playerStats = {
      hp: playerData.hp,
      strength: playerData.strength,
      defence: playerData.defence,
      agility: playerData.agility,
      abilities: playerData.abilities,
    };
    const enemyStats = {
      hp: enemyData.hp,
      strength: enemyData.strength,
      defence: enemyData.defence,
      agility: enemyData.agility,
      abilities: enemyData.abilities,
    };

    // Create character objects.
    const playerCharacter = new Character(
      playerName,
      playerStats,
      playerStats.abilities,
      message.author,
      playerStars
    );
    const enemyCharacter = new Character(
      enemyName,
      enemyStats,
      enemyStats.abilities,
      enemyUser,
      enemyStars
    );

    const enemyAttachment = new AttachmentBuilder(SPIRIT_IMAGES[enemyName], {
      name: "enemy.jpg",
    });
    const playerAttachment = new AttachmentBuilder(SPIRIT_IMAGES[playerName], {
      name: "player.jpg",
    });

    // Create a battle embed.
    // Title uses Discord usernames; description shows the spirit names with cosmetic stars.
    const battleEmbed = new EmbedBuilder()
      .setColor("#ff0000")
      .setTitle(`${message.author.username} vs ${enemyUser.username}`)
      .setDescription(
        `**${playerName} ${printStars(playerStars)}**\n` +
          `**${enemyName} ${printStars(enemyStars)}**\n\n` +
          "Preparing for battle..."
      )
      .setThumbnail("attachment://enemy.jpg")
      .setImage("attachment://player.jpg");

    const embedMessage = await message.channel.send({
      embeds: [battleEmbed],
      files: [enemyAttachment, playerAttachment],
    });
    // Instantiate and start the battle engine.
    const battle = new BattleEngine(
      playerCharacter,
      enemyCharacter,
      battleEmbed,
      embedMessage
    );
    battle.start();
  },
};
