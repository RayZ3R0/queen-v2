import { SlashCommandBuilder, PermissionFlagsBits, REST, Routes } from "discord.js";
import { readdir } from "node:fs/promises";

export default {
  name: "reload",
  data: new SlashCommandBuilder()
    .setName("reload")
    .setDescription("Reload and register slash commands (Owner only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  category: "Utils",

  run: async ({ client, interaction }) => {
    // Check if user is the specific owner
    if (interaction.user.id !== "636598760616624128") {
      return interaction.reply({
        content: "❌ This command is restricted to the bot owner only.",
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const commands = [];
      const commandsDir = await readdir("./Commands/Slash");

      // Load all commands
      for (const dir of commandsDir) {
        const files = await readdir(`./Commands/Slash/${dir}`);
        const jsFiles = files.filter((f) => f.endsWith(".js"));

        for (const file of jsFiles) {
          try {
            // Clear cache and reimport
            const modulePath = `../../../Commands/Slash/${dir}/${file}`;
            delete require.cache[require.resolve(modulePath)];
            
            const command = await import(`${modulePath}?update=${Date.now()}`).then(
              (r) => r.default
            );

            if (command?.data && command?.run) {
              client.scommands.set(command.data.name, command);
              commands.push(command.data.toJSON());
            }
          } catch (error) {
            console.error(`Error loading ${file}:`, error);
          }
        }
      }

      // Register commands with Discord
      const rest = new REST().setToken(client.token);
      const {
        Slash: { Global, GuildID },
      } = client.config;

      if (Global) {
        await rest.put(Routes.applicationCommands(client.user.id), {
          body: commands,
        });
        await interaction.editReply({
          content: `✅ Successfully reloaded and registered ${commands.length} slash commands globally.\n\nNote: Global commands may take up to 1 hour to update.`,
          ephemeral: true,
        });
      } else {
        await rest.put(
          Routes.applicationGuildCommands(client.user.id, GuildID),
          { body: commands }
        );
        await interaction.editReply({
          content: `✅ Successfully reloaded and registered ${commands.length} slash commands for this guild.`,
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Error reloading commands:", error);
      await interaction.editReply({
        content: `❌ Error reloading commands: ${error.message}`,
        ephemeral: true,
      });
    }
  },
};
