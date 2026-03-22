import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  SnowflakeUtil,
} from "discord.js";

/** @typedef {import("discord.js").ChatInputCommandInteraction} ChatInputCommandInteraction */
/** @typedef {import("discord.js").TextChannel} TextChannel */
/** @typedef {import("discord.js").Guild} Guild */
/** @typedef {import("discord.js").Collection<string, import("discord.js").Message>} MessageCollection */

// ── Time-range presets ────────────────────────────────────────────
/** @type {{ label: string; value: string; ms: number }[]} */
const TIME_RANGES = [
  { label: "Last 1 hour",   value: "1h",  ms: 1 * 60 * 60 * 1000 },
  { label: "Last 6 hours",  value: "6h",  ms: 6 * 60 * 60 * 1000 },
  { label: "Last 12 hours", value: "12h", ms: 12 * 60 * 60 * 1000 },
  { label: "Last 24 hours", value: "24h", ms: 24 * 60 * 60 * 1000 },
  { label: "Last 48 hours", value: "48h", ms: 48 * 60 * 60 * 1000 },
  { label: "Last 7 days",   value: "7d",  ms: 7 * 24 * 60 * 60 * 1000 },
  { label: "Last 14 days",  value: "14d", ms: 14 * 24 * 60 * 60 * 1000 },
];

/** Discord's bulk-delete ceiling: 14 days */
const BULK_DELETE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** Delay between channel scans to avoid rate-limits (ms) */
const INTER_CHANNEL_DELAY_MS = 500;

/**
 * @param {number} count
 * @param {string} singular
 * @returns {string}
 */
const plural = (count, singular) =>
  `${count} ${singular}${count === 1 ? "" : "s"}`;

/**
 * Validates whether a string looks like a Discord snowflake.
 * @param {string} id
 * @returns {boolean}
 */
const isValidSnowflake = (id) => /^\d{17,20}$/.test(id);

// ── Core deletion logic ───────────────────────────────────────────

/**
 * @typedef {Object} DeletionResult
 * @property {number} deleted  — total messages removed
 * @property {number} scanned — channels inspected
 */

/**
 * Delete all messages from a user across every text channel in a guild,
 * within the given time window.
 *
 * @param {Guild}   guild
 * @param {string}  userId
 * @param {number}  cutoffMs — only delete messages newer than `Date.now() - cutoffMs`
 * @param {(scanned: number, deleted: number) => Promise<void>} [onProgress]
 * @returns {Promise<DeletionResult>}
 */
async function eraseUserMessages(guild, userId, cutoffMs, onProgress) {
  const cutoffTime = Date.now() - cutoffMs;
  const bulkCutoff = Date.now() - BULK_DELETE_MAX_AGE_MS;
  let totalDeleted = 0;
  let channelsScanned = 0;

  /** @type {import("discord.js").Collection<string, import("discord.js").GuildBasedChannel>} */
  const textChannels = guild.channels.cache.filter(
    (ch) => ch.isTextBased() && !ch.isThread()
  );

  for (const [, channel] of textChannels) {
    // Skip channels the bot can't read or manage messages in
    const botPerms = channel.permissionsFor(guild.members.me);
    if (
      !botPerms ||
      !botPerms.has(PermissionFlagsBits.ViewChannel) ||
      !botPerms.has(PermissionFlagsBits.ManageMessages) ||
      !botPerms.has(PermissionFlagsBits.ReadMessageHistory)
    ) {
      continue;
    }

    channelsScanned++;

    try {
      /** @type {MessageCollection} */
      let fetched;
      try {
        fetched = await channel.messages.fetch({ limit: 100 });
      } catch {
        continue; // silently skip inaccessible channels
      }

      const userMsgs = fetched.filter(
        (msg) => msg.author.id === userId && msg.createdTimestamp > cutoffTime
      );

      if (userMsgs.size === 0) continue;

      // Separate into bulk-deletable (≤14 days) and old (>14 days)
      /** @type {import("discord.js").Message[]} */
      const bulkEligible = [];
      /** @type {import("discord.js").Message[]} */
      const manualDelete = [];

      for (const [, msg] of userMsgs) {
        if (msg.createdTimestamp > bulkCutoff) {
          bulkEligible.push(msg);
        } else {
          manualDelete.push(msg);
        }
      }

      // Bulk delete (fast path) — requires ≥ 1 message
      if (bulkEligible.length > 0) {
        try {
          const deleted = await /** @type {TextChannel} */ (channel).bulkDelete(
            bulkEligible,
            true
          );
          totalDeleted += deleted.size;
        } catch (err) {
          // Fall back to individual deletion if bulk fails
          for (const msg of bulkEligible) {
            try {
              await msg.delete();
              totalDeleted++;
            } catch {
              // skip undeletable messages
            }
          }
        }
      }

      // Individual delete for old messages
      for (const msg of manualDelete) {
        try {
          await msg.delete();
          totalDeleted++;
        } catch {
          // skip undeletable messages
        }
      }

      // Progress callback
      if (onProgress) {
        await onProgress(channelsScanned, totalDeleted).catch(() => {});
      }
    } catch (channelError) {
      console.error(
        `[ERASE] Error processing #${channel.name}:`,
        channelError
      );
    }

    // Rate-limit cushion
    await new Promise((r) => setTimeout(r, INTER_CHANNEL_DELAY_MS));
  }

  return { deleted: totalDeleted, scanned: channelsScanned };
}

// ── Slash command ─────────────────────────────────────────────────

export default {
  name: "erase",
  data: new SlashCommandBuilder()
    .setName("erase")
    .setDescription(
      "Erase all messages from a user across every channel in the server"
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Select a user (if they are still in the server)")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("user_id")
        .setDescription(
          "Provide a user ID instead (for users who already left)"
        )
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("timerange")
        .setDescription("How far back to erase (default: 24 hours)")
        .setRequired(false)
        .addChoices(...TIME_RANGES.map(({ label, value }) => ({ name: label, value })))
    )
    .addStringOption((option) =>
      option
        .setName("reason")
        .setDescription("Reason for erasing messages")
        .setRequired(false)
    ),
  category: "Moderation",
  botPermissions: [
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ReadMessageHistory,
  ],

  /**
   * @param {{ client: import("../../../handlers/Client.js").Bot, interaction: ChatInputCommandInteraction }} options
   */
  run: async ({ client, interaction }) => {
    await interaction.deferReply({ ephemeral: true });

    // ── Resolve target ────────────────────────────────────────────
    /** @type {import("discord.js").User | null} */
    const userOption = interaction.options.getUser("user");
    /** @type {string | null} */
    const userIdOption = interaction.options.getString("user_id");

    if (userOption && userIdOption) {
      throw {
        name: "ValidationError",
        message:
          "Provide **either** a `user` or a `user_id`, not both.",
      };
    }

    if (!userOption && !userIdOption) {
      throw {
        name: "ValidationError",
        message:
          "You must provide **either** a `user` (select from the list) **or** a `user_id` (paste the ID).",
      };
    }

    /** @type {string} */
    let targetId;
    /** @type {string} */
    let targetDisplay;

    if (userOption) {
      targetId = userOption.id;
      targetDisplay = `${userOption.tag} (${userOption.id})`;
    } else {
      if (!isValidSnowflake(/** @type {string} */ (userIdOption))) {
        throw {
          name: "ValidationError",
          message: `\`${userIdOption}\` is not a valid Discord user ID.`,
        };
      }
      targetId = /** @type {string} */ (userIdOption);

      // Try to resolve the user for display purposes
      try {
        const fetchedUser = await client.users.fetch(targetId);
        targetDisplay = `${fetchedUser.tag} (${fetchedUser.id})`;
      } catch {
        targetDisplay = `Unknown User (${targetId})`;
      }
    }

    // ── Resolve time range ────────────────────────────────────────
    const timerangeValue = interaction.options.getString("timerange") ?? "24h";
    const range = TIME_RANGES.find((r) => r.value === timerangeValue);

    if (!range) {
      throw {
        name: "ValidationError",
        message: `Invalid time range: \`${timerangeValue}\`.`,
      };
    }

    const reason =
      interaction.options.getString("reason") ?? "No reason provided";

    // ── Execute deletion ──────────────────────────────────────────
    const startTime = Date.now();
    let lastProgressUpdate = 0;

    await interaction.editReply({
      content: `🔍 Starting erase operation on **${targetDisplay}** (${range.label})…`,
    });

    const { deleted, scanned } = await eraseUserMessages(
      interaction.guild,
      targetId,
      range.ms,
      async (scannedSoFar, deletedSoFar) => {
        // Throttle progress edits to once every 3 seconds
        const now = Date.now();
        if (now - lastProgressUpdate < 3000) return;
        lastProgressUpdate = now;

        await interaction.editReply({
          content:
            `⏳ Erasing **${targetDisplay}**…\n` +
            `> Channels scanned: **${scannedSoFar}** · Messages deleted: **${deletedSoFar}**`,
        });
      }
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // ── Result embed ──────────────────────────────────────────────
    const resultEmbed = new EmbedBuilder()
      .setColor(deleted > 0 ? 0x10b981 : 0x6b7280) // green if deleted, gray if nothing
      .setTitle("🧹 Erase Complete")
      .setDescription(
        deleted > 0
          ? `Removed ${plural(deleted, "message")} from **${targetDisplay}** across ${plural(scanned, "channel")}.`
          : `No messages found for **${targetDisplay}** in the last **${range.label.toLowerCase()}**.`
      )
      .addFields(
        { name: "Time Range", value: range.label, inline: true },
        { name: "Duration", value: `${elapsed}s`, inline: true },
        { name: "Reason", value: reason, inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [resultEmbed] });

    // ── Mod log ───────────────────────────────────────────────────
    const logChannel = interaction.guild.channels.cache.find(
      (ch) => ch.name === "mod-logs"
    );
    if (!logChannel?.isTextBased()) return;

    const logEmbed = new EmbedBuilder()
      .setColor(0xef4444) // red
      .setTitle("🧹 User Messages Erased")
      .addFields(
        { name: "Target", value: targetDisplay, inline: true },
        { name: "Moderator", value: interaction.user.tag, inline: true },
        { name: "Time Range", value: range.label, inline: true },
        {
          name: "Result",
          value: `${plural(deleted, "message")} across ${plural(scanned, "channel")}`,
          inline: false,
        },
        { name: "Reason", value: reason, inline: false }
      )
      .setTimestamp();

    await /** @type {TextChannel} */ (logChannel)
      .send({ embeds: [logEmbed] })
      .catch(console.error);
  },
};
