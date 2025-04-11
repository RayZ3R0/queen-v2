import { Colors } from "discord.js";

const settings = {
  TOKEN: process.env.TOKEN || "Bot_Token",
  CLIENT_ID: process.env.CLIENT_ID || "901339528353169408",
  PREFIX: process.env.PREFIX || "BotPrefix",
  Owners: ["636598760616624128", "OwnersId"],
  Slash: {
    Global: false,
    GuildID: process.env.GUILD || "747480292171710654",
  },
  embed: {
    color: Colors.Blurple,
    wrongColor: Colors.Red,
  },
  emoji: {
    success: "✅",
    error: "❌",
  },
};

export default settings;
