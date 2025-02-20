// This file contains helper functions and ability effects used in the game mechanics.
// Each ability manipulates attacker and target objects by altering their stats and HP.

/* --- Helper Functions --- */

// Generates a random number between min (inclusive) and max (exclusive)
export const getRandom = (min, max) => Math.random() * (max - min) + min;

// Calculates damage for a normal attack based on attacker's strength and target's defence.
// It first determines a lower bound for damage (50% of strength), then picks a random value between minDamage and strength.
// Finally, it scales the damage by the ratio of strength to the sum of strength and defence.
export const normalAttackDamage = (strength, defence) => {
  const minDamage = strength * 0.5;
  // Get a raw damage value between minDamage and full strength
  const rawDamage = getRandom(minDamage, strength);
  // Adjust the damage based on the target's defence, ensuring a minimum damage of 1
  return Math.max(1, Math.floor(rawDamage * (strength / (strength + defence))));
};

// Generates a random multiplier between 2 and 3, used in some special abilities.
export const randomMultiplier = () => 2 + Math.random();

/* --- Ability Effects --- */

// Object containing different abilities as methods
export const AbilityEffects = {
  // Zayin: Ability where the attacker stops time and shoots multiple bullets (slashes)
  Zayin: (attacker, target) => {
    // Decide on number of slashes: either 2 or 3
    const numSlashes = Math.floor(getRandom(2, 4));
    let totalDamage = 0;
    let details = `**${attacker.name}** stops time and shoots **${numSlashes}** bullets:\n`;

    // Loop to execute each bullet shot
    for (let i = 0; i < numSlashes; i++) {
      // Calculate damage for the current shot using normal attack damage formula
      const slashDamage = normalAttackDamage(
        attacker.stats.strength,
        target.stats.defence
      );
      // Deduct the damage from the target's current HP
      target.currentHP -= slashDamage;
      totalDamage += slashDamage;
      // Append details for the current shot to the message
      details += `- **Shot ${i + 1}:** \`${slashDamage}\` damage\n`;
    }
    // Append the total damage dealt to the message summary
    details += `\n**Total damage dealt:** \`${totalDamage}\``;
    // Return the total damage along with the detailed message
    return { totalDamage, message: details };
  },

  // Solo: Ability where the attacker forces the target to attack themselves.
  Solo: (attacker, target) => {
    // Compute base damage as if the target attacked themselves
    const baseDamage = normalAttackDamage(
      target.stats.strength,
      target.stats.defence
    );
    // Multiply the base damage with a random multiplier and round it down
    const damage = Math.floor(baseDamage * randomMultiplier());
    // Deduct the damage from the target's current HP
    target.currentHP -= damage;
    const message =
      `**${attacker.name}** performs **Solo**, brainwashing **${target.name}**!\n` +
      `\n*${target.name} is forced to attack herself for **${damage}** damage.*`;
    // Return the damage dealt and the descriptive message
    return { totalDamage: damage, message };
  },

  // Dalet: Ability that allows the attacker to heal themselves by rewinding time.
  Dalet: (attacker, _target) => {
    // If the attacker is already defeated, no action is taken
    if (attacker.currentHP <= 0) {
      return {
        totalDamage: 0,
        message: `${attacker.name} is already defeated!`,
      };
    }
    // Calculate a random healing percentage between 15% and 25%
    const healPercent = 0.15 + Math.random() * 0.1;
    // Apply a bonus multiplier if the attacker is a specific character
    const bonusMultiplier = attacker.name === "Kurumi Tokisaki" ? 1.1 : 1;
    // Calculate the heal amount based on the attacker's maximum HP (stats.hp)
    const healAmount = Math.floor(
      attacker.stats.hp * healPercent * bonusMultiplier
    );
    // Store the attacker's HP before healing for calculating the actual healed amount
    const previousHP = attacker.currentHP;
    // Increase the attacker's current HP without exceeding the maximum HP
    attacker.currentHP = Math.min(
      attacker.stats.hp,
      attacker.currentHP + healAmount
    );
    // Compute the actual obtained healing (in case healing capped at max HP)
    const actualHealed = attacker.currentHP - previousHP;
    // Create a message describing the healing effect
    const message = `**${attacker.name}** uses **Dalet** and rewinds time, healing for **${actualHealed}** HP!`;
    // Return the negative healing as negative damage (for tracking purposes) and the message
    return { totalDamage: -actualHealed, message };
  },

  // Fantasia: Ability that heals the attacker and increases their strength permanently.
  Fantasia: (attacker, _target) => {
    // Check if the attacker is defeated; if so, no action is taken.
    if (attacker.currentHP <= 0) {
      return {
        totalDamage: 0,
        message: `${attacker.name} is already defeated!`,
      };
    }
    // Calculate a healing percentage between 5% and 15%
    const healPercent = 0.05 + Math.random() * 0.1;
    // Determine the healing amount based on attacker's maximum HP
    const healAmount = Math.floor(attacker.stats.hp * healPercent);
    // Store the previous HP value in order to determine actual healing done
    const previousHP = attacker.currentHP;
    // Heal the attacker without exceeding their maximum HP
    attacker.currentHP = Math.min(
      attacker.stats.hp,
      attacker.currentHP + healAmount
    );
    // Calculate the actual amount healed
    const actualHealed = attacker.currentHP - previousHP;
    // Determine a percentage boost to the attacker's strength between 5% and 10%
    const boostPercent = 0.05 + Math.random() * 0.05;
    // Calculate the boost based on attacker's current strength
    const boostAmount = Math.floor(attacker.stats.strength * boostPercent);
    // Permanently increase the attacker's strength
    attacker.stats.strength += boostAmount;
    const message =
      `**${attacker.name}** uses **Fantasia** – a cascade of Gabriel's songs sung all at once!\n\n` +
      `*She heals for **${actualHealed}** HP and permanently increases her strength by **${boostAmount}** points!*`;
    // Return the healing effect as negative damage (to indicate healing) and the message
    return { totalDamage: -actualHealed, message };
  },

  // FutureEntry: Ability that stuns the target, causing them to miss subsequent turns.
  FutureEntry: (attacker, target) => {
    // Determine a random number of turns to stun (2 or 3)
    const stunTurns = Math.floor(getRandom(2, 4));
    // Add the stun turns to the target's stun counter (initializing if necessary)
    target.stunTurns = (target.stunTurns || 0) + stunTurns;
    const message =
      `**${attacker.name}** uses **Future Entry (未来記載)**, rewriting destiny on <Rasiel>'s blank pages!\n` +
      `**${target.name}** will miss their attacks for **${stunTurns}** turn(s)!`;
    // Return the stun effect with no damage and the descriptive message
    return { totalDamage: 0, message };
  },
};
