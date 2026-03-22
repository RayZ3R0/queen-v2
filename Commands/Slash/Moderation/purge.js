import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";

/** @typedef {import("discord.js").ChatInputCommandInteraction} ChatInputCommandInteraction */
/** @typedef {import("discord.js").TextChannel} TextChannel */
/** @typedef {import("discord.js").Collection<string, import("discord.js").Message>} MessageCollection */
/** @typedef {import("discord.js").User} User */

/** Discord's bulk delete limit: messages older than 14 days cannot be bulk-deleted */
const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * @param {number} count
 * @param {string} singular
 * @returns {string}
 */
const plural = (count, singular) =>
  `${count} ${singular}${count === 1 ? "" : "s"}`;

export default {
  name: "purge",
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk-delete messages in this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Number of messages to delete (1-100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    )
    .addStringOption((option) =>
      option
        .setName("filter")
        .setDescription("Only delete messages matching this filter")
        .setRequired(false)
        .addChoices(
          { name: "Bots only", value: "bot" },
          { name: "Specific user", value: "user" }
        )
    )
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("User whose messages to delete (required when filter is 'Specific user')")
        .setRequired(false)
    ),
  category: "Moderation",
  botPermissions: [PermissionFlagsBits.ManageMessages],

  /**
   * @param {{ client: import("../../../handlers/Client.js").Bot, interaction: ChatInputCommandInteraction }} options
   */
  run: async ({ client, interaction }) => {
    await interaction.deferReply({ ephemeral: true });

    /** @type {number} */
    const amount = interaction.options.getInteger("amount", true);
    /** @type {string | null} */
    const filter = interaction.options.getString("filter");
    /** @type {User | null} */
    const target = interaction.options.getUser("target");

    // ── Validate option combinations ──────────────────────────────
    if (filter === "user" && !target) {
      throw {
        name: "ValidationError",
        message: "You must specify a **target** user when using the 'Specific user' filter.",
      };
    }

    if (!filter && target) {
      throw {
        name: "ValidationError",
        message: "Set the **filter** to 'Specific user' when specifying a target.",
      };
    }

    // ── Fetch & filter messages ───────────────────────────────────
    /** @type {MessageCollection} */
    const fetched = await interaction.channel.messages.fetch({ limit: 100 });
    const now = Date.now();

    /** @type {MessageCollection} */
    let candidates = fetched.filter(
      (msg) => now - msg.createdTimestamp < BULK_DELETE_MAX_AGE_MS
    );

    if (filter === "bot") {
      candidates = candidates.filter((msg) => msg.author.bot);
    } else if (filter === "user" && target) {
      candidates = candidates.filter((msg) => msg.author.id === target.id);
    }

    /** @type {import("discord.js").Message[]} */
    const toDelete = [...candidates.values()].slice(0, amount);

    if (toDelete.length === 0) {
      throw {
        name: "ValidationError",
        message: "No deletable messages found matching your criteria.",
      };
    }

    // ── Delete messages ───────────────────────────────────────────
    /** @type {MessageCollection} */
    let deleted;
    try {
      deleted = await /** @type {TextChannel} */ (interaction.channel).bulkDelete(
        toDelete,
        true // filterOld — silently skip any that aged past 14 days mid-operation
      );
    } catch (err) {
      if (err.code === 50034) {
        throw {
          name: "ValidationError",
          message: "All matched messages are older than 14 days and cannot be bulk-deleted.",
        };
      }
      if (err.code === 50013) {
        throw {
          name: "ValidationError",
          message: "I lack the permissions to delete messages in this channel.",
        };
      }
      throw {
        name: "CommandError",
        message: "Failed to delete messages due to a Discord API error.",
      };
    }

    // ── Reply ─────────────────────────────────────────────────────
    const summary = [`✅ Deleted ${plural(deleted.size, "message")}`];
    if (filter === "bot") summary.push("from **bots**");
    else if (target) summary.push(`from **${target.tag}**`);

    await interaction.editReply({ content: summary.join(" ") });

    // ── Mod log ───────────────────────────────────────────────────
    const logChannel = interaction.guild.channels.cache.find(
      (ch) => ch.name === "mod-logs"
    );
    if (!logChannel?.isTextBased()) return;

    const logEmbed = new EmbedBuilder()
      .setColor(0xf59e0b) // amber
      .setTitle("🗑️ Messages Purged")
      .addFields(
        { name: "Channel", value: `${interaction.channel}`, inline: true },
        { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
        { name: "Deleted", value: plural(deleted.size, "message"), inline: true }
      )
      .setTimestamp();

    if (filter) {
      logEmbed.addFields({ name: "Filter", value: filter, inline: true });
    }
    if (target) {
      logEmbed.addFields({
        name: "Target",
        value: `${target.tag} (${target.id})`,
        inline: true,
      });
    }

    await /** @type {TextChannel} */ (logChannel).send({ embeds: [logEmbed] }).catch(console.error);
  },
};
