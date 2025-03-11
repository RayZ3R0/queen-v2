import { promisify } from "util";
import { AbilityEffects, normalAttackDamage } from "./abilities.js";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";

const wait = promisify(setTimeout);
const WAIT_TIME = 1000;

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
    this.tempBoost = 0;
    this.boostTurns = 0;
    this.stunMessage = null;
    this.ratebilish = false;
  }

  attack(target) {
    const effectiveStrength = this.stats.strength + (this.tempBoost || 0);
    const totalAgility = this.stats.agility + target.stats.agility;
    const reductionFactor = 0.2;
    const evadeChance = (target.stats.agility / totalAgility) * reductionFactor;
    if (Math.random() < evadeChance) return -1;
    const damage = normalAttackDamage(effectiveStrength, target.stats.defence);
    target.currentHP -= damage;

    if (this.boostTurns && this.boostTurns > 0) {
      this.boostTurns--;
      if (this.boostTurns === 0) {
        this.tempBoost = 0;
      }
    }
    return damage;
  }

  useAbility(abilityName, target) {
    if (AbilityEffects.hasOwnProperty(abilityName)) {
      return AbilityEffects[abilityName](this, target);
    }
    return this.attack(target);
  }
}

/* --- InteractiveBattleEngine Class --- */
export class InteractiveBattleEngine {
  constructor(player, enemy, interaction) {
    this.player = player;
    this.enemy = enemy;
    this.interaction = interaction;
    this.embed = null;
    this.round = 1;
    this.messageId = null;
    this.turnTimeout = null;
    this.isProcessing = false;

    // Decide initiative
    const totalAgility = this.player.stats.agility + this.enemy.stats.agility;
    const bias =
      ((this.player.stats.agility - this.enemy.stats.agility) / totalAgility) *
      0.1;
    const playerFirstChance = 0.5 + bias;
    this.initiative = Math.random() < playerFirstChance ? "player" : "enemy";
    this.currentTurn = this.initiative;
  }

  progressBar(current, max, size = 10) {
    const fill = Math.min(
      size,
      Math.round((size * Math.max(0, current)) / (max || 1))
    );
    return "█".repeat(fill) + "░".repeat(size - fill);
  }

  createActionRow(isPlayerTurn, character) {
    const row = new ActionRowBuilder();

    // Basic attack button
    const attackButton = new ButtonBuilder()
      .setCustomId("attack")
      .setLabel("⚔️ Attack")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!isPlayerTurn);

    // Special ability button
    const abilityButton = new ButtonBuilder()
      .setCustomId("ability")
      .setLabel("✨ Special")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!isPlayerTurn || character.energy < 100);

    // Status button (always enabled)
    const statusButton = new ButtonBuilder()
      .setCustomId("status")
      .setLabel("📊 Status")
      .setStyle(ButtonStyle.Secondary);

    // Surrender button
    const surrenderButton = new ButtonBuilder()
      .setCustomId("surrender")
      .setLabel("🏳️ Surrender")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!isPlayerTurn);

    row.addComponents(
      attackButton,
      abilityButton,
      statusButton,
      surrenderButton
    );
    return row;
  }

  createAbilitySelectMenu(character) {
    if (!character.abilities || character.abilities.length === 0) return null;

    const availableAbilities = character.abilities.filter((ability) => {
      if (ability === "Ratelibish" && character.ratebilish) return false;
      return true;
    });

    if (availableAbilities.length === 0) return null;

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ability_select")
      .setPlaceholder("Choose your special ability")
      .setMinValues(1)
      .setMaxValues(1);

    availableAbilities.forEach((ability) => {
      menu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(ability)
          .setValue(ability)
          .setDescription(`Use ${ability} ability`)
      );
    });

    return new ActionRowBuilder().addComponents(menu);
  }

  async updateBattleState(actionDetails = "") {
    const embed = new EmbedBuilder()
      .setColor(this.currentTurn === "player" ? "#00ff00" : "#ff0000")
      .setTitle(`${this.player.user.username} vs ${this.enemy.user.username}`)
      .setDescription(
        `${actionDetails ? `${actionDetails}\n\n` : ""}
**Battle Status:**

**${this.player.user.username}'s ${this.player.name}** ${printStars(
          this.player.stars
        )}
HP: ${Math.max(0, this.player.currentHP)}/${
          this.player.stats.hp
        } ${this.progressBar(this.player.currentHP, this.player.stats.hp)}
Energy: ${this.player.energy}/100

**${this.enemy.user.username}'s ${this.enemy.name}** ${printStars(
          this.enemy.stars
        )}
HP: ${Math.max(0, this.enemy.currentHP)}/${
          this.enemy.stats.hp
        } ${this.progressBar(this.enemy.currentHP, this.enemy.stats.hp)}
Energy: ${this.enemy.energy}/100`
      )
      .setFooter({
        text: `Round ${this.round} | ${
          this.currentTurn === "player" ? "Your" : "Enemy's"
        } turn`,
      });

    const components = [
      this.createActionRow(this.currentTurn === "player", this.player),
    ];
    if (this.currentTurn === "player" && this.player.energy >= 100) {
      const abilityMenu = this.createAbilitySelectMenu(this.player);
      if (abilityMenu) components.push(abilityMenu);
    }

    if (this.messageId) {
      await this.interaction.editReply({ embeds: [embed], components });
    } else {
      const reply = await this.interaction.editReply({
        embeds: [embed],
        components,
      });
      this.messageId = reply.id;
    }

    this.embed = embed;
  }

  async handleEnemyTurn() {
    await wait(WAIT_TIME);
    let actionMessage = "";
    let damage;

    if (this.enemy.stunTurns > 0) {
      actionMessage =
        this.enemy.stunMessage || `${this.enemy.name} is stunned!`;
      this.enemy.stunTurns--;
    } else if (this.enemy.energy >= 100) {
      this.enemy.energy -= 100;
      let availableAbilities = this.enemy.abilities.filter((ability) => {
        if (ability === "Ratelibish" && this.enemy.ratebilish) return false;
        return true;
      });

      let ability;
      if (
        this.enemy.name === "Tohka Yatogami" &&
        !this.enemy.ratebilish &&
        availableAbilities.includes("Ratelibish")
      ) {
        ability = "Ratelibish";
      } else {
        ability =
          availableAbilities.length > 0
            ? availableAbilities[
                Math.floor(Math.random() * availableAbilities.length)
              ]
            : "Attack";
      }

      if (ability === "Ratelibish") {
        this.enemy.ratebilish = true;
        this.enemy.abilities = this.enemy.abilities.filter(
          (a) => a !== "Ratelibish"
        );
      }

      damage = this.enemy.useAbility(ability, this.player);
      if (typeof damage === "object") {
        actionMessage = `**${this.enemy.name}** activated **${ability}**:\n${damage.message}`;
      } else if (damage === -1) {
        actionMessage = `**${this.player.name}** evaded **${this.enemy.name}**'s **${ability}**!`;
      } else {
        actionMessage = `**${this.enemy.name}** used **${ability}** and dealt **${damage}** damage!`;
      }
    } else {
      damage = this.enemy.attack(this.player);
      actionMessage =
        damage === -1
          ? `**${this.player.name}** evaded **${this.enemy.name}**'s attack!`
          : `**${this.enemy.name}** attacked and dealt **${damage}** damage!`;
    }

    await this.updateBattleState(actionMessage);
    return actionMessage;
  }

  async start() {
    await this.interaction.deferReply();

    const initMsg =
      this.initiative === "player"
        ? `Coin flip: **${this.player.name}** goes first!`
        : `Coin flip: **${this.enemy.name}** goes first!`;

    await this.updateBattleState(`Battle Start!\n${initMsg}`);

    if (this.initiative === "enemy") {
      this.currentTurn = "enemy";
      await this.handleEnemyTurn();
      this.currentTurn = "player";
    }

    const filter = (i) => {
      if (i.user.id !== this.player.user.id) {
        i.reply({ content: "This is not your battle!", ephemeral: true });
        return false;
      }
      return true;
    };

    const collector = this.interaction.channel.createMessageComponentCollector({
      filter,
      time: 300000, // 5 minutes
    });

    collector.on("collect", async (i) => {
      if (this.isProcessing) {
        await i.reply({
          content: "Please wait for the current action to complete.",
          ephemeral: true,
        });
        return;
      }

      this.isProcessing = true;

      try {
        if (i.customId === "attack") {
          const damage = this.player.attack(this.enemy);
          const actionMessage =
            damage === -1
              ? `**${this.enemy.name}** evaded **${this.player.name}**'s attack!`
              : `**${this.player.name}** attacked and dealt **${damage}** damage!`;

          await this.updateBattleState(actionMessage);
          await this.processTurnEnd();
        } else if (
          i.customId === "ability" ||
          i.customId === "ability_select"
        ) {
          const ability = i.customId === "ability_select" ? i.values[0] : null;
          await this.handleAbility(i, ability);
        } else if (i.customId === "status") {
          await this.showDetailedStatus(i);
        } else if (i.customId === "surrender") {
          await this.handleSurrender(i);
          collector.stop();
        }
      } catch (error) {
        console.error("Battle action error:", error);
        await i.reply({
          content: "An error occurred while processing your action.",
          ephemeral: true,
        });
      }

      this.isProcessing = false;
    });

    collector.on("end", () => {
      if (this.player.currentHP > 0 && this.enemy.currentHP > 0) {
        this.interaction.editReply({
          content: "Battle timed out!",
          components: [],
        });
      }
    });
  }

  async handleAbility(i, selectedAbility = null) {
    if (!selectedAbility && this.player.abilities.length > 0) {
      const menu = this.createAbilitySelectMenu(this.player);
      if (menu) {
        await i.reply({
          content: "Choose your special ability:",
          components: [menu],
          ephemeral: true,
        });
        return;
      }
    }

    this.player.energy -= 100;
    const ability = selectedAbility || "Attack";
    const damage = this.player.useAbility(ability, this.enemy);

    let actionMessage;
    if (typeof damage === "object") {
      actionMessage = `**${this.player.name}** activated **${ability}**:\n${damage.message}`;
    } else if (damage === -1) {
      actionMessage = `**${this.enemy.name}** evaded **${this.player.name}**'s **${ability}**!`;
    } else {
      actionMessage = `**${this.player.name}** used **${ability}** and dealt **${damage}** damage!`;
    }

    if (ability === "Ratelibish") {
      this.player.ratebilish = true;
      this.player.abilities = this.player.abilities.filter(
        (a) => a !== "Ratelibish"
      );
    }

    await this.updateBattleState(actionMessage);
    await this.processTurnEnd();
  }

  async showDetailedStatus(i) {
    const statusEmbed = new EmbedBuilder()
      .setColor("#0099ff")
      .setTitle("Detailed Battle Status")
      .addFields(
        {
          name: `${this.player.name}'s Stats`,
          value: `HP: ${Math.max(0, this.player.currentHP)}/${
            this.player.stats.hp
          }
Strength: ${this.player.stats.strength}${
            this.player.tempBoost ? ` (+${this.player.tempBoost})` : ""
          }
Defence: ${this.player.stats.defence}
Agility: ${this.player.stats.agility}
Energy: ${this.player.energy}/100
Status: ${this.player.stunTurns > 0 ? "Stunned" : "Normal"}`,
          inline: true,
        },
        {
          name: `${this.enemy.name}'s Stats`,
          value: `HP: ${Math.max(0, this.enemy.currentHP)}/${
            this.enemy.stats.hp
          }
Strength: ${this.enemy.stats.strength}${
            this.enemy.tempBoost ? ` (+${this.enemy.tempBoost})` : ""
          }
Defence: ${this.enemy.stats.defence}
Agility: ${this.enemy.stats.agility}
Energy: ${this.enemy.energy}/100
Status: ${this.enemy.stunTurns > 0 ? "Stunned" : "Normal"}`,
          inline: true,
        }
      );

    await i.reply({ embeds: [statusEmbed], ephemeral: true });
  }

  async handleSurrender(i) {
    const surrenderEmbed = new EmbedBuilder()
      .setColor("#ff0000")
      .setTitle("Battle Ended - Surrender")
      .setDescription(
        `**${this.player.user.username}** has surrendered the battle!`
      )
      .addFields(
        { name: "Winner", value: this.enemy.name, inline: true },
        { name: "Outcome", value: "Surrender", inline: true }
      );

    await this.interaction.editReply({
      embeds: [surrenderEmbed],
      components: [],
    });
  }

  async processTurnEnd() {
    if (this.enemy.currentHP <= 0 || this.player.currentHP <= 0) {
      await this.endBattle();
      return;
    }

    this.currentTurn = "enemy";
    await this.handleEnemyTurn();

    if (this.enemy.currentHP <= 0 || this.player.currentHP <= 0) {
      await this.endBattle();
      return;
    }

    this.player.energy = Math.min(100, this.player.energy + 25);
    this.enemy.energy = Math.min(100, this.enemy.energy + 25);
    this.round++;
    this.currentTurn = "player";

    await this.updateBattleState(`Round ${this.round} begins!`);
  }

  async endBattle() {
    const winner =
      this.player.currentHP > this.enemy.currentHP ? this.player : this.enemy;
    const loser = winner === this.player ? this.enemy : this.player;

    const endEmbed = new EmbedBuilder()
      .setColor(winner === this.player ? "#00ff00" : "#ff0000")
      .setTitle("Battle Ended")
      .setDescription(
        `**${winner.name}** wins the battle!\n\n` +
          `Final HP:\n` +
          `**${winner.name}**: ${Math.max(0, winner.currentHP)}/${
            winner.stats.hp
          }\n` +
          `**${loser.name}**: ${Math.max(0, loser.currentHP)}/${loser.stats.hp}`
      )
      .addFields(
        {
          name: "Winner",
          value: `${winner.user.username} (${winner.name})`,
          inline: true,
        },
        { name: "Rounds", value: this.round.toString(), inline: true }
      );

    await this.interaction.editReply({ embeds: [endEmbed], components: [] });
  }
}
