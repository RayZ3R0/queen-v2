import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import {
  Character,
  InteractiveBattleEngine,
} from "../../../utils/InteractiveBattleEngine.js";
import profileSchema from "../../../schema/profile.js";
import spiritSchema from "../../../schema/spirits.js";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get __dirname in an ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load the spirits JSON data
const spiritJsonPath = join(__dirname, "../../../spirits.json");
const spiritJson = JSON.parse(fs.readFileSync(spiritJsonPath, "utf-8"));

// Fallback defaults if JSON lookup fails
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

export default {
  name: "duel",
  category: "Spirits",
  cooldown: 120,
  data: new SlashCommandBuilder()
    .setName("duel")
    .setDescription("Challenge another spirit user to an interactive battle!")
    .addUserOption((option) =>
      option
        .setName("opponent")
        .setDescription("The player to duel against (optional)")
        .setRequired(false)
    ),

  run: async ({ client, interaction }) => {
    try {
      await interaction.deferReply();

      // Get target user or default to the command user
      const enemyUser =
        interaction.options.getUser("opponent") || interaction.user;

      // --- FETCH PLAYER SPIRIT ---
      const playerProfile = await profileSchema.findOne({
        userid: interaction.user.id,
      });
      let playerDbSpirit;
      if (playerProfile && playerProfile.selected) {
        playerDbSpirit = await spiritSchema.findOne({
          id: playerProfile.selected,
          husband: interaction.user.id,
        });
      }
      // Fallback default name and stars if no valid spirit found in DB
      if (!playerDbSpirit) {
        playerDbSpirit = {
          name: "Kurumi Tokisaki",
          stars: 3,
        };
      }
      // Use spirit name from DB to lookup stats from JSON
      const playerName = playerDbSpirit.name;
      const playerData = spiritJson[playerName] || defaultStats;
      const playerStars = playerDbSpirit.stars || 3;

      // --- FETCH ENEMY SPIRIT ---
      let enemyDbSpirit;
      if (enemyUser.id !== interaction.user.id) {
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
      // Fallback if no valid enemy spirit found
      if (!enemyDbSpirit) {
        enemyDbSpirit = {
          name: "Miku Izayoi",
          stars: enemyUser.id === interaction.user.id ? 3 : 2,
        };
      }
      const enemyName = enemyDbSpirit.name;
      const enemyData = spiritJson[enemyName] || enemyDefaultStats;
      const enemyStars =
        enemyDbSpirit.stars || (enemyUser.id === interaction.user.id ? 3 : 2);

      // Build character stat objects
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

      // Create character objects
      const playerCharacter = new Character(
        playerName,
        playerStats,
        playerStats.abilities,
        interaction.user,
        playerStars
      );
      const enemyCharacter = new Character(
        enemyName,
        enemyStats,
        enemyStats.abilities,
        enemyUser,
        enemyStars
      );

      // Create and start battle engine
      const battle = new InteractiveBattleEngine(
        playerCharacter,
        enemyCharacter,
        interaction
      );
      battle.start();
    } catch (error) {
      console.error("Duel command error:", error);
      await interaction.editReply({
        content: "An error occurred while starting the duel.",
      });
    }
  },
};
