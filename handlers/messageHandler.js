import { Bot } from "./Client.js";
import { readdir } from "node:fs/promises";
import { Logger } from "../utils/Logger.js";

/**
 * Loads message commands for the client.
 * @param {Bot} client - The client instance.
 */
export default async (client) => {
  try {
    const spinnerId = Logger.startSpinner("Loading message commands");
    let loadedCommands = [];
    let totalCommands = 0;

    const commandsDir = await readdir(`./Commands/Message`);
    let processedDirs = 0;

    for (const dir of commandsDir) {
      const commands = await readdir(`./Commands/Message/${dir}`);
      const filterCommands = commands.filter((f) => f.endsWith(".js"));
      totalCommands += filterCommands.length;

      for (const cmd of filterCommands) {
        try {
          /**
           * @type {import("../index.js").Scommand}
           */
          const command = await import(
            `../Commands/Message/${dir}/${cmd}`
          ).then((r) => r.default);

          if (command.name) {
            client.mcommands.set(command.name, command);
            loadedCommands.push({
              category: dir,
              name: command.name,
            });
          }

          Logger.updateSpinner(
            spinnerId,
            `Loading message commands... (${client.mcommands.size}/${totalCommands})`
          );
        } catch (error) {
          console.error(`[x] Error loading command from file ${cmd}:`, error);
        }
      }
      processedDirs++;
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
    boxContent.push(`[*] Total Commands: ${client.mcommands.size}`);
    boxContent.push("\nCommands by Category:");

    Object.entries(groupedCommands).forEach(([category, commands]) => {
      boxContent.push(`\n${category}:`);
      commands.forEach((cmd) => boxContent.push(`  + ${cmd}`));
    });

    console.log(Logger.createBox("Message Commands Loaded", boxContent));
  } catch (error) {
    console.error(
      "[x] An error occurred while reading the commands directory:",
      error
    );
  }
};
