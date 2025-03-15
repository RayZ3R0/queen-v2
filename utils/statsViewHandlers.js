import { AttachmentBuilder } from "discord.js";
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

/**
 * Validates timeframe and returns hours
 */
function validateTimeframe(timeframe) {
  if (!timeframes[timeframe]) {
    throw new Error("Invalid timeframe provided");
  }
  return timeframes[timeframe].hours;
}

export async function handleOverview(interaction, embed, timeframe) {
  try {
    const hours = validateTimeframe(timeframe);
    const guild = interaction.guild;

    const [activityData, files] = await generateOverviewStats(guild, hours);
    if (!activityData || !files?.length) {
      throw new Error("Failed to generate overview statistics");
    }

    embed
      .setDescription(`Server Overview for ${guild.name}`)
      .addFields(
        {
          name: "Members",
          value: `Total: ${activityData.totalMembers}\nOnline: ${activityData.onlineMembers}\nBots: ${activityData.botCount}`,
          inline: true,
        },
        {
          name: "Activity",
          value: `Messages: ${activityData.totalMessages}\nActive Users: ${activityData.activeUsers}`,
          inline: true,
        },
        {
          name: "Channels",
          value: `Text: ${activityData.textChannels}\nVoice: ${activityData.voiceChannels}`,
          inline: true,
        }
      )
      .setImage("attachment://trend.png")
      .setThumbnail("attachment://activity.png");

    return files;
  } catch (error) {
    console.error("Error in handleOverview:", error);
    throw error;
  }
}

export async function handleMembers(interaction, embed, timeframe) {
  try {
    const hours = validateTimeframe(timeframe);
    const guild = interaction.guild;

    const [memberStats, files] = await generateMemberStats(guild, hours);
    if (!memberStats || !files?.length) {
      throw new Error("Failed to generate member statistics");
    }

    embed
      .setDescription(`Member Statistics for ${guild.name}`)
      .addFields(
        {
          name: "Total Joins",
          value: memberStats.totalJoins.toString(),
          inline: true,
        },
        {
          name: "Current Members",
          value: memberStats.currentMembers.toString(),
          inline: true,
        },
        {
          name: "Retention Rate",
          value: `${memberStats.retentionRate}%`,
          inline: true,
        }
      )
      .setImage("attachment://member_trend.png");

    return files;
  } catch (error) {
    console.error("Error in handleMembers:", error);
    throw error;
  }
}

export async function handleActivity(interaction, embed, timeframe) {
  try {
    const hours = validateTimeframe(timeframe);
    const guild = interaction.guild;

    const [activityData, files] = await generateActivityStats(guild, hours);
    if (!activityData?.topMembers || !files?.length) {
      throw new Error("Failed to generate activity statistics");
    }

    embed
      .setDescription(`Activity Statistics for ${guild.name}`)
      .addFields({
        name: "Most Active Members",
        value:
          activityData.topMembers.length > 0
            ? activityData.topMembers
                .map(
                  (member, i) =>
                    `${i + 1}. <@${member.userId}> - Score: ${member.score}`
                )
                .join("\n")
            : "No active members found",
      })
      .setImage("attachment://activity_scores.png")
      .setThumbnail("attachment://hourly_activity.png");

    return files;
  } catch (error) {
    console.error("Error in handleActivity:", error);
    throw error;
  }
}

async function generateOverviewStats(guild, hours) {
  try {
    const members = await guild.members.fetch();
    const stats = {
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

    stats.totalMessages = messageStats[0]?.totalMessages || 0;
    stats.activeUsers = messageStats[0]?.activeUsers || 0;

    const files = await generateOverviewCharts(snapshots, stats);
    return [stats, files];
  } catch (error) {
    console.error("Error generating overview stats:", error);
    throw error;
  }
}

async function generateMemberStats(guild, hours) {
  try {
    const query = { guildId: guild.id };
    if (hours) {
      query.joinTimestamp = {
        $gte: new Date(Date.now() - hours * 60 * 60 * 1000),
      };
    }

    const memberStats = await MemberActivity.find(query);
    const joinLeaveData = processJoinLeaveData(memberStats);
    const stats = calculateRetentionStats(memberStats);
    const files = await generateMemberCharts(joinLeaveData);

    return [stats, files];
  } catch (error) {
    console.error("Error generating member stats:", error);
    throw error;
  }
}

async function generateActivityStats(guild, hours) {
  try {
    const query = { guildId: guild.id };
    if (hours) {
      query.lastActive = {
        $gte: new Date(Date.now() - hours * 60 * 60 * 1000),
      };
    }

    const activityStats = await MemberActivity.find(query)
      .sort({ activityScore: -1 })
      .limit(10);

    const files = await generateActivityCharts(activityStats, guild);
    const topMembers = activityStats.map((stat) => ({
      userId: stat.userId,
      score: stat.activityScore,
    }));

    return [{ topMembers }, files];
  } catch (error) {
    console.error("Error generating activity stats:", error);
    throw error;
  }
}

async function generateOverviewCharts(snapshots, stats) {
  try {
    const files = [];

    // Member trend chart
    const trendChart = await generateLineChart(
      snapshots.map((s) => {
        const date = new Date(s.timestamp);
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
      }),
      [
        {
          label: "Total Members",
          data: snapshots.map((s) => s.metrics.members.total),
          fill: false,
        },
      ],
      "Member Count Trend"
    );
    files.push(new AttachmentBuilder(trendChart, { name: "trend.png" }));

    // Activity distribution chart
    const activityChart = await generatePieChart(
      ["Active Users", "Inactive Users"],
      [
        stats.activeUsers,
        Math.max(0, stats.totalMembers - stats.activeUsers - stats.botCount),
      ],
      "Member Activity Distribution"
    );
    files.push(new AttachmentBuilder(activityChart, { name: "activity.png" }));

    return files;
  } catch (error) {
    console.error("Error generating overview charts:", error);
    throw error;
  }
}

async function generateMemberCharts(data) {
  try {
    const trendChart = await generateLineChart(
      data.dates,
      [
        {
          label: "Joins",
          data: data.joins,
          borderColor: "#4CAF50",
        },
        {
          label: "Leaves",
          data: data.leaves,
          borderColor: "#F44336",
        },
      ],
      "Member Join/Leave Trend"
    );

    return [new AttachmentBuilder(trendChart, { name: "member_trend.png" })];
  } catch (error) {
    console.error("Error generating member charts:", error);
    throw error;
  }
}

async function generateActivityCharts(activityStats, guild) {
  try {
    const files = [];
    const usernames = await Promise.all(
      activityStats.map(async (stat) => {
        const member = await guild.members.fetch(stat.userId).catch(() => null);
        return member?.displayName || "Unknown User";
      })
    );

    // Activity score chart
    const scoreChart = await generateBarChart(
      usernames,
      [
        {
          label: "Activity Score",
          data: activityStats.map((stat) => stat.activityScore),
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

    return files;
  } catch (error) {
    console.error("Error generating activity charts:", error);
    throw error;
  }
}

function processJoinLeaveData(memberStats) {
  try {
    const joinsByDay = new Map();
    const leavesByDay = new Map();

    memberStats.forEach((member) => {
      const joinDate = new Date(member.joinTimestamp).toLocaleDateString();
      joinsByDay.set(joinDate, (joinsByDay.get(joinDate) || 0) + 1);

      member.leaveHistory.forEach((leave) => {
        if (leave.leftAt) {
          const leaveDate = new Date(leave.leftAt).toLocaleDateString();
          leavesByDay.set(leaveDate, (leavesByDay.get(leaveDate) || 0) + 1);
        }
      });
    });

    const dates = [
      ...new Set([...joinsByDay.keys(), ...leavesByDay.keys()]),
    ].sort();
    return {
      dates,
      joins: dates.map((date) => joinsByDay.get(date) || 0),
      leaves: dates.map((date) => leavesByDay.get(date) || 0),
    };
  } catch (error) {
    console.error("Error processing join/leave data:", error);
    throw error;
  }
}

function calculateRetentionStats(memberStats) {
  try {
    const totalJoins = memberStats.length;
    const currentMembers = memberStats.filter(
      (m) => !m.leaveHistory.some((l) => l.leftAt && !l.rejoinedAt)
    ).length;
    const retentionRate = ((currentMembers / totalJoins) * 100 || 0).toFixed(2);

    return { totalJoins, currentMembers, retentionRate };
  } catch (error) {
    console.error("Error calculating retention stats:", error);
    throw error;
  }
}
