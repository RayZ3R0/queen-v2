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
        Partials.Reaction,
        Partials.ThreadMember,
      ],
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildEmojisAndStickers,
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
  startGamblingSession(userId, messageOrInteraction) {
    // If user already has a session, return false
    if (this.activeGambleSessions.has(userId)) {
      return false;
    }

    // Determine command name and channel based on input type
    const commandName =
      messageOrInteraction.commandName || // Slash command
      messageOrInteraction.content?.split(" ")[0] ||
      "unknown"; // Message command

    const channel = messageOrInteraction.channel;

    // Create a new timeout that will automatically clear the session after 5 minutes
    const timeout = setTimeout(() => {
      if (this.activeGambleSessions.has(userId)) {
        this.activeGambleSessions.delete(userId);
        channel
          .send(
            `<@${userId}>, your gambling session was automatically closed due to inactivity.`
          )
          .catch((e) => {});
      }
    }, 5 * 60 * 1000); // 5-minute timeout

    // Store timeout ID alongside timestamp and command info for debugging
    this.activeGambleSessions.set(userId, {
      timeout,
      startTime: Date.now(),
      commandName: commandName,
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
    try {
      // Login first to ensure we have a valid client
      await this.login(token);
      console.log("> ✅ Bot logged in successfully");

      // Load handlers after successful login
      await loadHandlers(this);
    } catch (error) {
      console.error("❌ Error during bot initialization:", error);
      process.exit(1);
    }
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
  try {
    // Load event handler first
    const eventHandler = await import("./eventHandler.js").then(
      (r) => r.default
    );
    await eventHandler(client);
    console.log("> ✅ Event handler loaded");

    // Load message handler
    const messageHandler = await import("./messageHandler.js").then(
      (r) => r.default
    );
    await messageHandler(client);
    console.log("> ✅ Message handler loaded");

    // Load slash handler last to ensure everything else is ready
    const slashHandler = await import("./slashHandler.js").then(
      (r) => r.default
    );
    await slashHandler(client);
    console.log("> ✅ Slash handler loaded");
  } catch (error) {
    console.error("❌ Error loading handlers:", error);
    throw error;
  }
}
