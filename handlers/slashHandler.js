import { Bot } from "./Client.js";
import { readdir } from "node:fs/promises";
import { Routes } from "discord.js";
import { Logger } from "../utils/Logger.js";

/**
 * Loads slash commands for the client and registers them globally or in a specific guild.
 * @param {Bot} client - The client instance.
 */
export default async function loadSlashCommands(client) {
  const {
    Slash: { Global, GuildID },
  } = client.config;

  try {
    const spinnerId = Logger.startSpinner("Loading slash commands");
    let allCommands = [];
    let loadedCommands = [];
    let totalCommands = 0;
    const commandsDir = await readdir(`./Commands/Slash`);

    // Load all commands
    for (const dir of commandsDir) {
      const commands = await readdir(`./Commands/Slash/${dir}`);
      const jsCommands = commands.filter((f) => f.endsWith(".js"));
      totalCommands += jsCommands.length;

      for (const cmd of jsCommands) {
        try {
          const command = await import(`../Commands/Slash/${dir}/${cmd}`).then(
            (r) => r.default
          );

          // Validate command structure
          if (!command?.data || !command?.run) {
            console.warn(
              `[!] Command in ${cmd} is missing required 'data' or 'run' property`
            );
            continue;
          }

          // Initialize permission arrays if not present
          command.botPermissions = command.botPermissions || [];
          command.memberPermissions = command.memberPermissions || [];

          client.scommands.set(command.data.name, command);
          allCommands.push(command.data.toJSON());
          loadedCommands.push({
            category: dir,
            name: command.data.name,
          });

          Logger.updateSpinner(
            spinnerId,
            `Loading slash commands... (${client.scommands.size}/${totalCommands})`
          );
        } catch (error) {
          console.error(`[x] Error loading command from file ${cmd}:`, error);
        }
      }
    }

    Logger.succeedSpinner(spinnerId);

    // Group commands by category
    const groupedCommands = loadedCommands.reduce((acc, cmd) => {
      if (!acc[cmd.category]) acc[cmd.category] = [];
      acc[cmd.category].push(cmd.name);
      return acc;
    }, {});

    // Create box content
    const boxContent = ["[*] Command Statistics"];
    boxContent.push(`[*] Total Commands: ${client.scommands.size}`);
    boxContent.push("\nCommands by Category:");

    Object.entries(groupedCommands).forEach(([category, commands]) => {
      boxContent.push(`\n${category}:`);
      commands.forEach((cmd) => boxContent.push(`  + ${cmd}`));
    });

    console.log(Logger.createBox("Slash Commands Loaded", boxContent));
    console.log(
      "[>] Note: Use 'node deploy-commands.js' to register commands with Discord"
    );
  } catch (error) {
    console.error("[x] An error occurred while loading slash commands:", error);
  }
}
