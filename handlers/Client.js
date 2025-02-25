import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  EmbedBuilder,
  CommandInteraction,
  Message,
  InteractionResponse,
  MessageFlags,
} from "discord.js";
import settings from "../settings/config.js";

export class Bot extends Client {
  constructor() {
    super({
      partials: [
        Partials.Channel,
        Partials.GuildMember,
        Partials.Message,
        Partials.User,
      ],
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
      ],
      shards: "auto",
      failIfNotExists: false,
      allowedMentions: {
        parse: ["everyone", "roles", "users"],
        users: [],
        roles: [],
        repliedUser: false,
      },
    });

    // Set global variables
    this.config = settings;
    this.scommands = new Collection();
    this.mcommands = new Collection();
    this.cooldowns = new Collection();
    this.events = new Collection();

    // Use a Map for gambling sessions (user ID => timeout ID)
    this.activeGambleSessions = new Map();
  }

  // Add a method to manage gambling sessions with automatic timeout
  startGamblingSession(userId, message) {
    // If user already has a session, clear its timeout
    if (this.activeGambleSessions.has(userId)) {
      clearTimeout(this.activeGambleSessions.get(userId).timeout);
    }

    // Create a new timeout that will automatically clear the session after 5 minutes
    const timeout = setTimeout(() => {
      if (this.activeGambleSessions.has(userId)) {
        this.activeGambleSessions.delete(userId);
        message.channel
          .send(
            `<@${userId}>, your gambling session was automatically closed due to inactivity.`
          )
          .catch((e) => {});
      }
    }, 5 * 60 * 1000); // 5-minute timeout

    // Store timeout ID alongside timestamp for debugging
    this.activeGambleSessions.set(userId, {
      timeout,
      startTime: Date.now(),
      commandName: message.content.split(" ")[0],
    });

    return true;
  }

  endGamblingSession(userId) {
    if (this.activeGambleSessions.has(userId)) {
      // Clear the auto-cleanup timeout
      clearTimeout(this.activeGambleSessions.get(userId).timeout);
      this.activeGambleSessions.delete(userId);
      return true;
    }
    return false;
  }

  async build(token) {
    await loadHandlers(this);
    this.login(token);
  }

  // Remaining methods unchanged
  async sendEmbed(interaction, data, ephemeral = false) {
    return this.send(interaction, {
      embeds: [
        new EmbedBuilder()
          .setColor(this.config.embed.color)
          .setDescription(`${data.substring(0, 3000)}`),
      ],
      flags: ephemeral ? MessageFlags.Ephemeral : undefined,
    });
  }

  getFooter(user) {
    return {
      text: `Requested By ${user.username}`,
      iconURL: user.displayAvatarURL(),
    };
  }

  async send(interactionOrMessage, options) {
    try {
      if (interactionOrMessage.deferred || interactionOrMessage.replied) {
        await interactionOrMessage.deferReply().catch((e) => {});
        return interactionOrMessage.followUp(options);
      } else {
        return interactionOrMessage.reply(options);
      }
    } catch (error) {
      return interactionOrMessage.channel.send(options);
    }
  }
}

async function loadHandlers(client) {
  ["messageHandler", "slashHandler", "eventHandler"].forEach(async (file) => {
    let handler = await import(`./${file}.js`).then((r) => r.default);
    await handler(client);
  });
}
