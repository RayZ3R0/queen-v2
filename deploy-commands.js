import { REST, Routes } from "discord.js";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import settings from "./settings/config.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands = [];
console.log("Loading commands...");

try {
  // Grab all command folders
  const foldersPath = join(__dirname, "Commands/Slash");
  const commandFolders = await readdir(foldersPath);

  for (const folder of commandFolders) {
    // Read command files from each folder
    const commandsPath = join(foldersPath, folder);
    const commandFiles = (await readdir(commandsPath)).filter((file) =>
      file.endsWith(".js")
    );

    for (const file of commandFiles) {
      const filePath = join(commandsPath, file);
      const command = await import(filePath).then((m) => m.default);

      if ("data" in command && "run" in command) {
        commands.push(command.data.toJSON());
        console.log(`Loaded command: ${command.data.name}`);
      } else {
        console.log(
          `[WARNING] Command at ${filePath} is missing required "data" or "run" property`
        );
      }
    }
  }

  // Construct and prepare REST instance
  const token = process.env.TOKEN;
  if (!token) {
    throw new Error("Bot token not found in environment variables");
  }
  const rest = new REST().setToken(token);

  // Deploy commands
  console.log(
    `Started refreshing ${commands.length} application (/) commands.`
  );

  let data;
  if (settings.Slash.Global) {
    // Global commands
    data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID || settings.CLIENT_ID),
      { body: commands }
    );
    console.log(
      `Successfully reloaded ${data.length} global application (/) commands.`
    );
  } else {
    // Guild-specific commands
    data = await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID || settings.CLIENT_ID,
        settings.Slash.GuildID
      ),
      { body: commands }
    );
    console.log(
      `Successfully reloaded ${data.length} guild application (/) commands.`
    );
  }
} catch (error) {
  console.error(error);
}
