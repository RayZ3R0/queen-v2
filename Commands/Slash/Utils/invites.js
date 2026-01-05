import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { InviteTracker } from "../../../utils/inviteTracker.js";

let tracker = null;

export default {
  data: new SlashCommandBuilder()
    .setName("invites")
    .setDescription("Manage invite tracking")
    .addSubcommand(subcommand =>
      subcommand
        .setName("check")
        .setDescription("Check invite stats for a user")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("The user to check (leave empty for yourself)")
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("leaderboard")
        .setDescription("View the invite leaderboard")
        .addIntegerOption(option =>
          option
            .setName("limit")
            .setDescription("Number of users to show (1-25)")
            .setMinValue(1)
            .setMaxValue(25)
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("add-bonus")
        .setDescription("Add bonus invites to a user (Admin only)")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("The user to give bonus invites")
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName("amount")
            .setDescription("Amount of bonus invites to add")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("remove-bonus")
        .setDescription("Remove bonus invites from a user (Admin only)")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("The user to remove bonus invites from")
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName("amount")
            .setDescription("Amount of bonus invites to remove")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("reset-user")
        .setDescription("Reset a user's invites (Admin only)")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("The user to reset")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("reset-all")
        .setDescription("Reset ALL invites for this server (Admin only)")
    ),

  async run({ client, interaction }) {
    // Initialize tracker if needed
    if (!tracker) {
      tracker = new InviteTracker(client);
    }

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case "check":
          await handleCheck(interaction, tracker);
          break;
        case "leaderboard":
          await handleLeaderboard(interaction, tracker);
          break;
        case "add-bonus":
          await handleAddBonus(interaction, tracker);
          break;
        case "remove-bonus":
          await handleRemoveBonus(interaction, tracker);
          break;
        case "reset-user":
          await handleResetUser(interaction, tracker);
          break;
        case "reset-all":
          await handleResetAll(interaction, tracker);
          break;
      }
    } catch (error) {
      console.error("Error in invites command:", error);
      await interaction.reply({
        content: "❌ An error occurred while processing the command.",
        flags: 64,
      });
    }
  },
};

async function handleCheck(interaction, tracker) {
  const user = interaction.options.getUser("user") || interaction.user;
  const stats = await tracker.getStats(interaction.guild.id, user.id);

  const embed = new EmbedBuilder()
    .setColor("#00ff00")
    .setAuthor({
      name: `${user.tag}'s Invite Stats`,
      iconURL: user.displayAvatarURL(),
    })
    .setDescription(
      `**Total Invites:** ${stats.total}\n\n` +
      `**Regular:** ${stats.regular}\n` +
      `**Bonus:** ${stats.bonus}\n` +
      `**Left:** ${stats.leaves}\n` +
      `**Fake:** ${stats.fake}`
    )
    .setTimestamp()
    .setFooter({ text: `User ID: ${user.id}` });

  await interaction.reply({ embeds: [embed] });
}

async function handleLeaderboard(interaction, tracker) {
  const limit = interaction.options.getInteger("limit") || 10;
  const leaderboard = await tracker.getLeaderboard(interaction.guild.id, limit);

  if (leaderboard.length === 0) {
    await interaction.reply({
      content: "📊 No invite data found yet.",
      flags: 64,
    });
    return;
  }

  let description = "";
  for (let i = 0; i < leaderboard.length; i++) {
    const entry = leaderboard[i];
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**${i + 1}.**`;
    description += `${medal} <@${entry.userId}> - **${entry.total}** invites\n`;
    description += `   ↳ Regular: ${entry.regular} | Bonus: ${entry.bonus} | Left: ${entry.leaves} | Fake: ${entry.fake}\n\n`;
  }

  const embed = new EmbedBuilder()
    .setColor("#00ff00")
    .setTitle("📊 Invite Leaderboard")
    .setDescription(description)
    .setTimestamp()
    .setFooter({ text: `Top ${leaderboard.length} users` });

  await interaction.reply({ embeds: [embed] });
}

async function handleAddBonus(interaction, tracker) {
  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: "❌ You need Administrator permission to use this command.",
      flags: 64,
    });
    return;
  }

  const user = interaction.options.getUser("user");
  const amount = interaction.options.getInteger("amount");

  await tracker.addBonus(interaction.guild.id, user.id, amount);

  const embed = new EmbedBuilder()
    .setColor("#00ff00")
    .setDescription(`✅ Added **${amount}** bonus invites to ${user}`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleRemoveBonus(interaction, tracker) {
  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: "❌ You need Administrator permission to use this command.",
      flags: 64,
    });
    return;
  }

  const user = interaction.options.getUser("user");
  const amount = interaction.options.getInteger("amount");

  await tracker.addBonus(interaction.guild.id, user.id, -amount);

  const embed = new EmbedBuilder()
    .setColor("#ff6b6b")
    .setDescription(`✅ Removed **${amount}** bonus invites from ${user}`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleResetUser(interaction, tracker) {
  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: "❌ You need Administrator permission to use this command.",
      flags: 64,
    });
    return;
  }

  const user = interaction.options.getUser("user");
  await tracker.resetUser(interaction.guild.id, user.id);

  const embed = new EmbedBuilder()
    .setColor("#ff6b6b")
    .setDescription(`✅ Reset all invites for ${user}`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function handleResetAll(interaction, tracker) {
  // Check admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: "❌ You need Administrator permission to use this command.",
      flags: 64,
    });
    return;
  }

  // Confirmation
  await interaction.reply({
    content: "⚠️ Are you sure you want to reset ALL invite data for this server? This cannot be undone!\nReply with `confirm` within 30 seconds.",
    flags: 64,
  });

  try {
    const filter = m => m.author.id === interaction.user.id && m.content.toLowerCase() === 'confirm';
    const collected = await interaction.channel.awaitMessages({
      filter,
      max: 1,
      time: 30000,
      errors: ['time']
    });

    if (collected.size > 0) {
      await tracker.resetAll(interaction.guild.id);
      
      const embed = new EmbedBuilder()
        .setColor("#ff6b6b")
        .setDescription("✅ All invite data has been reset for this server.")
        .setTimestamp();

      await interaction.followUp({ embeds: [embed] });
    }
  } catch (error) {
    await interaction.followUp({
      content: "❌ Reset cancelled - confirmation not received.",
      flags: 64,
    });
  }
}
