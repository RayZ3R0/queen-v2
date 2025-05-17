import InviteManager from "../utils/inviteManager.js";
import { Events } from "discord.js";

// Export event config for main ready event
export const name = Events.ClientReady;
export const once = true;

export default async (client) => {
  try {
    // Initialize invite manager
    client.inviteManager = new InviteManager(client);
    console.log("Initializing invite tracking system...");

    // Cache initial invites
    for (const guild of client.guilds.cache.values()) {
      await client.inviteManager.cacheGuildInvites(guild);
    }

    // Register event handlers after initialization
    client.on(Events.InviteCreate, async (invite) => {
      try {
        await client.inviteManager.cacheGuildInvites(invite.guild);
        console.log(
          `Cached invites after new invite created in ${invite.guild.name}`
        );
      } catch (error) {
        console.error("Error handling invite create:", error);
      }
    });

    client.on(Events.InviteDelete, async (invite) => {
      try {
        await client.inviteManager.cacheGuildInvites(invite.guild);
        console.log(
          `Cached invites after invite deleted in ${invite.guild.name}`
        );
      } catch (error) {
        console.error("Error handling invite delete:", error);
      }
    });

    client.on(Events.GuildMemberAdd, async (member) => {
      try {
        await client.inviteManager.handleMemberJoin(member);
        console.log(
          `Processed join for ${member.user.tag} in ${member.guild.name}`
        );
      } catch (error) {
        console.error("Error handling member join:", error);
      }
    });

    client.on(Events.GuildMemberRemove, async (member) => {
      try {
        await client.inviteManager.handleMemberLeave(member);
        console.log(
          `Processed leave for ${member.user.tag} in ${member.guild.name}`
        );
      } catch (error) {
        console.error("Error handling member leave:", error);
      }
    });

    console.log("Invite tracking system fully initialized");
  } catch (error) {
    console.error("Failed to initialize invite tracking system:", error);
  }
};
