import { EmbedBuilder } from "discord.js";
import { promisify } from "util";
const wait = promisify(setTimeout);

// AbilityEffects mapping for easy extensibility.
const AbilityEffects = {
  // Zayin: stops time so that the attacker lands 2–3 extra attacks without evasion.
  Zayin: (attacker, target) => {
    const numSlashes = Math.floor(Math.random() * 2) + 2; // either 2 or 3
    let totalDamage = 0;
    let details = `${attacker.name} stops time and shoots ${numSlashes} bullets:\n`;
    for (let i = 0; i < numSlashes; i++) {
      // Bypass evasion for these strikes.
      const minDamage = attacker.stats.strength * 0.5;
      const rawDamage =
        Math.random() * (attacker.stats.strength - minDamage) + minDamage;
      const multiplier =
        attacker.stats.strength /
        (attacker.stats.strength + target.stats.defence);
      const slashDamage = Math.max(1, Math.floor(rawDamage * multiplier));
      target.currentHP -= slashDamage;
      totalDamage += slashDamage;
      details += `  Shot ${i + 1}: ${slashDamage} damage\n`;
    }
    details += `Total damage dealt: ${totalDamage}.`;
    return { totalDamage, message: details };
  },

  // Solo ability: Brainwashes the target, forcing it to attack itself.
  // The self-inflicted damage is calculated using the normal attack formula on the target's own stats with defence,
  // then multiplied by a random factor between 2 and 3.
  Solo: (attacker, target) => {
    const minDamage = target.stats.strength * 0.5;
    const rawDamage =
      Math.random() * (target.stats.strength - minDamage) + minDamage;
    const baseDamage = Math.max(
      1,
      Math.floor(
        rawDamage *
          (target.stats.strength /
            (target.stats.strength + target.stats.defence))
      )
    );
    const factor = 2 + Math.random(); // Random factor between 2 and 3.
    const damage = Math.floor(baseDamage * factor);
    target.currentHP -= damage;
    const message =
      `${attacker.name} performs Solo, brainwashing ${target.name}!\n` +
      `${target.name} is forced to attack herself for ${damage} damage.`;
    return { totalDamage: damage, message };
  },
};

const STARMOJI = "<:starSpin:1341872573348315136>";

// Helper to return the stars string for cosmetic display in the description.
const printStars = (starCount) => {
  const maxStars = 5;
  const displayCount = Math.min(starCount, maxStars);
  const extraStars = starCount > maxStars ? `+${starCount - maxStars}` : "";
  return `【${STARMOJI.repeat(displayCount)}${extraStars}】`;
};

export class Character {
  constructor(name, stats, abilities, user, stars) {
    this.name = name;
    this.stats = stats; // { hp, strength, defence, agility }
    this.currentHP = stats.hp;
    this.abilities = abilities;
    this.user = user;
    this.energy = 0;
    this.stars = stars;
  }

  // Revised evasion system: chance to evade is based solely on agility.
  attack(target) {
    // Evasion Check:
    const totalAgility = this.stats.agility + target.stats.agility;
    // Use a reduced factor so evasion is rare.
    const reductionFactor = 0.2;
    const evadeChance = (target.stats.agility / totalAgility) * reductionFactor;
    if (Math.random() < evadeChance) {
      // Attack is evaded.
      return -1;
    }
    // Calculate a base damage between 50% and 100% of strength.
    const minDamage = this.stats.strength * 0.5;
    const rawDamage =
      Math.random() * (this.stats.strength - minDamage) + minDamage;
    const multiplier =
      this.stats.strength / (this.stats.strength + target.stats.defence);
    const damage = Math.max(1, Math.floor(rawDamage * multiplier));
    target.currentHP -= damage;
    return damage;
  }

  useAbility(abilityName, target) {
    console.log(`${this.name} uses ${abilityName}!`);
    if (AbilityEffects.hasOwnProperty(abilityName)) {
      return AbilityEffects[abilityName](this, target);
    }
    // Fallback: if no special effect is defined, simply perform a normal attack.
    return this.attack(target);
  }
}

export class BattleEngine {
  constructor(player, enemy, embed, message) {
    this.player = player;
    this.enemy = enemy;
    this.embed = embed;
    this.message = message;
    this.round = 1;
  }

  progressBar(current, max, size = 10) {
    const fillBar = "█";
    const emptyBar = "░";
    const safeCurrent = Math.max(0, current);
    let fill = Math.round((size * safeCurrent) / (max || 1));
    if (fill > size) fill = size;
    return fillBar.repeat(fill) + emptyBar.repeat(size - fill);
  }

  updateEmbed(actionDetails = "") {
    this.embed
      .setDescription(
        `
${actionDetails ? `${actionDetails}\n\n` : ""}
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
Energy: ${this.enemy.energy}/100
                `
      )
      .setFooter({ text: `Round ${this.round}` });
    this.message.edit({ embeds: [this.embed] });
  }

  async start() {
    this.updateEmbed("Battle Start!");
    await wait(2000);

    while (
      this.player.currentHP > 0 &&
      this.enemy.currentHP > 0 &&
      this.round < 25
    ) {
      let actionMessage = "";
      let dmg;
      // Player's Turn:
      if (this.player.energy >= 100) {
        this.player.energy -= 100;
        const ability = this.player.abilities[0] || "Attack";
        dmg = this.player.useAbility(ability, this.enemy);
        if (typeof dmg === "object") {
          actionMessage = `**${this.player.name}** activated **${ability}**:\n${dmg.message}`;
        } else if (dmg === -1) {
          actionMessage = `**${this.enemy.name}** evaded **${this.player.name}**’s **${ability}**!`;
        } else {
          actionMessage = `**${this.player.name}** used **${ability}** and dealt **${dmg}** damage!`;
        }
      } else {
        dmg = this.player.attack(this.enemy);
        if (dmg === -1) {
          actionMessage = `**${this.enemy.name}** evaded **${this.player.name}**’s attack!`;
        } else {
          actionMessage = `**${this.player.name}** attacked and dealt **${dmg}** damage!`;
        }
      }
      this.updateEmbed(actionMessage);
      await wait(2000);

      if (this.enemy.currentHP <= 0) break;

      // Enemy's Turn:
      if (this.enemy.energy >= 100) {
        this.enemy.energy -= 100;
        const ability = this.enemy.abilities[0] || "Attack";
        dmg = this.enemy.useAbility(ability, this.player);
        if (typeof dmg === "object") {
          actionMessage = `**${this.enemy.name}** activated **${ability}**:\n${dmg.message}`;
        } else if (dmg === -1) {
          actionMessage = `**${this.player.name}** evaded **${this.enemy.name}**’s **${ability}**!`;
        } else {
          actionMessage = `**${this.enemy.name}** used **${ability}** and dealt **${dmg}** damage!`;
        }
      } else {
        dmg = this.enemy.attack(this.player);
        if (dmg === -1) {
          actionMessage = `**${this.player.name}** evaded **${this.enemy.name}**’s attack!`;
        } else {
          actionMessage = `**${this.enemy.name}** attacked and dealt **${dmg}** damage!`;
        }
      }
      this.updateEmbed(actionMessage);
      await wait(2000);

      // End-of-round energy buildup.
      this.player.energy += 25;
      this.enemy.energy += 25;
      this.round++;
      this.updateEmbed(`End of Round ${this.round - 1}`);
      await wait(2000);
    }

    const winner =
      this.player.currentHP > this.enemy.currentHP ? this.player : this.enemy;
    this.message.channel.send(`**${winner.name} wins the battle!**`);
  }
}
