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
    target.stunMessage = `Due to Future Entry, **${target.name}** misses their attack!`;
    // Add the stun turns to the target's stun counter (initializing if necessary)
    target.stunTurns = (target.stunTurns || 0) + stunTurns;
    const message =
      `**${attacker.name}** uses **Future Entry (未来記載)**, rewriting destiny on <Rasiel>'s blank pages!\n` +
      `**${target.name}** will miss their attacks for **${stunTurns}** turn(s)!`;
    // Return the stun effect with no damage and the descriptive message
    return { totalDamage: 0, message };
  },
  // Ratelibish (Armor Mode): Tohka activates a mode where her armor nullifies the opponent’s attacks
  // for 2–3 turns by adding to their stun count, and she gains a temporary boost to her strength for 2 turns.
  // This ability can only be used once per battle; if used again, it falls back to a normal attack.
  Ratelibish: (attacker, target) => {
    // If already used, fall back to a normal attack.
    if (attacker.armorModeUsed) {
      return attacker.attack(target);
    }
    // Mark that this ability has been used.
    attacker.armorModeUsed = true;

    // Nullify opponent's attacks: stun for 2 or 3 turns.
    const stunTurns = Math.floor(getRandom(1, 3)); // yields 2 or 3
    target.stunTurns = (target.stunTurns || 0) + stunTurns;
    // Set a custom stun message for this effect.
    target.stunMessage = `Due to Armor Mode: Ratelibish, **${target.name}**'s attack gets **nullified**!`;

    // Calculate a temporary attack boost: 10–20% of current strength.
    const boostPercent = 0.1 + Math.random() * 0.1;
    const boostAmount = Math.floor(attacker.stats.strength * boostPercent);
    attacker.tempBoost = (attacker.tempBoost || 0) + boostAmount;
    attacker.boostTurns = 2; // lasts for 2 turns

    const message =
      `**${attacker.name}** activates **Armor Mode: Ratelibish (装)**!\n` +
      `Her armor nullifies **${target.name}**'s attacks for **${stunTurns}** turn(s) and boosts her strength by **${boostAmount}** points for 2 turns.`;
    return { totalDamage: 0, message };
  },
  // Halvanhelev (Final Sword): Tohka unleashes her true Angel form.
  // The ability calculates a base damage using the normal attack formula and then
  // applies a damage multiplier between 2.2 and 2.8. This extra burst represents the
  // massive destructive power of her fused sword. Only Tohka can use this ability.
  Halvanhelev: (attacker, target) => {
    // If the attacker is not Tohka, fall back to a normal attack.
    if (attacker.name !== "Tohka Yatogami") {
      return attacker.attack(target);
    }
    // Calculate base damage using normalAttackDamage.
    const baseDamage = normalAttackDamage(
      attacker.stats.strength,
      target.stats.defence
    );
    // Choose a multiplier between 1.4 and 2 (balanced so it's strong but not overwhelming)
    const multiplier = 1.4 + Math.random() * 0.6;
    const damage = Math.max(1, Math.floor(baseDamage * multiplier));
    // Apply the damage to the target.
    target.currentHP -= damage;
    const message =
      `**${attacker.name}** unleashes **Halvanhelev: Final Sword**!\n` +
      `With a massive swing of her fused sword, she slashes **${target.name}** for **${damage}** damage!`;
    return { totalDamage: damage, message };
  },
  // Artelif (Crown Cannon): Origami gathers her cannons into a crown and unleashes a massive beam.
  // The damage is calculated by multiplying a normal attack’s damage by a factor between 3.0 and 3.5.
  // In addition, there is a 25% chance to stun the target for 1 turn.
  Artelif: (attacker, target) => {
    // Compute base damage and apply a heavy multiplier.
    const baseDamage = normalAttackDamage(
      attacker.stats.strength,
      target.stats.defence
    );
    const multiplier = 1.2 + Math.random() * 0.5; // multiplier between 1.2 and 1.7
    const damage = Math.max(1, Math.floor(baseDamage * multiplier));
    target.currentHP -= damage;

    // 75% chance to stun the target for 1 turn.
    let extraEffect = "";
    if (Math.random() < 0.75) {
      target.stunTurns = (target.stunTurns || 0) + 1;
      extraEffect = `\n**${target.name}** is stunned for 1 turn by the overwhelming burst of light!`;
    }

    const message =
      `**${attacker.name}** activates **Artelif: Crown Cannon**!\n` +
      `A brilliant beam of concentrated light slams into **${target.name}** for **${damage}** damage!` +
      extraEffect;
    return { totalDamage: damage, message };
  },

  // Metatron’s Aegis (Radiant Barrier): Origami forms a radiant shield that heals her and reflects damage.
  // The ability heals Origami by 15% of her maximum HP and reflects 30% of that value as damage to the target.
  Aegis: (attacker, target) => {
    // Calculate shield amount based on 15% of maximum HP.
    const shieldAmount = Math.floor(attacker.stats.hp * 0.15);
    // Heal Origami by the shield amount, not exceeding her max HP.
    const previousHP = attacker.currentHP;
    attacker.currentHP = Math.min(
      attacker.stats.hp,
      attacker.currentHP + shieldAmount
    );
    const actualHealed = attacker.currentHP - previousHP;
    // Reflect 30% of the shield value as damage to the target.
    const reflectDamage = Math.max(1, Math.floor(shieldAmount * 0.3));
    target.currentHP -= reflectDamage;

    const message =
      `**${attacker.name}** invokes **Metatron’s Aegis: Radiant Barrier**!\n` +
      `A shimmering shield of light envelops her, adding a shield worth **${actualHealed}** HP and reflecting **${reflectDamage}** damage back to **${target.name}**.`;
    // Note: This ability serves a defensive counter and does not deal "attack" damage directly.
    return { totalDamage: reflectDamage, message };
  },
};
