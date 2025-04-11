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
import InviteManager from "../utils/inviteManager.js"; // Add this import

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

    // Managers
    this.inviteManager = new InviteManager(this);

    // Enhanced gambling session tracking
    this.activeGambleSessions = new Map();
    this.sessionTimeouts = new Map();
  }

  // Enhanced gambling session management
  startGamblingSession(userId, messageOrInteraction, autoEnd = true) {
    // If user has an existing session
    if (this.activeGambleSessions.has(userId)) {
      const existingSession = this.activeGambleSessions.get(userId);

      if (autoEnd) {
        // Clean up existing session before starting new one
        this.endGamblingSession(userId);
      } else {
        // Log session conflict for debugging
        console.log(`Session conflict for user ${userId}:`, {
          existing: existingSession,
          new: messageOrInteraction.commandName || messageOrInteraction.content,
        });
        return false;
      }
    }

    // Get command info
    const commandName =
      messageOrInteraction instanceof CommandInteraction
        ? messageOrInteraction.commandName
        : messageOrInteraction.content?.split(" ")[0] || "unknown";

    const channel = messageOrInteraction.channel;
    const sessionId = `${userId}-${Date.now()}`;

    // Create session timeout
    const timeout = setTimeout(() => {
      this.handleSessionTimeout(userId, channel);
    }, 5 * 60 * 1000); // 5 minutes

    // Store session data
    const sessionData = {
      userId,
      sessionId,
      commandName,
      startTime: Date.now(),
      channelId: channel.id,
      timeout,
    };

    this.activeGambleSessions.set(userId, sessionData);
    this.sessionTimeouts.set(sessionId, timeout);

    return true;
  }

  // Handle session timeout
  async handleSessionTimeout(userId, channel) {
    try {
      if (this.activeGambleSessions.has(userId)) {
        const session = this.activeGambleSessions.get(userId);

        // Clean up session data
        this.activeGambleSessions.delete(userId);
        this.sessionTimeouts.delete(session.sessionId);

        // Notify user
        await channel.send({
          content: `<@${userId}>, your gambling session was automatically closed due to inactivity.`,
          flags: MessageFlags.SuppressNotifications,
        });
      }
    } catch (error) {
      console.error("Session timeout handling error:", error);
    }
  }

  // Enhanced session cleanup
  endGamblingSession(userId) {
    if (this.activeGambleSessions.has(userId)) {
      const session = this.activeGambleSessions.get(userId);

      // Clear all timeouts
      clearTimeout(session.timeout);
      this.sessionTimeouts.delete(session.sessionId);

      // Remove session data
      this.activeGambleSessions.delete(userId);
      return true;
    }
    return false;
  }

  // Get active session info
  getGamblingSession(userId) {
    return this.activeGambleSessions.get(userId);
  }

  // Check if user has active gambling session
  hasActiveGamblingSession(userId) {
    return this.activeGambleSessions.has(userId);
  }

  async build(token) {
    try {
      // Login first to ensure we have a valid client
      await this.login(token);
      console.log("> ✅ Bot logged in successfully");

      // Wait for guilds to be available
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Force fetch all guilds first
      await this.guilds.fetch();
      console.log("> ✅ Guilds fetched");

      // Initialize invite caching for all guilds after login
      for (const [guildId, guild] of this.guilds.cache) {
        await this.inviteManager.cacheGuildInvites(guild);
      }
      console.log("> ✅ Guild invites cache initialized");

      // Load handlers after successful login
      await loadHandlers(this);
      console.log("> ✅ All handlers loaded successfully");
    } catch (error) {
      console.error("❌ Error during bot initialization:", error);
      process.exit(1);
    }
  }

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
