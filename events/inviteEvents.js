import InviteManager from "../utils/inviteManager.js";
import { Events } from "discord.js";
import { Logger } from "../utils/Logger.js";

// Export event config for main ready event
export const name = Events.ClientReady;
export const once = true;

export default async (client) => {
  try {
    // Initialize invite manager
    client.inviteManager = new InviteManager(client);
    Logger.info("Initializing invite tracking system...");

    // Cache initial invites
    for (const guild of client.guilds.cache.values()) {
      await client.inviteManager.cacheGuildInvites(guild);
    }

    // Register event handlers after initialization
    client.on(Events.InviteCreate, async (invite) => {
      try {
        await client.inviteManager.cacheGuildInvites(invite.guild);
        Logger.debug(
          `Cached invites after new invite created in ${invite.guild.name}`
        );
      } catch (error) {
        console.error("Error handling invite create:", error);
      }
    });

    client.on(Events.InviteDelete, async (invite) => {
      try {
        await client.inviteManager.cacheGuildInvites(invite.guild);
        Logger.debug(
          `Cached invites after invite deleted in ${invite.guild.name}`
        );
      } catch (error) {
        console.error("Error handling invite delete:", error);
      }
    });

    client.on(Events.GuildMemberAdd, async (member) => {
      try {
        await client.inviteManager.handleMemberJoin(member);
        Logger.debug(
          `Processed join for ${member.user.tag} in ${member.guild.name}`
        );
      } catch (error) {
        console.error("Error handling member join:", error);
      }
    });

    client.on(Events.GuildMemberRemove, async (member) => {
      try {
        await client.inviteManager.handleMemberLeave(member);
        Logger.debug(
          `Processed leave for ${member.user.tag} in ${member.guild.name}`
        );
      } catch (error) {
        console.error("Error handling member leave:", error);
      }
    });

    Logger.info("Invite tracking system fully initialized");
  } catch (error) {
    Logger.error("Failed to initialize invite tracking system:", error);
  }
};
