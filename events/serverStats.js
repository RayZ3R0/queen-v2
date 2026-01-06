import { client } from "../bot.js";

// Categories to exclude from channel count
const excludedCategoryIds = [
  "968036263678591036",
  "938770271614173265",
  "747717180589604879",
  "901836260283404288",
  "901841542392733717",
  "987693139550683196",
];

/**
 * Updates the server stats channels for a guild.
 * @param {import("discord.js").Guild} guild
 */
async function updateServerStats(guild) {
  try {
    // Get the three channels by their IDs.
    const memberCountChannel = guild.channels.cache.get("968051671001366559");
    const botCountChannel = guild.channels.cache.get("968051950237122601");
    const channelCountChannel = guild.channels.cache.get("968052330123628554");

    // If any channel isn't found, exit early.
    if (!memberCountChannel || !botCountChannel || !channelCountChannel) return;

    // Ensure we have all members cached for accurate count
    if (guild.memberCount !== guild.members.cache.size) {
      try {
        await guild.members.fetch();
      } catch (err) {
        console.warn(`Failed to fetch members for stats update in ${guild.name}`);
      }
    }

    // Calculate updated stats.
    const totalMembers = guild.members.cache.filter((m) => !m.user.bot).size;
    const totalBots = guild.members.cache.filter((m) => m.user.bot).size;
    const totalChannels =
      guild.channels.cache.filter(
        (channel) => !excludedCategoryIds.includes(channel.parentId)
      ).size - 3; // Exclude channels in specified categories // Subtract 3 from final count

    // Prepare new names.
    const newMemberName = `Members: ${totalMembers.toLocaleString()}`;
    const newBotName = `Bots: ${totalBots.toLocaleString()}`;
    const newChannelName = `Channels: ${totalChannels}`;

    console.log(
      `Updating stats for guild ${guild.id}: Members=${totalMembers}, Bots=${totalBots}, Channels=${totalChannels}`
    );

    // Update channels concurrently.
    await Promise.all([
      memberCountChannel.setName(newMemberName),
      botCountChannel.setName(newBotName),
      channelCountChannel.setName(newChannelName),
    ]);
  } catch (error) {
    console.error(`Error updating server stats for guild ${guild.id}:`, error);
  }
}

// Update stats when a member joins.
client.on("guildMemberAdd", async (member) => {
  if (member.guild) {
    await updateServerStats(member.guild);
  }
});

// Update stats when a member leaves.
client.on("guildMemberRemove", async (member) => {
  if (member.guild) {
    await updateServerStats(member.guild);
  }
});

// Update stats when a channel is created.
client.on("channelCreate", async (channel) => {
  if (channel.guild) {
    await updateServerStats(channel.guild);
  }
});

// Update stats when a channel is deleted.
client.on("channelDelete", async (channel) => {
  if (channel.guild) {
    await updateServerStats(channel.guild);
  }
});

client.on("ready", async () => {
  // For each guild, fetch all members to populate the cache.
  client.guilds.cache.forEach(async (guild) => {
    try {
      if (guild.memberCount !== guild.members.cache.size) {
        await guild.members.fetch();
      }
      console.log(`Fetched all members for: ${guild.name}`);
      // Force an initial update to fix any incorrect numbers
      await updateServerStats(guild);
    } catch (error) {
      console.error(`Failed to fetch members for ${guild.name}:`, error);
    }
  });
});
