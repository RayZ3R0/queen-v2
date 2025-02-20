import { promisify } from "util";
import { AbilityEffects, normalAttackDamage } from "./abilities.js";
const wait = promisify(setTimeout);

const WAIT_TIME = 3500;

/* --- Utility for Cosmetic Output --- */
const STARMOJI = "<a:1006138461234937887:1342052087084613702>";
const printStars = (starCount) => {
  const maxStars = 5;
  const displayCount = Math.min(starCount, maxStars);
  const extraStars = starCount > maxStars ? `+${starCount - maxStars}` : "";
  return `【${STARMOJI.repeat(displayCount)}${extraStars}】`;
};

/* --- Character Class --- */
export class Character {
  constructor(name, stats, abilities, user, stars) {
    this.name = name;
    this.stats = stats; // { hp, strength, defence, agility }
    this.currentHP = stats.hp;
    this.abilities = abilities;
    this.user = user;
    this.energy = 0;
    this.stars = stars;
    this.stunTurns = 0;
  }

  // Revised attack using normalAttackDamage.
  attack(target) {
    const totalAgility = this.stats.agility + target.stats.agility;
    const reductionFactor = 0.2;
    const evadeChance = (target.stats.agility / totalAgility) * reductionFactor;
    if (Math.random() < evadeChance) return -1;
    const damage = normalAttackDamage(
      this.stats.strength,
      target.stats.defence
    );
    target.currentHP -= damage;
    return damage;
  }

  useAbility(abilityName, target) {
    console.log(`${this.name} uses ${abilityName}!`);
    if (AbilityEffects.hasOwnProperty(abilityName)) {
      return AbilityEffects[abilityName](this, target);
    }
    return this.attack(target);
  }
}

/* --- BattleEngine Class --- */
export class BattleEngine {
  constructor(player, enemy, embed, message) {
    this.player = player;
    this.enemy = enemy;
    this.embed = embed;
    this.message = message;
    this.round = 1;
    // Decide initiative based on a coin flip with slight agility bias.
    const totalAgility = this.player.stats.agility + this.enemy.stats.agility;
    // Bias factor scaled to 10% maximum influence.
    const bias =
      ((this.player.stats.agility - this.enemy.stats.agility) / totalAgility) *
      0.1;
    const playerFirstChance = 0.5 + bias; // base 50% adjusted by bias
    this.initiative = Math.random() < playerFirstChance ? "player" : "enemy";
  }

  progressBar(current, max, size = 10) {
    const fill = Math.min(
      size,
      Math.round((size * Math.max(0, current)) / (max || 1))
    );
    return "█".repeat(fill) + "░".repeat(size - fill);
  }

  updateEmbed(actionDetails = "") {
    this.embed
      .setDescription(
        `${actionDetails ? `${actionDetails}\n\n` : ""}
**Battle Status:**

**${this.player.user.username}’s ${this.player.name}** ${printStars(
          this.player.stars
        )}
HP: ${Math.max(0, this.player.currentHP)}/${
          this.player.stats.hp
        } ${this.progressBar(this.player.currentHP, this.player.stats.hp)}
Energy: ${this.player.energy}/100

**${this.enemy.user.username}’s ${this.enemy.name}** ${printStars(
          this.enemy.stars
        )}
HP: ${Math.max(0, this.enemy.currentHP)}/${
          this.enemy.stats.hp
        } ${this.progressBar(this.enemy.currentHP, this.enemy.stats.hp)}
Energy: ${this.enemy.energy}/100`
      )
      .setFooter({ text: `Round ${this.round}` });
    this.message.edit({ embeds: [this.embed] });
  }

  async start() {
    // Announce initiative result.
    const initMsg =
      this.initiative === "player"
        ? `Coin flip: **${this.player.name}** goes first!`
        : `Coin flip: **${this.enemy.name}** goes first!`;
    this.updateEmbed(`Battle Start!\n${initMsg}`);
    await wait(WAIT_TIME);

    while (
      this.player.currentHP > 0 &&
      this.enemy.currentHP > 0 &&
      this.round < 25
    ) {
      let actionMessage = "";
      let dmg;

      // Determine turn order based on initiative.
      if (this.initiative === "player") {
        // Player's turn first.
        actionMessage += await this.takeTurn(this.player, this.enemy);
        this.updateEmbed(actionMessage);
        await wait(WAIT_TIME);
        if (this.enemy.currentHP <= 0) break;
        // Then enemy's turn.
        actionMessage = await this.takeTurn(this.enemy, this.player);
      } else {
        // Enemy goes first.
        actionMessage += await this.takeTurn(this.enemy, this.player);
        this.updateEmbed(actionMessage);
        await wait(WAIT_TIME);
        if (this.player.currentHP <= 0) break;
        // Then player's turn.
        actionMessage = await this.takeTurn(this.player, this.enemy);
      }
      this.updateEmbed(actionMessage);
      await wait(WAIT_TIME);

      // End-of-round energy buildup.
      this.player.energy += 25;
      this.enemy.energy += 25;
      this.round++;
      this.updateEmbed(`End of Round ${this.round - 1}`);
      await wait(WAIT_TIME);
    }

    const winner =
      this.player.currentHP > this.enemy.currentHP ? this.player : this.enemy;
    this.message.channel.send(`**${winner.name} wins the battle!**`);
  }

  // Encapsulate turn-taking for modularity.
  async takeTurn(actor, target) {
    let msg = "";
    let dmg;
    if (actor.stunTurns > 0) {
      msg = `Due to Future Entry, **${actor.name}** misses their turn!`;
      actor.stunTurns--;
    } else if (actor.energy >= 100) {
      actor.energy -= 100;
      const ability =
        actor.abilities.length > 0
          ? actor.abilities[Math.floor(Math.random() * actor.abilities.length)]
          : "Attack";
      dmg = actor.useAbility(ability, target);
      if (typeof dmg === "object") {
        msg = `**${actor.name}** activated **${ability}**:\n${dmg.message}`;
      } else if (dmg === -1) {
        msg = `**${target.name}** evaded **${actor.name}**’s **${ability}**!`;
      } else {
        msg = `**${actor.name}** used **${ability}** and dealt **${dmg}** damage!`;
      }
    } else {
      dmg = actor.attack(target);
      msg =
        dmg === -1
          ? `**${target.name}** evaded **${actor.name}**’s attack!`
          : `**${actor.name}** attacked and dealt **${dmg}** damage!`;
    }
    return msg;
  }
}
