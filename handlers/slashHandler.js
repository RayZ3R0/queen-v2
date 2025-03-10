import { Bot } from "./Client.js";
import { readdir } from "node:fs/promises";
import { Routes } from "discord.js";

/**
 * Loads slash commands for the client and registers them globally or in a specific guild.
 * @param {Bot} client - The client instance.
 */
export default async function loadSlashCommands(client) {
  const {
    Slash: { Global, GuildID },
  } = client.config;

  try {
    console.log("> Loading slash commands...");
    let allCommands = [];
    const commandsDir = await readdir(`./Commands/Slash`);

    // Load all commands
    for (const dir of commandsDir) {
      const commands = await readdir(`./Commands/Slash/${dir}`);
      const jsCommands = commands.filter((f) => f.endsWith(".js"));

      for (const cmd of jsCommands) {
        try {
          const command = await import(`../Commands/Slash/${dir}/${cmd}`).then(
            (r) => r.default
          );

          // Validate command structure
          if (!command?.data || !command?.run) {
            console.warn(
              `⚠️ Command in ${cmd} is missing required 'data' or 'run' property`
            );
            continue;
          }

          // Initialize permission arrays if not present
          command.botPermissions = command.botPermissions || [];
          command.memberPermissions = command.memberPermissions || [];

          client.scommands.set(command.data.name, command);
          allCommands.push(command.data.toJSON());
          console.log(`> ✓ Loaded slash command: ${command.data.name}`);
        } catch (error) {
          console.error(`❌ Error loading command from file ${cmd}:`, error);
        }
      }
    }

    console.log(
      `> ✅ Successfully loaded ${client.scommands.size} slash commands into memory`
    );
    console.log(
      "> Note: Use 'node deploy-commands.js' to register commands with Discord"
    );
  } catch (error) {
    console.error("❌ An error occurred while loading slash commands:", error);
  }
}
