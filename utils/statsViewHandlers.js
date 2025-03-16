import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { MemberActivity, GuildSnapshot } from "../schema/serverStats.js";
import {
  generateLineChart,
  generateBarChart,
  generatePieChart,
} from "./chartGenerator.js";

// Define timeframes
const timeframes = {
  "1d": { label: "24 Hours", hours: 24 },
  "7d": { label: "7 Days", hours: 168 },
  "30d": { label: "30 Days", hours: 720 },
  all: { label: "All Time", hours: null },
};

async function handleChannels(interaction, embed, timeframe) {
  try {
    const guild = interaction.guild;
    const hours = timeframes[timeframe].hours;

    // Get channel stats from message activity
    const query = { guildId: guild.id };
    if (hours) {
      query.lastActive = {
        $gte: new Date(Date.now() - hours * 60 * 60 * 1000),
      };
    }

    const channelStats = await MemberActivity.aggregate([
      { $match: query },
      {
        $project: {
          channelDistribution: {
            $objectToArray: "$messageStats.channelDistribution",
          },
        },
      },
      { $unwind: "$channelDistribution" },
      {
        $group: {
          _id: "$channelDistribution.k",
          messageCount: { $sum: "$channelDistribution.v" },
          uniqueUsers: { $addToSet: "$_id" },
        },
      },
      { $sort: { messageCount: -1 } },
    ]);

    if (channelStats.length === 0) {
      embed.setDescription(
        `No channel activity data available for ${guild.name}`
      );
      return [];
    }

    // Get channel names and combine stats
    const topChannels = await Promise.all(
      channelStats.slice(0, 10).map(async (stat) => {
        const channel = await guild.channels.fetch(stat._id).catch(() => null);
        return {
          name: channel?.name || "Deleted Channel",
          messageCount: stat.messageCount,
          uniqueUsers: stat.uniqueUsers.length,
        };
      })
    );

    embed.setDescription(`Channel Statistics for ${guild.name}`).setFields([
      {
        name: "Most Active Channels",
        value:
          topChannels
            .map(
              (ch, i) =>
                `${i + 1}. #${ch.name} - ${ch.messageCount} messages by ${
                  ch.uniqueUsers
                } users`
            )
            .join("\n") || "No channel data available",
      },
    ]);

    // Generate channel activity chart
    const channelChart = await generateBarChart(
      topChannels.map((ch) => ch.name),
      [
        {
          label: "Messages",
          data: topChannels.map((ch) => ch.messageCount),
          backgroundColor: "#5865F2",
        },
      ],
      "Channel Activity Distribution"
    );

    return [new AttachmentBuilder(channelChart, { name: "channel_stats.png" })];
  } catch (error) {
    console.error("Error in handleChannels:", error);
    embed.setDescription(
      `Error generating channel statistics for ${interaction.guild.name}`
    );
    return [];
  }
}

async function handleOverview(interaction, embed, timeframe) {
  try {
    const stats = await generateOverviewStats(
      interaction.guild,
      timeframes[timeframe].hours
    );

    embed
      .setDescription(`Server Overview for ${interaction.guild.name}`)
      .setFields([
        {
          name: "Members",
          value: `Total: ${stats.currentStats.totalMembers}\nOnline: ${stats.currentStats.onlineMembers}\nBots: ${stats.currentStats.botCount}`,
          inline: true,
        },
        {
          name: "Activity",
          value: `Messages: ${stats.currentStats.totalMessages}\nActive Users: ${stats.currentStats.activeUsers}`,
          inline: true,
        },
        {
          name: "Channels",
          value: `Text: ${stats.currentStats.textChannels}\nVoice: ${stats.currentStats.voiceChannels}`,
          inline: true,
        },
      ])
      .setImage("attachment://trend.png");

    return stats.files || [];
  } catch (error) {
    console.error("Error in handleOverview:", error);
    embed.setDescription(
      `Error generating overview statistics for ${interaction.guild.name}`
    );
    return [];
  }
}

async function handleMembers(interaction, embed, timeframe) {
  try {
    const guild = interaction.guild;
    const hours = timeframes[timeframe].hours;
    const currentMembers = guild.members.cache.filter((m) => !m.user.bot).size;

    const query = { guildId: guild.id };
    if (hours) {
      query.joinTimestamp = {
        $gte: new Date(Date.now() - hours * 60 * 60 * 1000),
      };
    }

    const memberStats = await MemberActivity.find(query);

    // Calculate total leaves within timeframe
    const totalLeaves = memberStats.reduce((total, member) => {
      if (!Array.isArray(member.leaveHistory)) return total;

      // Only count leaves that happened within the timeframe
      const leavesInTimeframe = member.leaveHistory.filter((leave) => {
        if (!leave?.leftAt) return false;
        if (!hours) return true; // All time
        const leaveTime = new Date(leave.leftAt).getTime();
        return leaveTime >= Date.now() - hours * 60 * 60 * 1000;
      });

      return total + leavesInTimeframe.length;
    }, 0);

    const stats = {
      totalJoins: memberStats.length,
      currentMembers,
      retentionRate:
        memberStats.length > 0
          ? ((1 - totalLeaves / memberStats.length) * 100).toFixed(2)
          : "100.00", // Show 100% when there's no data
    };

    // Update embed with fields and image
    embed
      .setDescription(`Member Statistics for ${interaction.guild.name}`)
      .setFields([
        {
          name: "Current Members",
          value: stats.currentMembers.toString(),
          inline: true,
        },
        {
          name: "Total Tracked Joins",
          value: stats.totalJoins.toString(),
          inline: true,
        },
        {
          name: "Retention Rate",
          value: `${stats.retentionRate}%`,
          inline: true,
        },
      ])
      .setImage("attachment://member_trend.png");

    // Only try to generate charts if we have data
    if (memberStats.length === 0) {
      return [];
    }

    // Process join/leave data
    const joinLeaveData = {
      dates: [],
      joins: [],
      leaves: [],
    };

    // Create a map of dates for both joins and leaves
    const joinsByDay = new Map();
    const leavesByDay = new Map();

    try {
      // Process joins with validation
      memberStats.forEach((member) => {
        try {
          if (member?.joinTimestamp) {
            const joinDate = new Date(
              member.joinTimestamp
            ).toLocaleDateString();
            if (joinDate) {
              joinsByDay.set(joinDate, (joinsByDay.get(joinDate) || 0) + 1);
            }
          }

          // Process leave history with validation
          if (Array.isArray(member?.leaveHistory)) {
            member.leaveHistory.forEach((leave) => {
              try {
                if (leave?.leftAt) {
                  const leaveDate = new Date(leave.leftAt).toLocaleDateString();
                  if (leaveDate) {
                    leavesByDay.set(
                      leaveDate,
                      (leavesByDay.get(leaveDate) || 0) + 1
                    );
                  }
                }
              } catch (err) {
                console.error("Error processing leave record:", err);
              }
            });
          }
        } catch (err) {
          console.error("Error processing member data:", err);
        }
      });
    } catch (err) {
      console.error("Error in data processing:", err);
      return [];
    }

    // Get all unique dates and sort them
    const allDates = [
      ...new Set([...joinsByDay.keys(), ...leavesByDay.keys()]),
    ].sort();

    // Ensure we have data before trying to create a chart
    if (allDates.length === 0) {
      return [];
    }

    joinLeaveData.dates = allDates;
    joinLeaveData.joins = allDates.map((date) => joinsByDay.get(date) || 0);
    joinLeaveData.leaves = allDates.map((date) => leavesByDay.get(date) || 0);

    try {
      // Additional validation for chart data
      if (
        !joinLeaveData.dates.length ||
        !joinLeaveData.joins.length ||
        !joinLeaveData.leaves.length
      ) {
        console.log("No valid data for chart generation");
        return [];
      }

      // Ensure all data points are valid numbers
      const validJoins = joinLeaveData.joins
        .map(Number)
        .filter((n) => !isNaN(n));
      const validLeaves = joinLeaveData.leaves
        .map(Number)
        .filter((n) => !isNaN(n));

      // Only generate chart if we have valid numeric data
      if (
        validJoins.length === joinLeaveData.dates.length &&
        validLeaves.length === joinLeaveData.dates.length &&
        (validJoins.some((v) => v > 0) || validLeaves.some((v) => v > 0))
      ) {
        const trendChart = await generateLineChart(
          joinLeaveData.dates,
          [
            {
              label: "Joins",
              data: validJoins,
              borderColor: "#4CAF50",
            },
            {
              label: "Leaves",
              data: validLeaves,
              borderColor: "#F44336",
            },
          ],
          "Member Join/Leave Trend"
        );

        if (trendChart) {
          return [
            new AttachmentBuilder(trendChart, { name: "member_trend.png" }),
          ];
        }
      } else {
        console.log("Data validation failed for chart generation");
      }
    } catch (error) {
      console.error("Error generating member trend chart:", error);
    }

    return [];
  } catch (error) {
    console.error("Error in handleMembers:", error);
    embed.setDescription(
      `Error generating member statistics for ${interaction.guild.name}`
    );
    return [];
  }
}

async function handleActivity(interaction, embed, timeframe) {
  try {
    const guild = interaction.guild;
    const hours = timeframes[timeframe].hours;

    // Query for activity data
    const query = { guildId: guild.id };
    if (hours) {
      query.lastActive = {
        $gte: new Date(Date.now() - hours * 60 * 60 * 1000),
      };
    }

    const activityStats = await MemberActivity.find(query)
      .sort({ activityScore: -1 })
      .limit(10);

    // Handle no data case
    if (!activityStats?.length) {
      embed.setDescription(
        `Activity Statistics for ${guild.name}\n\nNo activity data available yet.`
      );
      return [];
    }

    // Process member data with detailed stats
    const topMembers = await Promise.all(
      activityStats.map(async (stat, index) => {
        const member = await guild.members.fetch(stat.userId).catch(() => null);
        const voiceHours = Math.floor(stat.voiceStats.totalMinutes / 60);
        const voiceMinutes = stat.voiceStats.totalMinutes % 60;

        return {
          userId: stat.userId,
          displayName: member?.displayName || "Unknown User",
          score: Math.round(stat.activityScore),
          messageCount: stat.messageStats.totalCount,
          voiceTime:
            voiceHours > 0
              ? `${voiceHours}h ${voiceMinutes}m`
              : `${voiceMinutes}m`,
          lastActive: stat.lastActive
            ? `<t:${Math.floor(stat.lastActive.getTime() / 1000)}:R>`
            : "Never",
        };
      })
    );

    const timeframeLabel = timeframes[timeframe].label.toLowerCase();

    // Update embed with detailed member stats
    embed
      .setDescription(`Activity Statistics for ${guild.name}`)
      .setFields([
        {
          name: "Most Active Members",
          value:
            topMembers
              .map(
                (member, i) =>
                  `${i + 1}. **${member.displayName}** (Score: ${
                    member.score
                  })\n` +
                  `┗ Messages: ${member.messageCount} | Voice: ${member.voiceTime} | Last: ${member.lastActive}`
              )
              .join("\n\n") || "No active members found",
        },
        {
          name: "Activity Score Info",
          value: [
            "• Each message = 2 points",
            "• Voice time = 1 point per minute",
            "• Bonus points for recent activity",
            "• Scores weighted by activity age",
            "• Higher weight for newer activity",
          ].join("\n"),
          inline: false,
        },
      ])
      .setImage("attachment://activity_scores.png");

    // Generate charts
    const files = [];

    // Activity score chart
    const scoreChart = await generateBarChart(
      topMembers.map((m) => m.displayName),
      [
        {
          label: "Activity Score",
          data: topMembers.map((m) => m.score),
        },
      ],
      "Top Member Activity Scores"
    );
    files.push(
      new AttachmentBuilder(scoreChart, { name: "activity_scores.png" })
    );

    // Hourly distribution chart
    // Process hourly activity with string keys
    const hourlyData = new Array(24).fill(0);
    activityStats.forEach((stat) => {
      for (let hour = 0; hour < 24; hour++) {
        const hourKey = hour.toString();
        const count = stat.messageStats.hourlyActivity.get(hourKey) || 0;
        hourlyData[hour] += count;
      }
    });

    if (hourlyData.some((count) => count > 0)) {
      const hourLabels = Array.from(
        { length: 24 },
        (_, i) => `${i.toString().padStart(2, "0")}:00`
      );

      const hourlyChart = await generateLineChart(
        hourLabels,
        [
          {
            label: "Messages per Hour",
            data: hourlyData,
            fill: true,
            borderColor: "#5865F2",
            backgroundColor: "rgba(88, 101, 242, 0.2)",
          },
        ],
        "24-Hour Activity Distribution"
      );
      files.push(
        new AttachmentBuilder(hourlyChart, { name: "hourly_activity.png" })
      );
    }

    return files;
  } catch (error) {
    console.error("Error in handleActivity:", error);
    embed.setDescription(
      `Error generating activity statistics for ${interaction.guild.name}`
    );
    return [];
  }
}

async function generateOverviewStats(guild, hours) {
  try {
    const members = await guild.members.fetch();
    const currentStats = {
      totalMembers: members.filter((m) => !m.user.bot).size,
      onlineMembers: members.filter((m) => m.presence?.status === "online")
        .size,
      botCount: members.filter((m) => m.user.bot).size,
      textChannels: guild.channels.cache.filter((c) => c.type === 0).size,
      voiceChannels: guild.channels.cache.filter((c) => c.type === 2).size,
      totalMessages: 0,
      activeUsers: 0,
    };

    const query = { guildId: guild.id };
    if (hours) {
      query.timestamp = { $gte: new Date(Date.now() - hours * 60 * 60 * 1000) };
    }

    const [snapshots, messageStats] = await Promise.all([
      GuildSnapshot.find(query).sort({ timestamp: 1 }),
      MemberActivity.aggregate([
        { $match: { guildId: guild.id } },
        {
          $group: {
            _id: null,
            totalMessages: { $sum: "$messageStats.totalCount" },
            activeUsers: {
              $sum: { $cond: [{ $gt: ["$messageStats.totalCount", 0] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    currentStats.totalMessages = messageStats[0]?.totalMessages || 0;
    currentStats.activeUsers = messageStats[0]?.activeUsers || 0;

    let files = [];
    if (snapshots.length > 0) {
      // Only attempt to generate charts if we have snapshot data
      files = await generateOverviewCharts(snapshots, currentStats);
    }

    return { currentStats, snapshots, files };
  } catch (error) {
    console.error("Error generating overview stats:", error);
    throw error;
  }
}

// Export all handlers and utilities
export {
  timeframes,
  handleOverview,
  handleMembers,
  handleActivity,
  handleChannels,
};

async function generateOverviewCharts(snapshots, stats) {
  const files = [];

  try {
    // Generate member trend chart
    const labels = snapshots.map((s) => {
      const date = new Date(s.timestamp);
      return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
    });

    if (labels.length > 0) {
      const trendChart = await generateLineChart(
        labels,
        [
          {
            label: "Total Members",
            data: snapshots.map((s) => s.metrics.members.total),
          },
        ],
        "Member Count Trend"
      );
      files.push(new AttachmentBuilder(trendChart, { name: "trend.png" }));
    }

    // Generate activity distribution chart
    if (stats.activeUsers > 0 || stats.totalMembers > 0) {
      const activityChart = await generatePieChart(
        ["Active Users", "Inactive Users"],
        [
          stats.activeUsers,
          Math.max(0, stats.totalMembers - stats.activeUsers - stats.botCount),
        ],
        "Member Activity Distribution"
      );
      files.push(
        new AttachmentBuilder(activityChart, { name: "activity.png" })
      );
    }
  } catch (error) {
    console.error("Error generating overview charts:", error);
  }

  return files;
}
