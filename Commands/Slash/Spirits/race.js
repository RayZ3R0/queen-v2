import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} from "discord.js";
import { LOCATIONS } from "../../../utils/spirits/locationManager.js";
import { SPIRIT_POWERS } from "../../../utils/spirits/spiritPowers.js";
import {
  createRace,
  joinRace,
  startRace,
  getRace,
  RACE_CONSTANTS,
} from "../../../utils/spirits/raceManager.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "race",
  data: new SlashCommandBuilder()
    .setName("race")
    .setDescription("Start or join a spirit race")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("create")
        .setDescription("Create a new race")
        .addStringOption((option) =>
          option
            .setName("track")
            .setDescription("Choose the race track")
            .setRequired(true)
            .addChoices(
              { name: "Tenguu City", value: "Tenguu City" },
              { name: "Raizen High School", value: "Raizen High School" },
              { name: "DEM Industries HQ", value: "DEM Industries HQ" },
              { name: "Fraxinus", value: "Fraxinus" }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName("bet")
            .setDescription("Amount of Spirit Coins to bet")
            .setRequired(true)
            .setMinValue(RACE_CONSTANTS.MIN_BET)
            .setMaxValue(RACE_CONSTANTS.MAX_BET)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("join")
        .setDescription("Join an existing race")
        .addStringOption((option) =>
          option
            .setName("id")
            .setDescription("Race ID to join")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("bet")
            .setDescription("Amount of Spirit Coins to bet")
            .setRequired(true)
            .setMinValue(RACE_CONSTANTS.MIN_BET)
            .setMaxValue(RACE_CONSTANTS.MAX_BET)
        )
    ),
  category: "Spirits",
  run: async ({ client, interaction }) => {
    try {
      const subcommand = interaction.options.getSubcommand();
      const userProfile = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      if (
        !userProfile ||
        !userProfile.selected ||
        userProfile.selected === "None"
      ) {
        return interaction.reply({
          content: "You need to select a spirit first using `/select`!",
          ephemeral: true,
        });
      }

      const bet = interaction.options.getInteger("bet");
      if (userProfile.balance < bet) {
        return interaction.reply({
          content: "You don't have enough Spirit Coins for this bet!",
          ephemeral: true,
        });
      }

      if (subcommand === "create") {
        const track = interaction.options.getString("track");
        const raceId = createRace(
          interaction.user,
          userProfile.selected,
          track,
          bet
        );

        // Deduct bet from user's balance
        await profileSchema.findOneAndUpdate(
          { userid: interaction.user.id },
          { balance: userProfile.balance - bet }
        );

        const joinButton = new ButtonBuilder()
          .setCustomId(`join_race_${raceId}`)
          .setLabel("Join Race")
          .setStyle(ButtonStyle.Primary);

        const startButton = new ButtonBuilder()
          .setCustomId(`start_race_${raceId}`)
          .setLabel("Start Race")
          .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(
          joinButton,
          startButton
        );

        const embed = new EmbedBuilder()
          .setTitle("🏃 Spirit Race Created!")
          .setDescription(
            `**Track:** ${track}\n` +
              `**Host:** ${interaction.user.username}\n` +
              `**Spirit:** ${userProfile.selected}\n` +
              `**Bet:** ${bet} Spirit Coins\n\n` +
              `Race ID: \`${raceId}\`\n` +
              "Use `/race join` with this ID to participate!"
          )
          .setColor("#00ff00");

        const reply = await interaction.reply({
          embeds: [embed],
          components: [row],
          fetchReply: true,
        });

        // Create collector for buttons
        const collector = reply.createMessageComponentCollector({
          time: 300000, // 5 minutes
        });

        collector.on("collect", async (i) => {
          const race = getRace(raceId);
          if (!race) {
            return i.reply({
              content: "This race no longer exists!",
              ephemeral: true,
            });
          }

          if (i.customId === `join_race_${raceId}`) {
            if (i.user.id === interaction.user.id) {
              return i.reply({
                content: "You can't join your own race!",
                ephemeral: true,
              });
            }

            // Check if user has a selected spirit and enough balance
            const joinProfile = await profileSchema.findOne({
              userid: i.user.id,
            });
            if (
              !joinProfile ||
              !joinProfile.selected ||
              joinProfile.selected === "None"
            ) {
              return i.reply({
                content: "You need to select a spirit first using `/select`!",
                ephemeral: true,
              });
            }

            if (joinProfile.balance < bet) {
              return i.reply({
                content: "You don't have enough Spirit Coins to match the bet!",
                ephemeral: true,
              });
            }

            // Deduct bet from joining user's balance
            await profileSchema.findOneAndUpdate(
              { userid: i.user.id },
              { balance: joinProfile.balance - bet }
            );

            if (joinRace(raceId, i.user, joinProfile.selected, bet)) {
              await i.reply({
                content: `You've joined the race with ${joinProfile.selected}!`,
                ephemeral: true,
              });

              // Update the embed to show new participant
              const updatedEmbed = EmbedBuilder.from(reply.embeds[0]);
              updatedEmbed.addFields({
                name: "Participants",
                value: race.participants
                  .map(
                    (p) =>
                      `${p.user.username} (${p.spirit}) - ${p.bet} Spirit Coins`
                  )
                  .join("\n"),
              });

              await reply.edit({
                embeds: [updatedEmbed],
              });
            } else {
              // Refund if join fails
              await profileSchema.findOneAndUpdate(
                { userid: i.user.id },
                { balance: joinProfile.balance }
              );

              return i.reply({
                content:
                  "Couldn't join the race. It might have already started.",
                ephemeral: true,
              });
            }
          } else if (i.customId === `start_race_${raceId}`) {
            if (i.user.id !== interaction.user.id) {
              return i.reply({
                content: "Only the race host can start the race!",
                ephemeral: true,
              });
            }

            await i.deferUpdate();
            if (await startRace(raceId, interaction)) {
              collector.stop();
            } else {
              return i.followUp({
                content: "Failed to start the race.",
                ephemeral: true,
              });
            }
          }
        });

        collector.on("end", () => {
          // Remove buttons after collector ends
          reply.edit({ components: [] }).catch(console.error);
        });
      } else if (subcommand === "join") {
        const raceId = interaction.options.getString("id");
        const race = getRace(raceId);

        if (!race) {
          return interaction.reply({
            content: "Invalid race ID or the race has ended.",
            ephemeral: true,
          });
        }

        if (race.host.id === interaction.user.id) {
          return interaction.reply({
            content: "You can't join your own race!",
            ephemeral: true,
          });
        }

        // Deduct bet from user's balance
        await profileSchema.findOneAndUpdate(
          { userid: interaction.user.id },
          { balance: userProfile.balance - bet }
        );

        if (joinRace(raceId, interaction.user, userProfile.selected, bet)) {
          return interaction.reply({
            content: `You've joined the race in ${race.track} with ${userProfile.selected}!`,
            ephemeral: true,
          });
        } else {
          // Refund if join fails
          await profileSchema.findOneAndUpdate(
            { userid: interaction.user.id },
            { balance: userProfile.balance }
          );

          return interaction.reply({
            content: "Couldn't join the race. It might have already started.",
            ephemeral: true,
          });
        }
      }
    } catch (error) {
      console.error("Error in race command:", error);
      return interaction.reply({
        content: "An error occurred while processing the race command.",
        ephemeral: true,
      });
    }
  },
};
