import { Events } from "discord.js";

export const name = Events.GuildMemberRemove;
export const once = false;

export default async (member) => {
  try {
    await member.client.inviteManager.handleMemberLeave(member);
  } catch (error) {
    console.error("Error handling member leave:", error);
  }
};
