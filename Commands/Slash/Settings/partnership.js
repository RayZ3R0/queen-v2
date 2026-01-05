import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";
import Partnership from "../../../schema/partnerships.js";
import {
  extractInviteCode,
  validateInvite,
  createPartnershipEmbed,
  extractAllInvites,
  hasPartnershipPermission,
} from "../../../utils/partnershipUtils.js";

const REQUIRED_ROLE_ID = "920210140093902868";
const PARTNERSHIP_CHANNEL_ID = "912179889191395388"; // Replace with your partnership channel ID
const NOTIFICATION_CHANNEL_ID = "965509744859185262";

export default {
  data: new SlashCommandBuilder()
    .setName("partnership")
    .setDescription("Manage server partnerships")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add a new partnership")
        .addStringOption((option) =>
          option
            .setName("invite")
            .setDescription("Discord invite link or code")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("remove")
        .setDescription("Remove a partnership")
        .addStringOption((option) =>
          option
            .setName("invite")
            .setDescription("Invite code or server name")
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("List all partnerships")
        .addStringOption((option) =>
          option
            .setName("status")
            .setDescription("Filter by status")
            .addChoices(
              { name: "Active", value: "active" },
              { name: "Expired", value: "expired" },
              { name: "Flagged", value: "flagged" },
              { name: "All", value: "all" }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("check")
        .setDescription("Manually check all partnerships for validity")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("scan")
        .setDescription("Scan partnership channel and import existing invites")
        .addStringOption((option) =>
          option
            .setName("channel")
            .setDescription("Channel ID to scan (defaults to partnership channel)")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("refresh")
        .setDescription("Refresh a specific partnership")
        .addStringOption((option) =>
          option
            .setName("invite")
            .setDescription("Invite code to refresh")
            .setRequired(true)
        )
    ),

  async run(interaction) {
    // Check permissions
    if (!hasPartnershipPermission(interaction.member, REQUIRED_ROLE_ID)) {
      return interaction.reply({
        content: "❌ You don't have permission to use this command.",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "add":
        await handleAdd(interaction);
        break;
      case "remove":
        await handleRemove(interaction);
        break;
      case "list":
        await handleList(interaction);
        break;
      case "check":
        await handleCheck(interaction);
        break;
      case "scan":
        await handleScan(interaction);
        break;
      case "refresh":
        await handleRefresh(interaction);
        break;
    }
  },
};

async function handleAdd(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const inviteInput = interaction.options.getString("invite");
  const inviteCode = extractInviteCode(inviteInput);

  if (!inviteCode) {
    return interaction.editReply("❌ Invalid invite link or code.");
  }

  // Check if already exists
  const existing = await Partnership.findOne({ inviteCode });
  if (existing) {
    return interaction.editReply(
      `❌ This partnership already exists!\n**Server:** ${existing.guildName}\n**Status:** ${existing.status}`
    );
  }

  // Validate invite
  const inviteData = await validateInvite(interaction.client, inviteCode);
  if (!inviteData) {
    return interaction.editReply(
      "❌ Invalid or expired invite. Please check the invite and try again."
    );
  }

  // Create partnership in database
  const partnership = await Partnership.create({
    inviteCode: inviteData.code,
    inviteUrl: inviteData.url,
    guildId: inviteData.guildId,
    guildName: inviteData.guildName,
    guildIcon: inviteData.guildIcon,
    memberCount: inviteData.memberCount,
    description: inviteData.description,
    addedBy: interaction.user.tag,
    addedById: interaction.user.id,
    addedAt: new Date(),
    lastChecked: new Date(),
    expiresAt: inviteData.expiresAt,
  });

  // Post partnership message
  const partnershipChannel = interaction.client.channels.cache.get(
    PARTNERSHIP_CHANNEL_ID
  );
  
  if (partnershipChannel) {
    const embed = createPartnershipEmbed(partnership);
    const button = new ButtonBuilder()
      .setLabel("Join")
      .setStyle(ButtonStyle.Link)
      .setURL(inviteData.url);
    const row = new ActionRowBuilder().addComponents(button);

    const message = await partnershipChannel.send({
      embeds: [embed],
      components: [row],
    });

    // Update partnership with message ID
    partnership.messageId = message.id;
    partnership.channelId = partnershipChannel.id;
    await partnership.save();
  }

  const successEmbed = new EmbedBuilder()
    .setColor("#00ff00")
    .setTitle("✅ Partnership Added")
    .setDescription(`Successfully added partnership with **${inviteData.guildName}**`)
    .addFields(
      { name: "Members", value: `${inviteData.memberCount}`, inline: true },
      { name: "Invite Code", value: inviteData.code, inline: true }
    )
    .setThumbnail(inviteData.guildIcon)
    .setTimestamp();

  await interaction.editReply({ embeds: [successEmbed] });
}

async function handleRemove(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const inviteInput = interaction.options.getString("invite");
  const inviteCode = extractInviteCode(inviteInput);

  // Try to find by invite code or server name
  const partnership = await Partnership.findOne({
    $or: [
      { inviteCode: inviteCode || inviteInput },
      { guildName: { $regex: inviteInput, $options: "i" } },
    ],
  });

  if (!partnership) {
    return interaction.editReply("❌ Partnership not found.");
  }

  // Delete the partnership message if it exists
  if (partnership.messageId && partnership.channelId) {
    try {
      const channel = interaction.client.channels.cache.get(partnership.channelId);
      if (channel) {
        const message = await channel.messages.fetch(partnership.messageId);
        await message.delete();
      }
    } catch (error) {
      console.error("Failed to delete partnership message:", error);
    }
  }

  await Partnership.deleteOne({ _id: partnership._id });

  const embed = new EmbedBuilder()
    .setColor("#ff0000")
    .setTitle("🗑️ Partnership Removed")
    .setDescription(`Successfully removed partnership with **${partnership.guildName}**`)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function handleList(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const statusFilter = interaction.options.getString("status") || "active";
  
  const query = statusFilter === "all" ? {} : { status: statusFilter };
  const partnerships = await Partnership.find(query).sort({ addedAt: -1 });

  if (partnerships.length === 0) {
    return interaction.editReply(`No partnerships found with status: **${statusFilter}**`);
  }

  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle(`📋 Partnerships (${statusFilter})`)
    .setDescription(`Total: ${partnerships.length}`)
    .setTimestamp();

  // Split into chunks if too many
  const chunks = [];
  for (let i = 0; i < partnerships.length; i += 10) {
    chunks.push(partnerships.slice(i, i + 10));
  }

  const currentChunk = chunks[0];
  currentChunk.forEach((p) => {
    const statusEmoji = p.status === "active" ? "✅" : p.status === "expired" ? "❌" : "⚠️";
    embed.addFields({
      name: `${statusEmoji} ${p.guildName}`,
      value: `Code: \`${p.inviteCode}\` | Members: ${p.memberCount || "?"} | Added by: ${p.addedBy}\nAdded: <t:${Math.floor(p.addedAt.getTime() / 1000)}:R>`,
    });
  });

  if (chunks.length > 1) {
    embed.setFooter({ text: `Page 1/${chunks.length} • Use buttons to navigate` });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleCheck(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const partnerships = await Partnership.find({ status: { $ne: "expired" } });
  
  if (partnerships.length === 0) {
    return interaction.editReply("No active partnerships to check.");
  }

  await interaction.editReply(
    `🔍 Checking ${partnerships.length} partnerships... This may take a moment.`
  );

  let checked = 0;
  let expired = 0;
  let updated = 0;

  const notificationChannel = interaction.client.channels.cache.get(
    NOTIFICATION_CHANNEL_ID
  );

  for (const partnership of partnerships) {
    checked++;
    const inviteData = await validateInvite(interaction.client, partnership.inviteCode);

    if (!inviteData) {
      // Invite is invalid/expired
      partnership.status = "expired";
      partnership.consecutiveFailures += 1;
      expired++;

      // Send notification
      if (notificationChannel) {
        const notifEmbed = new EmbedBuilder()
          .setColor("#ff6b6b")
          .setTitle("⚠️ Partnership Invite Expired")
          .setDescription(
            `Partnership with **${partnership.guildName}** has an expired invite.`
          )
          .addFields(
            { name: "Invite Code", value: partnership.inviteCode, inline: true },
            { name: "Added By", value: partnership.addedBy, inline: true },
            { name: "Members (Last Known)", value: `${partnership.memberCount || "Unknown"}`, inline: true }
          )
          .setTimestamp();

        if (partnership.guildIcon) {
          notifEmbed.setThumbnail(partnership.guildIcon);
        }

        await notificationChannel.send({ embeds: [notifEmbed] });
      }
    } else {
      // Update partnership data
      partnership.memberCount = inviteData.memberCount;
      partnership.description = inviteData.description;
      partnership.guildName = inviteData.guildName;
      partnership.guildIcon = inviteData.guildIcon;
      partnership.consecutiveFailures = 0;
      updated++;
    }

    partnership.lastChecked = new Date();
    await partnership.save();

    // Small delay to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const resultEmbed = new EmbedBuilder()
    .setColor("#00ff00")
    .setTitle("✅ Partnership Check Complete")
    .setDescription(
      `**Checked:** ${checked}\n**Updated:** ${updated}\n**Expired:** ${expired}`
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [resultEmbed] });
}

async function handleScan(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const channelId = interaction.options.getString("channel") || PARTNERSHIP_CHANNEL_ID;
  const channel = interaction.client.channels.cache.get(channelId);

  if (!channel) {
    return interaction.editReply("❌ Channel not found.");
  }

  await interaction.editReply("🔍 Scanning channel for invite links... This may take a while.");

  let totalMessages = 0;
  let invitesFound = 0;
  let invitesAdded = 0;
  let invitesSkipped = 0;
  let lastId;

  const allInviteCodes = new Set();

  // Fetch all messages in batches
  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const messages = await channel.messages.fetch(options);
    if (messages.size === 0) break;

    totalMessages += messages.size;
    lastId = messages.last().id;

    // Extract invites from messages
    for (const message of messages.values()) {
      const invites = extractAllInvites(message.content);
      invites.forEach((code) => allInviteCodes.add(code));

      // Check embeds for invites
      if (message.embeds.length > 0) {
        message.embeds.forEach((embed) => {
          if (embed.description) {
            const embedInvites = extractAllInvites(embed.description);
            embedInvites.forEach((code) => allInviteCodes.add(code));
          }
        });
      }
    }

    // Update progress every 500 messages
    if (totalMessages % 500 === 0) {
      await interaction.editReply(
        `🔍 Scanned ${totalMessages} messages... Found ${allInviteCodes.size} unique invites so far.`
      );
    }
  }

  invitesFound = allInviteCodes.size;

  // Process found invites
  await interaction.editReply(
    `🔍 Scanned ${totalMessages} messages, found ${invitesFound} unique invites. Processing...`
  );

  for (const inviteCode of allInviteCodes) {
    // Check if already in database
    const existing = await Partnership.findOne({ inviteCode });
    if (existing) {
      invitesSkipped++;
      continue;
    }

    // Validate invite
    const inviteData = await validateInvite(interaction.client, inviteCode);
    if (!inviteData) {
      invitesSkipped++;
      continue;
    }

    // Add to database
    await Partnership.create({
      inviteCode: inviteData.code,
      inviteUrl: inviteData.url,
      guildId: inviteData.guildId,
      guildName: inviteData.guildName,
      guildIcon: inviteData.guildIcon,
      memberCount: inviteData.memberCount,
      description: inviteData.description,
      addedBy: "Scanned Import",
      addedById: interaction.user.id,
      addedAt: new Date(),
      lastChecked: new Date(),
      expiresAt: inviteData.expiresAt,
      notes: `Imported from channel scan on ${new Date().toLocaleDateString()}`,
    });

    invitesAdded++;

    // Small delay to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const resultEmbed = new EmbedBuilder()
    .setColor("#00ff00")
    .setTitle("✅ Channel Scan Complete")
    .setDescription(
      `**Messages Scanned:** ${totalMessages}\n**Invites Found:** ${invitesFound}\n**Added to Database:** ${invitesAdded}\n**Skipped (duplicate/invalid):** ${invitesSkipped}`
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [resultEmbed] });
}

async function handleRefresh(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const inviteInput = interaction.options.getString("invite");
  const inviteCode = extractInviteCode(inviteInput);

  if (!inviteCode) {
    return interaction.editReply("❌ Invalid invite link or code.");
  }

  const partnership = await Partnership.findOne({ inviteCode });
  if (!partnership) {
    return interaction.editReply("❌ Partnership not found in database.");
  }

  const inviteData = await validateInvite(interaction.client, inviteCode);
  
  if (!inviteData) {
    partnership.status = "expired";
    partnership.consecutiveFailures += 1;
    await partnership.save();

    return interaction.editReply(
      `❌ Invite is invalid or expired. Partnership has been flagged.\n**Server:** ${partnership.guildName}`
    );
  }

  // Update partnership
  partnership.memberCount = inviteData.memberCount;
  partnership.description = inviteData.description;
  partnership.guildName = inviteData.guildName;
  partnership.guildIcon = inviteData.guildIcon;
  partnership.status = "active";
  partnership.consecutiveFailures = 0;
  partnership.lastChecked = new Date();
  await partnership.save();

  const embed = new EmbedBuilder()
    .setColor("#00ff00")
    .setTitle("✅ Partnership Refreshed")
    .setDescription(`Successfully refreshed partnership with **${inviteData.guildName}**`)
    .addFields(
      { name: "Members", value: `${inviteData.memberCount}`, inline: true },
      { name: "Status", value: partnership.status, inline: true }
    )
    .setThumbnail(inviteData.guildIcon)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
