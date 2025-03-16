import InviteManager from "../utils/inviteManager.js";
import { Events } from "discord.js";
import { Logger } from "../utils/Logger.js";

export const name = Events.ClientReady;
export const once = true;

export default async (client) => {
  try {
    // Initialize invite manager and store in client
    client.inviteManager = new InviteManager(client);

    // Cache initial invites for all guilds
    for (const guild of client.guilds.cache.values()) {
      await client.inviteManager.cacheGuildInvites(guild);
    }

    Logger.info("Invite tracking system initialized");
  } catch (error) {
    console.error("Error initializing invite tracking system:", error);
    Logger.error("Failed to initialize invite tracking system:", error);
  }
};
