import { Events } from "discord.js";

export const name = Events.GuildMemberAdd;
export const once = false;

export default async (member) => {
  try {
    await member.client.inviteManager.handleMemberJoin(member);
  } catch (error) {
    console.error("Error handling member join:", error);
  }
};
