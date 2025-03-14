import { ActivityType } from "discord.js";

export default async (client) => {
  const STATUS_INTERVAL = 15000; // 15 seconds

  // Status rotation array - mix of general, spacequake, and spirit bonding info
  const statusList = [
    {
      type: ActivityType.Playing,
      text: "/start | Begin your spirit journey",
    },
    {
      type: ActivityType.Watching,
      text: "for spacequake alerts",
    },
    {
      type: ActivityType.Playing,
      text: "/help | View commands",
    },
    {
      type: ActivityType.Playing,
      text: "/spacequake explore",
    },
    {
      type: ActivityType.Watching,
      text: "spirits manifest",
    },
    {
      type: ActivityType.Playing,
      text: "/bond | Build spirit trust",
    },
    {
      type: ActivityType.Watching,
      text: "spirit affection grow",
    },
    {
      type: ActivityType.Playing,
      text: "/quests | Daily missions",
    },
  ];

  let currentIndex = 0;

  // Initial status set
  client.user.setActivity(statusList[0].text, { type: statusList[0].type });

  // Rotate status periodically
  setInterval(() => {
    currentIndex = (currentIndex + 1) % statusList.length;
    const status = statusList[currentIndex];
    client.user.setActivity(status.text, { type: status.type });
  }, STATUS_INTERVAL);

  // Listen for spacequake events to update status temporarily
  client.on("spacequakeAlert", async (location) => {
    // Override normal status rotation for alert
    client.user.setActivity(`⚠️ Spacequake in ${location}!`, {
      type: ActivityType.Watching,
    });

    // Resume normal status rotation after 1 minute
    setTimeout(() => {
      const status = statusList[currentIndex];
      client.user.setActivity(status.text, { type: status.type });
    }, 60000);
  });

  // Listen for season pass events
  client.on("seasonUpdate", async (seasonInfo) => {
    // Temporarily show season info
    client.user.setActivity(`Season ${seasonInfo.id} - ${seasonInfo.theme}`, {
      type: ActivityType.Competing,
    });

    // Resume normal rotation after 30 seconds
    setTimeout(() => {
      const status = statusList[currentIndex];
      client.user.setActivity(status.text, { type: status.type });
    }, 30000);
  });

  // Listen for special spirit events
  client.on("spiritEvent", async (eventInfo) => {
    // Show spirit event info
    client.user.setActivity(`${eventInfo.spirit} - ${eventInfo.type}`, {
      type: ActivityType.Watching,
    });

    // Resume normal rotation after event duration
    setTimeout(() => {
      const status = statusList[currentIndex];
      client.user.setActivity(status.text, { type: status.type });
    }, eventInfo.duration || 30000);
  });

  console.log("[Status] Bot status rotation initialized");
};
