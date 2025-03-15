import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { MemberActivity, GuildSnapshot } from "../schema/serverStats.js";
import {
  generateLineChart,
  generateBarChart,
  generatePieChart,
} from "./chartGenerator.js";

export const timeframes = {
  "1d": { label: "24 Hours", hours: 24 },
  "7d": { label: "7 Days", hours: 168 },
  "30d": { label: "30 Days", hours: 720 },
  all: { label: "All Time", hours: null },
};

export async function handleOverview(interaction, embed, timeframe) {
  try {
    const stats = await generateOverviewStats(
      interaction.guild,
      timeframes[timeframe].hours
    );

    embed
      .setDescription(`Server Overview for ${interaction.guild.name}`)
      .addFields(
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
        }
      );

    return stats.files || [];
  } catch (error) {
    console.error("Error in handleOverview:", error);
    embed.setDescription(
      `Error generating overview statistics for ${interaction.guild.name}`
    );
    return [];
  }
}

export async function handleMembers(interaction, embed, timeframe) {
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

    // Basic stats that don't depend on historical data
    const stats = {
      totalJoins: memberStats.length,
      currentMembers,
      retentionRate:
        memberStats.length > 0
          ? ((currentMembers / memberStats.length) * 100).toFixed(2)
          : "100.00",
    };

    embed
      .setDescription(`Member Statistics for ${interaction.guild.name}`)
      .addFields(
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
        }
      );

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

export async function handleActivity(interaction, embed, timeframe) {
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

    // Process member data
    const topMembers = await Promise.all(
      activityStats.map(async (stat, index) => {
        const member = await guild.members.fetch(stat.userId).catch(() => null);
        return {
          userId: stat.userId,
          displayName: member?.displayName || "Unknown User",
          score: Math.round(stat.activityScore),
          messageCount: stat.messageStats.totalCount,
          voiceMinutes: stat.voiceStats.totalMinutes,
        };
      })
    );

    // Update embed with member stats
    embed.setDescription(`Activity Statistics for ${guild.name}`).addFields({
      name: "Most Active Members",
      value:
        topMembers
          .map(
            (member, i) =>
              `${i + 1}. ${member.displayName} - Score: ${member.score}`
          )
          .join("\n") || "No active members found",
    });

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
    const hourlyData = new Array(24).fill(0);
    activityStats.forEach((stat) => {
      stat.messageStats.hourlyActivity.forEach((count, hour) => {
        hourlyData[hour] = (hourlyData[hour] || 0) + count;
      });
    });

    if (hourlyData.some((count) => count > 0)) {
      const hourlyChart = await generateLineChart(
        Array.from({ length: 24 }, (_, i) => `${i}:00`),
        [
          {
            label: "Activity Level",
            data: hourlyData,
            fill: true,
          },
        ],
        "Activity Distribution by Hour"
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
