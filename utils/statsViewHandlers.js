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

const ignoredChannelIds = [
  "955399577895317524",
  "957979414812065852",
  "1006477488014249994",
  "972865600680497172",
  "957981195604471858",
  "1309079456068927499",
];

async function handleChannels(interaction, embed, timeframe) {
  try {
    const guild = interaction.guild;
    const hours = timeframes[timeframe].hours;

    // Get current channel counts, excluding ignored channels
    const channels = {
      text: guild.channels.cache.filter(
        (c) => c.type === 0 && !ignoredChannelIds.includes(c.id),
      ).size,
      voice: guild.channels.cache.filter(
        (c) => c.type === 2 && !ignoredChannelIds.includes(c.id),
      ).size,
      category: guild.channels.cache.filter(
        (c) => c.type === 4 && !ignoredChannelIds.includes(c.id),
      ).size,
      announcement: guild.channels.cache.filter(
        (c) => c.type === 5 && !ignoredChannelIds.includes(c.id),
      ).size,
      forum: guild.channels.cache.filter(
        (c) => c.type === 15 && !ignoredChannelIds.includes(c.id),
      ).size,
    };

    // Get channel activity metrics
    let query = { guildId: guild.id };
    if (hours) {
      query.timestamp = {
        $gte: new Date(Date.now() - hours * 60 * 60 * 1000),
      };
    }

    const snapshots = await GuildSnapshot.find(query).sort({ timestamp: 1 });

    if (!snapshots || snapshots.length === 0) {
      embed.setDescription(
        `No channel activity data available for ${timeframes[timeframe].label}`,
      );
      return [];
    }

    // Aggregate message and voice activity per channel
    const textChannelActivity = new Map();
    const voiceChannelActivity = new Map();

    snapshots.forEach((snapshot) => {
      if (
        snapshot?.metrics?.messages?.perChannel &&
        snapshot.metrics.messages.perChannel instanceof Map
      ) {
        snapshot.metrics.messages.perChannel.forEach((count, channelId) => {
          // Skip ignored channels
          if (ignoredChannelIds.includes(channelId)) return;

          textChannelActivity.set(
            channelId,
            (textChannelActivity.get(channelId) || 0) + count,
          );
        });
      }

      if (
        snapshot?.metrics?.voice?.perChannel &&
        snapshot.metrics.voice.perChannel instanceof Map
      ) {
        snapshot.metrics.voice.perChannel.forEach((minutes, channelId) => {
          // Skip ignored channels
          if (ignoredChannelIds.includes(channelId)) return;

          voiceChannelActivity.set(
            channelId,
            (voiceChannelActivity.get(channelId) || 0) + minutes,
          );
        });
      }
    });

    // Get top 5 text and voice channels
    const topTextChannels = [...textChannelActivity.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => {
        const channel = guild.channels.cache.get(id);
        return {
          name: channel ? channel.name : "Unknown Channel",
          count,
        };
      });

    const topVoiceChannels = [...voiceChannelActivity.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, minutes]) => {
        const channel = guild.channels.cache.get(id);
        return {
          name: channel ? channel.name : "Unknown Channel",
          minutes,
        };
      });

    embed
      .setDescription(`Channel Statistics for ${interaction.guild.name}`)
      .addFields([
        {
          name: "Channel Distribution",
          value: `Text: ${channels.text}\nVoice: ${channels.voice}\nCategories: ${channels.category}\nAnnouncement: ${channels.announcement}\nForum: ${channels.forum}`,
          inline: false,
        },
        {
          name: "Top Text Channels",
          value:
            topTextChannels.length > 0
              ? topTextChannels
                  .map((c) => `${c.name}: ${c.count} messages`)
                  .join("\n")
              : "No data available",
          inline: true,
        },
        {
          name: "Top Voice Channels",
          value:
            topVoiceChannels.length > 0
              ? topVoiceChannels
                  .map((c) => `${c.name}: ${Math.round(c.minutes / 60)} hours`)
                  .join("\n")
              : "No data available",
          inline: true,
        },
      ]);

    // Generate chart
    const chartData = {
      labels: ["Text", "Voice", "Category", "Announcement", "Forum"],
      datasets: [
        {
          data: [
            channels.text,
            channels.voice,
            channels.category,
            channels.announcement,
            channels.forum,
          ],
        },
      ],
    };

    const chart = await generatePieChart(chartData, "Channel Distribution");
    const attachment = new AttachmentBuilder(chart, {
      name: "channel_stats.png",
    });

    return [attachment];
  } catch (error) {
    console.error("Error in handleChannels:", error);
    embed.setDescription(
      `Error generating channel statistics for ${interaction.guild.name}`,
    );
    return [];
  }
}

async function handleOverview(interaction, embed, timeframe) {
  try {
    const stats = await generateOverviewStats(
      interaction.guild,
      timeframes[timeframe].hours,
    );

    embed
      .setDescription(`Server Overview for ${interaction.guild.name}`)
      .addFields([
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
      ]);

    // Generate overview chart if we have data
    if (stats.trendData?.messages?.length > 0) {
      const chart = await generateOverviewCharts(stats.trendData);
      const attachment = new AttachmentBuilder(chart, {
        name: "trend.png",
      });
      return [attachment];
    }

    return [];
  } catch (error) {
    console.error("Error in handleOverview:", error);
    embed.setDescription(
      `Error generating overview statistics for ${interaction.guild.name}`,
    );
    return [];
  }
}

async function handleMembers(interaction, embed, timeframe) {
  try {
    const guild = interaction.guild;
    const hours = timeframes[timeframe].hours;
    const currentMembers = guild.members.cache.filter((m) => !m.user.bot).size;

    // Find all members for this guild, we'll filter by timeframe in memory for more accurate results
    const allMemberStats = await MemberActivity.find({
      guildId: guild.id,
    });

    // Filter members by timeframe
    const timeframeStart = hours ? Date.now() - hours * 60 * 60 * 1000 : 0;

    // Calculate joins within timeframe
    const joinsInTimeframe = allMemberStats.filter((member) => {
      if (!member.joinTimestamp) return false;
      return (
        timeframeStart === 0 ||
        new Date(member.joinTimestamp).getTime() >= timeframeStart
      );
    });

    // Calculate total leaves within timeframe
    const totalLeaves = allMemberStats.reduce((total, member) => {
      if (!Array.isArray(member.leaveHistory)) return total;

      // Only count leaves that happened within the timeframe
      const leavesInTimeframe = member.leaveHistory.filter((leave) => {
        if (!leave?.leftAt) return false;
        if (timeframeStart === 0) return true; // All time
        const leaveTime = new Date(leave.leftAt).getTime();
        return leaveTime >= timeframeStart;
      });

      return total + leavesInTimeframe.length;
    }, 0);

    const stats = {
      totalJoins: joinsInTimeframe.length,
      currentMembers,
      totalLeaves,
      retentionRate:
        joinsInTimeframe.length > 0
          ? ((currentMembers / joinsInTimeframe.length) * 100).toFixed(2)
          : "100.00", // Show 100% when there's no data
    };

    // Update embed with fields
    embed
      .setDescription(`Member Statistics for ${interaction.guild.name}`)
      .addFields([
        {
          name: "Current Members",
          value: stats.currentMembers.toString(),
          inline: true,
        },
        {
          name: "Joins (This Period)",
          value: stats.totalJoins.toString(),
          inline: true,
        },
        {
          name: "Leaves (This Period)",
          value: stats.totalLeaves.toString(),
          inline: true,
        },
        {
          name: "Retention Rate",
          value: `${stats.retentionRate}%`,
          inline: true,
        },
      ]);

    // Only try to generate charts if we have data
    if (joinsInTimeframe.length === 0 && totalLeaves === 0) {
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
      joinsInTimeframe.forEach((member) => {
        try {
          if (member?.joinTimestamp) {
            const joinDate = new Date(
              member.joinTimestamp,
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
                  const leaveTime = new Date(leave.leftAt).getTime();
                  if (timeframeStart === 0 || leaveTime >= timeframeStart) {
                    const leaveDate = new Date(leaveTime).toLocaleDateString();
                    if (leaveDate) {
                      leavesByDay.set(
                        leaveDate,
                        (leavesByDay.get(leaveDate) || 0) + 1,
                      );
                    }
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

    // Create daily buckets for data visualization
    const startDate = new Date(
      timeframeStart || Date.now() - 60 * 60 * 24 * 30 * 1000,
    ); // Default to 30 days if all time
    const endDate = new Date();
    const dateRange = [];

    // Generate date range (up to 30 points max to avoid overcrowding)
    let interval = 1; // days
    if (hours === null) {
      // All time
      const totalDays = Math.ceil(
        (Date.now() -
          new Date(
            Math.min(
              ...allMemberStats.map((m) =>
                new Date(m.joinTimestamp || Date.now()).getTime(),
              ),
            ),
          ).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      interval = Math.max(1, Math.ceil(totalDays / 30));
    } else if (hours > 168) {
      // More than 7 days
      interval = Math.ceil(hours / 24 / 30);
    }

    // Generate dates
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + interval)
    ) {
      dateRange.push(new Date(d));
    }

    // Ensure we include the last date if it's not already there
    if (
      dateRange[dateRange.length - 1].toDateString() !== endDate.toDateString()
    ) {
      dateRange.push(endDate);
    }

    // Initialize data arrays with dates and zero counts
    joinLeaveData.dates = dateRange.map((d) => d.toLocaleDateString());
    joinLeaveData.joins = Array(dateRange.length).fill(0);
    joinLeaveData.leaves = Array(dateRange.length).fill(0);

    // Fill join data
    joinsByDay.forEach((count, date) => {
      const index = joinLeaveData.dates.indexOf(date);
      if (index !== -1) {
        joinLeaveData.joins[index] = count;
      }
    });

    // Fill leave data
    leavesByDay.forEach((count, date) => {
      const index = joinLeaveData.dates.indexOf(date);
      if (index !== -1) {
        joinLeaveData.leaves[index] = count;
      }
    });

    // Generate chart data
    const chartData = {
      labels: joinLeaveData.dates,
      datasets: [
        {
          label: "Joins",
          data: joinLeaveData.joins,
          borderColor: "rgba(75, 192, 192, 1)",
          backgroundColor: "rgba(75, 192, 192, 0.2)",
        },
        {
          label: "Leaves",
          data: joinLeaveData.leaves,
          borderColor: "rgba(255, 99, 132, 1)",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
        },
      ],
    };

    // Generate and return chart
    try {
      const chart = await generateLineChart(
        chartData,
        "Member Join/Leave Trends",
      );
      const attachment = new AttachmentBuilder(chart, {
        name: "member_trend.png",
      });
      return [attachment];
    } catch (error) {
      console.error("Error generating member chart:", error);
      return [];
    }
  } catch (error) {
    console.error("Error in handleMembers:", error);
    embed.setDescription(
      `Error generating member statistics for ${interaction.guild.name}`,
    );
    return [];
  }
}

async function handleActivity(interaction, embed, timeframe) {
  try {
    const guild = interaction.guild;
    const hours = timeframes[timeframe].hours;

    // Query for members active within the timeframe
    const query = { guildId: guild.id };
    if (hours) {
      query.$or = [
        {
          "messageStats.lastMessageTimestamp": {
            $gte: new Date(Date.now() - hours * 60 * 60 * 1000),
          },
        },
        {
          "voiceStats.lastActive": {
            $gte: new Date(Date.now() - hours * 60 * 60 * 1000),
          },
        },
      ];
    }

    const memberActivity = await MemberActivity.find(query).sort({
      activityScore: -1,
    });

    if (!memberActivity || memberActivity.length === 0) {
      embed.setDescription(
        `No activity data available for ${timeframes[timeframe].label}`,
      );
      return [];
    }

    // Calculate activity metrics
    // Calculate activity metrics
    const activityStats = {
      totalMessages: memberActivity.reduce((sum, member) => {
        let count = 0;

        // Only count messages from non-ignored channels
        if (member.messageStats?.channelDistribution instanceof Map) {
          member.messageStats.channelDistribution.forEach(
            (channelCount, channelId) => {
              if (!ignoredChannelIds.includes(channelId)) {
                count += channelCount;
              }
            },
          );
        } else {
          count = member.messageStats?.totalCount || 0;
        }

        return sum + count;
      }, 0),
      totalVoiceMinutes: memberActivity.reduce((sum, member) => {
        let minutes = 0;

        // Only count voice activity from non-ignored channels
        if (member.voiceStats?.channelMinutes instanceof Map) {
          member.voiceStats.channelMinutes.forEach(
            (channelMinutes, channelId) => {
              if (!ignoredChannelIds.includes(channelId)) {
                minutes += channelMinutes;
              }
            },
          );
        } else {
          minutes = member.voiceStats?.totalMinutes || 0;
        }

        return sum + minutes;
      }, 0),
      messageAuthors: memberActivity.filter(
        (m) => m.messageStats?.totalCount > 0,
      ).length,
      voiceUsers: memberActivity.filter((m) => m.voiceStats?.totalMinutes > 0)
        .length,
      topMessageSenders: [],
      topVoiceUsers: [],
    };

    // Get top 5 message senders
    activityStats.topMessageSenders = memberActivity
      .filter((m) => m.messageStats?.totalCount > 0)
      .sort((a, b) => b.messageStats.totalCount - a.messageStats.totalCount)
      .slice(0, 5)
      .map((m) => ({
        userId: m.userId,
        messageCount: m.messageStats.totalCount,
      }));

    // Get top 5 voice users
    activityStats.topVoiceUsers = memberActivity
      .filter((m) => m.voiceStats?.totalMinutes > 0)
      .sort((a, b) => b.voiceStats.totalMinutes - a.voiceStats.totalMinutes)
      .slice(0, 5)
      .map((m) => ({
        userId: m.userId,
        voiceMinutes: m.voiceStats.totalMinutes,
      }));

    // Format user mentions
    const formatUserMention = async (userId, value) => {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        return member
          ? `${member.user.username}: ${value}`
          : `Unknown User: ${value}`;
      } catch (error) {
        return `User ${userId}: ${value}`;
      }
    };

    const topMessageFields = await Promise.all(
      activityStats.topMessageSenders.map((u) =>
        formatUserMention(u.userId, `${u.messageCount} messages`),
      ),
    );

    const topVoiceFields = await Promise.all(
      activityStats.topVoiceUsers.map((u) =>
        formatUserMention(u.userId, `${Math.round(u.voiceMinutes / 60)} hours`),
      ),
    );

    // Get hourly activity distribution
    const hourlyActivity = new Map();
    const weeklyActivity = new Map();

    // Initialize hourly and weekly maps
    for (let i = 0; i < 24; i++) {
      hourlyActivity.set(i, 0);
    }
    for (let i = 0; i < 7; i++) {
      weeklyActivity.set(i, 0);
    }

    // Aggregate activity data
    memberActivity.forEach((member) => {
      // Hourly message activity
      if (
        member.messageStats?.hourlyActivity &&
        member.messageStats.hourlyActivity instanceof Map
      ) {
        member.messageStats.hourlyActivity.forEach((count, hour) => {
          hourlyActivity.set(
            parseInt(hour),
            hourlyActivity.get(parseInt(hour)) + count,
          );
        });
      }

      // Weekly message activity
      if (
        member.messageStats?.weeklyActivity &&
        member.messageStats.weeklyActivity instanceof Map
      ) {
        member.messageStats.weeklyActivity.forEach((count, day) => {
          weeklyActivity.set(
            parseInt(day),
            weeklyActivity.get(parseInt(day)) + count,
          );
        });
      }
    });

    // Update embed with fields
    embed
      .setDescription(`Activity Statistics for ${interaction.guild.name}`)
      .addFields([
        {
          name: "Message Activity",
          value: `Total Messages: ${activityStats.totalMessages}\nUnique Authors: ${activityStats.messageAuthors}`,
          inline: true,
        },
        {
          name: "Voice Activity",
          value: `Total Hours: ${Math.round(
            activityStats.totalVoiceMinutes / 60,
          )}\nUnique Users: ${activityStats.voiceUsers}`,
          inline: true,
        },
        {
          name: "Top Message Senders",
          value:
            topMessageFields.length > 0
              ? topMessageFields.join("\n")
              : "No data available",
          inline: true,
        },
        {
          name: "Top Voice Users",
          value:
            topVoiceFields.length > 0
              ? topVoiceFields.join("\n")
              : "No data available",
          inline: true,
        },
      ]);

    // Generate activity score chart
    const activityScores = memberActivity
      .filter((m) => m.activityScore > 0)
      .sort((a, b) => b.activityScore - a.activityScore)
      .slice(0, 10);

    if (activityScores.length === 0) {
      return [];
    }

    const usernames = await Promise.all(
      activityScores.map(async (m) => {
        try {
          const member = await guild.members.fetch(m.userId).catch(() => null);
          return member ? member.user.username.substring(0, 12) : "Unknown";
        } catch {
          return "Unknown";
        }
      }),
    );

    const chartData = {
      labels: usernames,
      datasets: [
        {
          data: activityScores.map((m) => m.activityScore),
        },
      ],
    };

    const chart = await generateBarChart(chartData, "Top User Activity Scores");
    const attachment = new AttachmentBuilder(chart, {
      name: "activity_scores.png",
    });

    return [attachment];
  } catch (error) {
    console.error("Error in handleActivity:", error);
    embed.setDescription(
      `Error generating activity statistics for ${interaction.guild.name}`,
    );
    return [];
  }
}

async function generateOverviewStats(guild, hours) {
  try {
    // Get current server stats
    const currentStats = {
      totalMembers: guild.memberCount,
      botCount: guild.members.cache.filter((m) => m.user.bot).size,
      onlineMembers: guild.members.cache.filter(
        (m) => m.presence?.status === "online" || m.presence?.status === "idle",
      ).size,
      textChannels: guild.channels.cache.filter(
        (c) =>
          (c.type === 0 || c.type === 5 || c.type === 15) &&
          !ignoredChannelIds.includes(c.id),
      ).size,
      voiceChannels: guild.channels.cache.filter(
        (c) =>
          (c.type === 2 || c.type === 13) && !ignoredChannelIds.includes(c.id),
      ).size,
    };

    // Query for activity data
    const query = { guildId: guild.id };
    if (hours) {
      query.timestamp = {
        $gte: new Date(Date.now() - hours * 60 * 60 * 1000),
      };
    }

    // Find the latest snapshot for current data
    const latestSnapshot = await GuildSnapshot.findOne({ guildId: guild.id })
      .sort({ timestamp: -1 })
      .lean();

    if (latestSnapshot) {
      currentStats.totalMessages = latestSnapshot.metrics?.messages?.total || 0;
      currentStats.activeUsers = latestSnapshot.metrics?.members?.active || 0;
    } else {
      currentStats.totalMessages = 0;
      currentStats.activeUsers = 0;
    }

    // Get trend data over time
    const snapshots = await GuildSnapshot.find(query)
      .sort({ timestamp: 1 })
      .lean();

    if (!snapshots || snapshots.length === 0) {
      return { currentStats, trendData: null };
    }

    // Prepare trend data
    const trendData = {
      dates: [],
      members: [],
      messages: [],
      voice: [],
    };

    // Process snapshots for trend
    snapshots.forEach((snapshot) => {
      // Format date (use day for long timeframes, time for short)
      const date = new Date(snapshot.timestamp);
      const formattedDate =
        hours && hours <= 24
          ? date.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : date.toLocaleDateString();

      trendData.dates.push(formattedDate);
      trendData.members.push(snapshot.metrics?.members?.total || 0);
      trendData.messages.push(snapshot.metrics?.messages?.total || 0);
      trendData.voice.push(
        Math.round((snapshot.metrics?.voice?.totalMinutes || 0) / 60),
      ); // Convert to hours
    });

    return {
      currentStats,
      trendData,
      files: await generateOverviewCharts(trendData),
    };
  } catch (error) {
    console.error("Error generating overview stats:", error);
    return { currentStats: {}, trendData: null };
  }
}

async function generateOverviewCharts(trendData) {
  try {
    if (!trendData || !trendData.dates || trendData.dates.length === 0) {
      return [];
    }

    // Generate member and activity charts
    const chartData = {
      labels: trendData.dates,
      datasets: [
        {
          label: "Members",
          data: trendData.members,
          borderColor: "rgba(75, 192, 192, 1)",
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          yAxisID: "y",
        },
        {
          label: "Messages",
          data: trendData.messages,
          borderColor: "rgba(255, 99, 132, 1)",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          yAxisID: "y1",
        },
        {
          label: "Voice (hours)",
          data: trendData.voice,
          borderColor: "rgba(153, 102, 255, 1)",
          backgroundColor: "rgba(153, 102, 255, 0.2)",
          yAxisID: "y1",
        },
      ],
    };

    const chart = await generateLineChart(chartData, "Server Activity Trends");
    const attachment = new AttachmentBuilder(chart, { name: "trend.png" });

    return [attachment];
  } catch (error) {
    console.error("Error generating overview chart:", error);
    return [];
  }
}

export {
  handleOverview,
  handleMembers,
  handleActivity,
  handleChannels,
  timeframes,
};
