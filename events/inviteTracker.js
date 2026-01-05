import { InviteTracker } from "../utils/inviteTracker.js";
import { client } from "../bot.js";

let tracker = null;

export default async (botClient) => {
  console.log("🔄 Registering invite tracker events...");
  
  // Initialize invite tracker
  tracker = new InviteTracker(botClient);
  
  // Wait for ready event to cache invites
  botClient.once("ready", async () => {
    console.log("🔄 Initializing invite tracker...");
    await tracker.initialize();
    console.log("✅ Invite tracker initialized");
  });

  // Handle invite create
  client.on("inviteCreate", async (invite) => {
    if (!tracker) return;
    
    try {
      console.log(`📝 Invite created: ${invite.code} in ${invite.guild.name}`);
      await tracker.cacheInvites(invite.guild);
    } catch (error) {
      console.error("Error handling invite create:", error);
    }
  });

  // Handle invite delete
  client.on("inviteDelete", async (invite) => {
    if (!tracker) return;
    
    try {
      console.log(`🗑️ Invite deleted: ${invite.code} in ${invite.guild.name}`);
      await tracker.cacheInvites(invite.guild);
    } catch (error) {
      console.error("Error handling invite delete:", error);
    }
  });

  // Handle member join - INVITE TRACKING
  client.on("guildMemberAdd", async (member) => {
    if (!tracker) return;
    if (member.user.bot) return;
    
    try {
      console.log(`👤 Member joined: ${member.user.tag} in ${member.guild.name} - tracking invite...`);
      await tracker.handleJoin(member);
    } catch (error) {
      console.error("Error handling member join in invite tracker:", error);
    }
  });

  // Handle member leave - INVITE TRACKING
  client.on("guildMemberRemove", async (member) => {
    if (!tracker) return;
    if (member.user.bot) return;
    
    try {
      console.log(`👋 Member left: ${member.user.tag} in ${member.guild.name} - updating invites...`);
      await tracker.handleLeave(member);
    } catch (error) {
      console.error("Error handling member leave in invite tracker:", error);
    }
  });
  
  console.log("✅ Invite tracker events registered");
};
