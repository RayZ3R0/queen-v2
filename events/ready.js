import { ActivityType } from "discord.js";
import { client } from "../bot.js";
import { Logger } from "../utils/Logger.js";

/**
 * Event listener for when the client becomes ready.
 * This event is emitted once the bot has successfully connected to Discord and is ready to start receiving events.
 * @event client#ready
 */
client.on("ready", async () => {
  try {
    // Show ASCII art title
    await Logger.showTitle();

    // Show initialization box
    console.log(
      Logger.createBox("Initialization", [
        `[+] Connected as ${client.user.tag}`,
        `[+] Serving ${client.guilds.cache.size} guilds`,
        `[+] Watching ${client.users.cache.size} users`,
      ])
    );

    // Set the activity for the client
    client.user.setActivity({
      name: `Anime`,
      type: ActivityType.Watching,
    });

    // Show connection status box
    const guildList = client.guilds.cache.map((guild) => `  + ${guild.name}`);
    console.log(
      Logger.createBox("Connected Guilds", [
        `[*] Total Guilds: ${client.guilds.cache.size}`,
        "",
        "Active Guilds:",
        ...guildList,
      ])
    );

    // Show system stats
    console.log(Logger.showStats());
  } catch (error) {
    console.error("[x] An error occurred in the ready event:", error);
  }
});

/**
 * Sets the bot's presence and activity when it becomes ready.
 * @module ReadyEvent
 */
