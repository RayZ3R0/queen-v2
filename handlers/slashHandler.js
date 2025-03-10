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
          if (!command?.name) {
            console.warn(
              `⚠️ Command in ${cmd} is missing required 'name' property`
            );
            continue;
          }

          // Initialize permission arrays if not present
          command.botPermissions = command.botPermissions || [];
          command.memberPermissions = command.memberPermissions || [];

          // Validate required command properties
          const requiredProps = ["description", "type", "run"];
          const missingProps = requiredProps.filter((prop) => !command[prop]);

          if (missingProps.length > 0) {
            console.warn(
              `⚠️ Command ${
                command.name
              } is missing required properties: ${missingProps.join(", ")}`
            );
            continue;
          }

          client.scommands.set(command.name, command);
          allCommands.push(command);
          console.log(`> ✓ Loaded slash command: ${command.name}`);
        } catch (error) {
          console.error(`❌ Error loading command from file ${cmd}:`, error);
        }
      }
    }

    // Wait for client to be ready before registering commands
    if (!client.isReady()) {
      console.log("> Waiting for client to be ready...");
      await new Promise((resolve) => client.once("ready", resolve));
    }

    try {
      console.log(`> Registering ${allCommands.length} slash commands...`);

      // Clear existing commands first
      if (Global) {
        const existingGlobalCommands =
          await client.application.commands.fetch();
        console.log(
          `> Found ${existingGlobalCommands.size} existing global commands`
        );

        await client.application.commands.set([]);
        console.log("> Cleared existing global commands");

        await client.application.commands.set(allCommands);
        console.log("> ✅ Slash commands registered globally");
      } else {
        const guild = await client.guilds.fetch(GuildID);
        if (!guild) {
          throw new Error(`Could not find guild with ID: ${GuildID}`);
        }

        const existingGuildCommands = await guild.commands.fetch();
        console.log(
          `> Found ${existingGuildCommands.size} existing guild commands`
        );

        await guild.commands.set([]);
        console.log("> Cleared existing guild commands");

        await guild.commands.set(allCommands);
        console.log(`> ✅ Slash commands registered in guild: ${guild.name}`);
      }
    } catch (error) {
      console.error("❌ Error registering slash commands:", error);
      // Try to provide more specific error information
      if (error.code === 50001) {
        console.error(
          "Bot lacks 'applications.commands' scope or required permissions"
        );
      }
      throw error; // Re-throw to be caught by outer try-catch
    }

    console.log(
      `> ✅ Successfully loaded and registered ${client.scommands.size} slash commands`
    );
  } catch (error) {
    console.error("❌ An error occurred while loading slash commands:", error);
  }
}
