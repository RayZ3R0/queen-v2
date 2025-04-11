import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import { LOCATIONS } from "../../../utils/spirits/locationManager.js";
import {
  SPACEQUAKE_CONSTANTS,
  generateEncounter,
  generateBoss,
  calculateRewards,
  createEncounterEmbed,
  createBossEmbed,
} from "../../../utils/spirits/spacequakeSystem.js";
import profileSchema from "../../../schema/profile.js";
import spacequakeProgress from "../../../schema/spacequakeProgress.js";
import seasonPass from "../../../schema/seasonPass.js";

export default {
  name: "spacequake",
  data: new SlashCommandBuilder()
    .setName("spacequake")
    .setDescription("Enter a spacequake zone to find spirits and rewards")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("explore")
        .setDescription("Explore a spacequake zone")
        .addStringOption((option) =>
          option
            .setName("location")
            .setDescription("Choose your exploration location")
            .setRequired(true)
            .addChoices(
              { name: "Tenguu City", value: "Tenguu City" },
              { name: "Raizen High School", value: "Raizen High School" },
              { name: "DEM Industries HQ", value: "DEM Industries HQ" },
              { name: "Fraxinus", value: "Fraxinus" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("raid")
        .setDescription(
          "Create or join a raid group for spacequake exploration"
        )
        .addStringOption((option) =>
          option
            .setName("action")
            .setDescription("Choose to create or join a raid")
            .setRequired(true)
            .addChoices(
              { name: "Create", value: "create" },
              { name: "Join", value: "join" }
            )
        )
        .addStringOption((option) =>
          option
            .setName("code")
            .setDescription("Raid code (required for joining)")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("season")
        .setDescription("View your season pass progress")
    ),
  category: "Spirits",
  cooldown: 1800, // 30 minutes
  run: async ({ client, interaction }) => {
    try {
      const subcommand = interaction.options.getSubcommand();
      const userProfile = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      if (!userProfile?.selected || userProfile.selected === "None") {
        return interaction.reply({
          content: "You need to select a spirit first using `/select`!",
          ephemeral: true,
        });
      }

      let progress = await spacequakeProgress.findOne({
        userid: interaction.user.id,
      });

      if (!progress) {
        progress = new spacequakeProgress({
          userid: interaction.user.id,
        });
        await progress.save();
      }

      // Daily exploration limit check
      const MAX_DAILY_EXPLORATIONS = 10;
      if (
        progress.dailyExplorations >= MAX_DAILY_EXPLORATIONS &&
        subcommand === "explore"
      ) {
        return interaction.reply({
          content:
            "You've reached your daily spacequake exploration limit! Come back tomorrow.",
          ephemeral: true,
        });
      }

      switch (subcommand) {
        case "explore": {
          const location = interaction.options.getString("location");
          await interaction.deferReply();

          // Generate encounter
          const encounter = generateEncounter(
            progress.totalExplorations + 1,
            location
          );
          let embed;
          let rewards;

          if (encounter) {
            // Create encounter interaction buttons
            const fightButton = new ButtonBuilder()
              .setCustomId("fight")
              .setLabel("Fight")
              .setStyle(ButtonStyle.Danger);

            const evadeButton = new ButtonBuilder()
              .setCustomId("evade")
              .setLabel("Evade")
              .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(
              fightButton,
              evadeButton
            );
            embed = createEncounterEmbed(encounter);

            const response = await interaction.editReply({
              embeds: [embed],
              components: [row],
            });

            // Collect button interaction
            const filter = (i) => i.user.id === interaction.user.id;
            const collector = response.createMessageComponentCollector({
              filter,
              time: 30000,
            });

            collector.on("collect", async (i) => {
              const performance =
                i.customId === "fight"
                  ? Math.random() * 0.5 + 0.5 // 50-100% performance for fighting
                  : Math.random() * 0.3 + 0.2; // 20-50% performance for evading

              rewards = calculateRewards(encounter, performance);

              // Update progress and profile
              progress.dailyExplorations++;
              progress.totalExplorations++;
              if (encounter.type === "combat")
                progress.achievements.bossEncounters++;

              await progress.save();

              // Update user profile with rewards
              await profileSchema.findOneAndUpdate(
                { userid: interaction.user.id },
                {
                  $inc: {
                    balance: rewards.coins,
                    "achievements.totalCoins": rewards.coins,
                  },
                }
              );

              // Add season XP
              const seasonXP = Math.floor(rewards.coins * 0.1);
              await progress.addSeasonXP(seasonXP);

              // Update embed with results
              embed = createEncounterEmbed(encounter, rewards);
              await i.update({
                embeds: [embed],
                components: [],
              });

              collector.stop();
            });

            collector.on("end", async (collected) => {
              if (collected.size === 0) {
                await interaction.editReply({
                  content: "You took too long to respond!",
                  components: [],
                });
              }
            });
          } else {
            // No special encounter, give base rewards
            rewards = {
              coins: SPACEQUAKE_CONSTANTS.BASE_REWARDS.coins,
              fragments: SPACEQUAKE_CONSTANTS.BASE_REWARDS.fragments,
            };

            await profileSchema.findOneAndUpdate(
              { userid: interaction.user.id },
              { $inc: { balance: rewards.coins } }
            );

            embed = new EmbedBuilder()
              .setTitle("Spacequake Exploration")
              .setDescription(
                `You explored ${location} and found:\n` +
                  `• ${rewards.coins} Spirit Coins\n` +
                  `• ${rewards.fragments} Spirit Fragments`
              )
              .setColor("#00ff00");

            await interaction.editReply({
              embeds: [embed],
            });
          }

          break;
        }

        case "raid": {
          const action = interaction.options.getString("action");
          const code = interaction.options.getString("code");

          if (action === "create") {
            if (!progress.canJoinParty()) {
              return interaction.reply({
                content: "You're already in a raid party!",
                ephemeral: true,
              });
            }

            const raidCode = Math.random()
              .toString(36)
              .substring(2, 8)
              .toUpperCase();
            await progress.joinParty(raidCode, userProfile.selected);

            const embed = new EmbedBuilder()
              .setTitle("Spacequake Raid Party Created")
              .setDescription(
                `Raid Code: \`${raidCode}\`\n\n` +
                  "Share this code with others to let them join your raid party!\n" +
                  `Party Size: 1/${SPACEQUAKE_CONSTANTS.MAX_PARTY_SIZE}`
              )
              .setColor("#00ff00");

            await interaction.reply({ embeds: [embed] });
          } else if (action === "join") {
            if (!code) {
              return interaction.reply({
                content: "Please provide a raid code to join!",
                ephemeral: true,
              });
            }

            if (!progress.canJoinParty()) {
              return interaction.reply({
                content: "You're already in a raid party!",
                ephemeral: true,
              });
            }

            // Find the raid party
            const partyLeader = await spacequakeProgress.findOne({
              "activeParty.partyId": code.toUpperCase(),
            });

            if (!partyLeader) {
              return interaction.reply({
                content: "Invalid raid code!",
                ephemeral: true,
              });
            }

            if (
              partyLeader.activeParty.length >=
              SPACEQUAKE_CONSTANTS.MAX_PARTY_SIZE
            ) {
              return interaction.reply({
                content: "This raid party is full!",
                ephemeral: true,
              });
            }

            await progress.joinParty(code.toUpperCase(), userProfile.selected);

            const embed = new EmbedBuilder()
              .setTitle("Joined Raid Party")
              .setDescription(
                `Successfully joined the raid party!\n` +
                  `Party Size: ${partyLeader.activeParty.length + 1}/${
                    SPACEQUAKE_CONSTANTS.MAX_PARTY_SIZE
                  }`
              )
              .setColor("#00ff00");

            await interaction.reply({ embeds: [embed] });
          }
          break;
        }

        case "season": {
          const currentSeason = await seasonPass.findOne({
            endDate: { $gt: new Date() },
          });

          if (!currentSeason) {
            return interaction.reply({
              content: "No active season pass found!",
              ephemeral: true,
            });
          }

          const embed = new EmbedBuilder()
            .setTitle("Season Pass Progress")
            .setDescription(
              `Current Level: ${progress.seasonLevel}\n` +
                `XP: ${progress.seasonXP}/1000\n\n` +
                "**Next Rewards:**\n"
            )
            .setColor("#00ff00");

          // Find next unclaimed rewards
          const nextTier = currentSeason.tiers.find(
            (tier) =>
              tier.level > progress.seasonLevel ||
              (tier.level === progress.seasonLevel &&
                !progress.seasonRewards.claimed.includes(tier.level))
          );

          if (nextTier) {
            const rewards = currentSeason.getTierRewards(
              nextTier.level,
              progress.seasonRewards.premiumUnlocked
            );

            embed.addFields({
              name: `Level ${nextTier.level} Rewards`,
              value: `• ${rewards.coins} Spirit Coins\n• ${
                rewards.fragments
              } Spirit Fragments${
                rewards.items?.length
                  ? "\n• " + rewards.items.map((item) => item.name).join("\n• ")
                  : ""
              }`,
            });
          }

          await interaction.reply({ embeds: [embed] });
          break;
        }
      }
    } catch (error) {
      console.error("Error in spacequake command:", error);
      return interaction.reply({
        content: "An error occurred while processing the command.",
        ephemeral: true,
      });
    }
  },
};
