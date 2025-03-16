import { Events } from "discord.js";

export const name = Events.InviteCreate;
export const once = false;

export default async (invite) => {
  try {
    await invite.client.inviteManager.cacheGuildInvites(invite.guild);
  } catch (error) {
    console.error("Error handling invite create:", error);
  }
};
