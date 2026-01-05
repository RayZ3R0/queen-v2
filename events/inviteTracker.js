import { InviteTracker } from "../utils/inviteTracker.js";

let tracker = null;

export default {
  name: "ready",
  async execute(client) {
    // Initialize invite tracker
    tracker = new InviteTracker(client);
    await tracker.initialize();
  },
};

// Handle invite create
export const inviteCreate = {
  name: "inviteCreate",
  async execute(invite) {
    if (!tracker) return;
    
    try {
      // Recache invites for this guild
      await tracker.cacheInvites(invite.guild);
    } catch (error) {
      console.error("Error handling invite create:", error);
    }
  },
};

// Handle invite delete
export const inviteDelete = {
  name: "inviteDelete",
  async execute(invite) {
    if (!tracker) return;
    
    try {
      // Recache invites for this guild
      await tracker.cacheInvites(invite.guild);
    } catch (error) {
      console.error("Error handling invite delete:", error);
    }
  },
};

// Handle member join
export const guildMemberAdd = {
  name: "guildMemberAdd",
  async execute(member) {
    if (!tracker) return;
    
    try {
      await tracker.handleJoin(member);
    } catch (error) {
      console.error("Error handling member join:", error);
    }
  },
};

// Handle member leave
export const guildMemberRemove = {
  name: "guildMemberRemove",
  async execute(member) {
    if (!tracker) return;
    
    try {
      await tracker.handleLeave(member);
    } catch (error) {
      console.error("Error handling member leave:", error);
    }
  },
};
