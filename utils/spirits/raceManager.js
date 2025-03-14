import {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} from "discord.js";
import { LOCATIONS } from "./locationManager.js";
import { SPIRIT_POWERS } from "./spiritPowers.js";
import profileSchema from "../../schema/profile.js";

const RACE_STATES = {
  WAITING: "waiting",
  IN_PROGRESS: "in_progress",
  FINISHED: "finished",
};

const RACE_DURATION = 60000; // 1 minute race
const MIN_BET = 100;
const MAX_BET = 10000;

class Race {
  constructor(host, spirit, track, bet) {
    this.host = host;
    this.spirit = spirit;
    this.track = track;
    this.bet = bet;
    this.participants = [];
    this.state = RACE_STATES.WAITING;
    this.startTime = null;
    this.positions = new Map();
    this.hazardEffects = new Map();
  }

  addParticipant(user, spirit, bet) {
    if (this.state !== RACE_STATES.WAITING) return false;

    this.participants.push({ user, spirit, bet });
    return true;
  }

  // Calculate position changes based on spirit stats and track conditions
  calculateProgress(participant, elapsedTime) {
    const spirit = SPIRIT_POWERS[participant.spirit];
    const location = LOCATIONS[this.track];

    if (!spirit || !location) return 0;

    // Base speed calculation
    let progress = (elapsedTime / RACE_DURATION) * 100;

    // Spirit stat influences
    const speedMultiplier =
      (spirit.abilities ? Object.values(spirit.abilities).length : 1) * 0.1 + 1;

    // Track hazard effects
    if (!this.hazardEffects.has(participant.user.id)) {
      for (const hazard of location.hazards) {
        if (Math.random() < hazard.risk) {
          this.hazardEffects.set(participant.user.id, {
            name: hazard.name,
            penalty: hazard.damage / 100,
          });
          break;
        }
      }
    }

    // Apply hazard penalties
    const hazard = this.hazardEffects.get(participant.user.id);
    const hazardMultiplier = hazard ? 1 - hazard.penalty : 1;

    // Track bonuses
    const trackBonus = location.bonuses.reduce((bonus, effect) => {
      return bonus * (effect.effect === "power_boost" ? effect.value : 1);
    }, 1);

    // Calculate final progress
    return Math.min(
      100,
      progress * speedMultiplier * hazardMultiplier * trackBonus
    );
  }

  async start(interaction) {
    if (this.state !== RACE_STATES.WAITING) return false;

    this.state = RACE_STATES.IN_PROGRESS;
    this.startTime = Date.now();

    const raceEmbed = new EmbedBuilder()
      .setTitle(`🏃 Spirit Race: ${this.track}`)
      .setDescription("The race has begun!")
      .setColor("#00ff00");

    const updateInterval = setInterval(async () => {
      const elapsedTime = Date.now() - this.startTime;

      if (elapsedTime >= RACE_DURATION) {
        clearInterval(updateInterval);
        await this.finish(interaction);
        return;
      }

      // Update positions
      const positions = [];
      [
        ...this.participants,
        { user: this.host, spirit: this.spirit, bet: this.bet },
      ].forEach((participant) => {
        const progress = this.calculateProgress(participant, elapsedTime);
        this.positions.set(participant.user.id, progress);
        positions.push({
          user: participant.user.username,
          spirit: participant.spirit,
          progress,
        });
      });

      // Sort by progress
      positions.sort((a, b) => b.progress - a.progress);

      // Update race visualization
      const raceTrack = positions.map((pos) => {
        const track = "🏁" + "=".repeat(20) + "🏁";
        const position = Math.floor((pos.progress / 100) * 20);
        return (
          track.substring(0, position) + "🏃" + track.substring(position + 1)
        );
      });

      raceEmbed.setDescription(
        positions
          .map(
            (pos, index) =>
              `${index + 1}. ${pos.user} (${pos.spirit})\n${raceTrack[index]}\n`
          )
          .join("\n")
      );

      await interaction.editReply({ embeds: [raceEmbed] });
    }, 2000);

    return true;
  }

  async finish(interaction) {
    this.state = RACE_STATES.FINISHED;

    // Sort final positions
    const finalPositions = [...this.positions.entries()].sort(
      (a, b) => b[1] - a[1]
    );

    // Calculate rewards
    const winners = [];
    const losers = [];

    for (const [userId, progress] of finalPositions) {
      const participant =
        userId === this.host.id
          ? { user: this.host, spirit: this.spirit, bet: this.bet }
          : this.participants.find((p) => p.user.id === userId);

      if (!participant) continue;

      // Award based on position
      const position = finalPositions.findIndex(([id]) => id === userId);
      const multiplier =
        position === 0 ? 2 : position === 1 ? 1.5 : position === 2 ? 1.2 : 0.5;

      const reward = Math.floor(participant.bet * multiplier);

      try {
        const userProfile = await profileSchema.findOne({
          userid: participant.user.id,
        });
        if (userProfile) {
          if (reward > participant.bet) {
            winners.push({
              user: participant.user.username,
              profit: reward - participant.bet,
            });
            await profileSchema.findOneAndUpdate(
              { userid: participant.user.id },
              { balance: userProfile.balance + reward }
            );
          } else {
            losers.push({
              user: participant.user.username,
              loss: participant.bet - reward,
            });
            await profileSchema.findOneAndUpdate(
              { userid: participant.user.id },
              { balance: userProfile.balance + reward }
            );
          }
        }
      } catch (error) {
        console.error("Error updating balance:", error);
      }
    }

    // Create results embed
    const resultsEmbed = new EmbedBuilder()
      .setTitle(`🏁 Race Results: ${this.track}`)
      .setDescription(
        "**Final Standings:**\n" +
          finalPositions
            .map(([userId], index) => {
              const participant =
                userId === this.host.id
                  ? { user: this.host, spirit: this.spirit }
                  : this.participants.find((p) => p.user.id === userId);
              return `${index + 1}. ${participant.user.username} (${
                participant.spirit
              })`;
            })
            .join("\n") +
          "\n\n**Rewards:**\n" +
          winners
            .map((w) => `${w.user} won ${w.profit} Spirit Coins!`)
            .join("\n") +
          "\n" +
          losers.map((l) => `${l.user} lost ${l.loss} Spirit Coins!`).join("\n")
      )
      .setColor("#ffd700");

    await interaction.editReply({ embeds: [resultsEmbed], components: [] });
  }
}

// Active races storage
const activeRaces = new Map();

export const createRace = (host, spirit, track, bet) => {
  const raceId = Math.random().toString(36).substring(2, 15);
  const race = new Race(host, spirit, track, bet);
  activeRaces.set(raceId, race);
  return raceId;
};

export const joinRace = (raceId, user, spirit, bet) => {
  const race = activeRaces.get(raceId);
  if (!race) return false;
  return race.addParticipant(user, spirit, bet);
};

export const startRace = async (raceId, interaction) => {
  const race = activeRaces.get(raceId);
  if (!race) return false;
  const success = await race.start(interaction);
  if (success) {
    setTimeout(() => {
      activeRaces.delete(raceId);
    }, RACE_DURATION + 5000);
  }
  return success;
};

export const getRace = (raceId) => activeRaces.get(raceId);

export const RACE_CONSTANTS = {
  MIN_BET,
  MAX_BET,
  RACE_DURATION,
};
