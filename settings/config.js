import { Colors } from "discord.js";

const settings = {
  TOKEN: process.env.TOKEN || "Bot_Token",
  PREFIX: process.env.PREFIX || "BotPrefix",
  Owners: ["636598760616624128", "OwnersId"],
  Slash: {
    Global: false,
    GuildID: process.env.GuildID || "776774786030239755",
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
