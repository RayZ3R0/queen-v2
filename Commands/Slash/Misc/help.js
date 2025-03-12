import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Colors,
} from "discord.js";

// Utility function to get command description
function getCommandDescription(command) {
  if (command.description) return command.description;
  if (command.data?.description) return command.data.description;
  return "No description available";
}

// Global state management
const collectors = new Map();
const viewStates = new Map();

// Category info configuration
const categoryInfo = {
  Spirits: {
    emoji: "🎮",
    color: Colors.Purple,
    description: "Spirit-related commands for games and activities",
  },
  Moderation: {
    emoji: "⚔️",
    color: Colors.Red,
    description: "Commands for server moderation and management",
  },
  Leveling: {
    emoji: "⭐",
    color: Colors.Gold,
    description: "XP system and leveling commands",
  },
  Misc: {
    emoji: "🔧",
    color: Colors.Blurple,
    description: "Miscellaneous utility commands",
  },
};

// Command configuration
export default {
  name: "help",
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Shows information about bot commands")
    .addStringOption((option) =>
      option
        .setName("category")
        .setDescription("Command category to view")
        .setRequired(false)
        .addChoices(
          { name: "🎮 Spirits", value: "Spirits" },
          { name: "⚔️ Moderation", value: "Moderation" },
          { name: "⭐ Leveling", value: "Leveling" },
          { name: "🔧 Misc", value: "Misc" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("Specific command to view details for")
        .setRequired(false)
        .setAutocomplete(true)
    ),

  category: "Misc",
  cooldown: 3,

  run: async ({ client, interaction }) => {
    await interaction.deferReply();

    const category = interaction.options.getString("category");
    const commandName = interaction.options.getString("command");

    try {
      if (commandName) {
        const command = client.scommands.get(commandName);
        if (!command) {
          return interaction.editReply({
            content: "❌ Command not found!",
            ephemeral: true,
          });
        }
        return await showCommandDetails(interaction, command);
      }

      if (category) {
        return await showCategoryCommands(
          interaction,
          category,
          client.scommands
        );
      }

      return await showMainHelp(interaction, client.scommands);
    } catch (error) {
      console.error("Error in help command:", error);
      return interaction.editReply({
        content: "An error occurred while processing the command.",
        ephemeral: true,
      });
    }
  },

  autocomplete: async (interaction) => {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const choices = Array.from(interaction.client.scommands.keys());
    const filtered = choices.filter((choice) =>
      choice.toLowerCase().includes(focusedValue)
    );
    await interaction.respond(
      filtered.map((choice) => ({ name: choice, value: choice })).slice(0, 25)
    );
  },
};

// Helper functions
function cleanupCollectors(userId, preserveType = null) {
  const existing = collectors.get(userId);
  if (existing && existing.type !== preserveType) {
    existing.collector.stop();
    collectors.delete(userId);
  }
}

function registerCollector(userId, collector, type) {
  cleanupCollectors(userId, type);
  collectors.set(userId, { collector, type });
}

function updateViewState(userId, state) {
  viewStates.set(userId, state);
}

// Main help menu display
async function showMainHelp(interaction, commands, fromNavigation = false) {
  try {
    const categories = [...new Set(commands.map((cmd) => cmd.category))].sort();
    const mainEmbed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle("📚 Command Categories")
      .setDescription(
        "Select a category from the dropdown menu below or use `/help category`"
      )
      .setTimestamp();

    categories.forEach((category) => {
      const info = categoryInfo[category] || {
        emoji: "📁",
        description: "Various commands",
      };
      const categoryCommands = Array.from(commands.values()).filter(
        (cmd) => cmd.category === category
      );
      mainEmbed.addFields({
        name:
          info.emoji + " " + category + " [" + categoryCommands.length + "]",
        value: info.description || "No description available",
        inline: false,
      });
    });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("category_select")
        .setPlaceholder("Select a category")
        .addOptions(
          categories.map((category) => {
            const info = categoryInfo[category] || { emoji: "📁" };
            return {
              label: category,
              value: category,
              emoji: info.emoji,
              description: "View " + category + " commands",
            };
          })
        )
    );

    const message = await interaction.editReply({
      embeds: [mainEmbed],
      components: [row],
    });

    if (!fromNavigation) {
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === interaction.user.id,
        time: 300000, // 5 minutes
      });

      registerCollector(interaction.user.id, collector, "main");
      updateViewState(interaction.user.id, { view: "main" });

      collector.on("collect", async (i) => {
        try {
          await i.deferUpdate();
          const selectedCategory = i.values[0];
          await showCategoryCommands(interaction, selectedCategory, commands);
        } catch (error) {
          console.error("Error in category selection:", error);
        }
      });

      collector.on("end", () => {
        if (message.editable) {
          const disabledRow = ActionRowBuilder.from(row);
          disabledRow.components[0].setDisabled(true);
          interaction.editReply({ components: [disabledRow] }).catch(() => {});
        }
      });
    }
  } catch (error) {
    console.error("Error in showMainHelp:", error);
    await interaction.editReply({
      content: "An error occurred while showing the help menu.",
    });
  }
}

async function showCategoryCommands(interaction, category, commands) {
  try {
    updateViewState(interaction.user.id, { view: "category", category });

    const categoryCommands = Array.from(commands.values()).filter(
      (cmd) => cmd.category === category
    );

    const info = categoryInfo[category] || {
      emoji: "📁",
      color: Colors.Grey,
      description: "Various commands",
    };

    if (categoryCommands.length === 0) {
      return await interaction.editReply({
        content: "No commands found in this category.",
        components: [getMainMenuButton()],
      });
    }

    const embed = new EmbedBuilder()
      .setColor(info.color)
      .setTitle(info.emoji + " " + category + " Commands")
      .setDescription(info.description)
      .setTimestamp();

    const itemsPerPage = 9;
    const chunks = [];
    for (let i = 0; i < categoryCommands.length; i += itemsPerPage) {
      chunks.push(categoryCommands.slice(i, i + itemsPerPage));
    }

    let currentPage = 0;

    function getPageEmbed(page) {
      const pageEmbed = EmbedBuilder.from(embed);
      chunks[page].forEach((cmd) => {
        pageEmbed.addFields({
          name: "/" + cmd.name,
          value: getCommandDescription(cmd),
          inline: false,
        });
      });
      if (chunks.length > 1) {
        pageEmbed.setFooter({
          text: "Page " + (page + 1) + " of " + chunks.length,
        });
      }
      return pageEmbed;
    }

    function getCommandsRow(page) {
      return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("command_select")
          .setPlaceholder("Select a command for details")
          .addOptions(
            chunks[page].map((cmd) => ({
              label: cmd.name,
              value: cmd.name,
              description: getCommandDescription(cmd).slice(0, 100),
            }))
          )
      );
    }

    function getNavigationRow() {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("main_menu")
          .setLabel("Main Menu")
          .setStyle(ButtonStyle.Secondary),
        ...(chunks.length > 1
          ? [
              new ButtonBuilder()
                .setCustomId("prev")
                .setLabel("Previous")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
              new ButtonBuilder()
                .setCustomId("next")
                .setLabel("Next")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === chunks.length - 1),
            ]
          : [])
      );
    }

    await interaction.editReply({
      embeds: [getPageEmbed(currentPage)],
      components: [getCommandsRow(currentPage), getNavigationRow()],
    });

    const collector = interaction.channel.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 300000,
    });

    registerCollector(interaction.user.id, collector, "category");

    collector.on("collect", async (i) => {
      try {
        await i.deferUpdate();

        switch (i.customId) {
          case "command_select": {
            const command = commands.get(i.values[0]);
            await showCommandDetails(interaction, command);
            break;
          }
          case "main_menu":
            cleanupCollectors(interaction.user.id);
            await showMainHelp(interaction, commands, true);
            break;
          case "prev":
            currentPage = Math.max(0, currentPage - 1);
            await interaction.editReply({
              embeds: [getPageEmbed(currentPage)],
              components: [getCommandsRow(currentPage), getNavigationRow()],
            });
            break;
          case "next":
            currentPage = Math.min(chunks.length - 1, currentPage + 1);
            await interaction.editReply({
              embeds: [getPageEmbed(currentPage)],
              components: [getCommandsRow(currentPage), getNavigationRow()],
            });
            break;
        }
      } catch (error) {
        console.error("Error in category command interaction:", error);
      }
    });

    collector.on("end", () => {
      if (interaction.replied || interaction.deferred) {
        const components = [getCommandsRow(currentPage), getNavigationRow()];
        components.forEach((row) => {
          row.components.forEach((c) => c.setDisabled(true));
        });
        interaction.editReply({ components }).catch(() => {});
      }
    });
  } catch (error) {
    console.error("Error in showCategoryCommands:", error);
    await interaction.editReply({
      content: "An error occurred while showing category commands.",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("main_menu")
            .setLabel("Main Menu")
            .setStyle(ButtonStyle.Secondary)
        ),
      ],
    });
  }
}

async function showCommandDetails(interaction, command) {
  try {
    updateViewState(interaction.user.id, {
      view: "command",
      command: command.name,
      category: command.category,
    });

    const info = categoryInfo[command.category] || {
      emoji: "📁",
      color: Colors.Grey,
    };

    const embed = new EmbedBuilder()
      .setColor(info.color)
      .setTitle("Command: /" + command.name)
      .setDescription(getCommandDescription(command))
      .setTimestamp();

    if (command.cooldown) {
      embed.addFields({
        name: "⏰ Cooldown",
        value: command.cooldown + " seconds",
        inline: true,
      });
    }

    if (command.memberPermissions?.length > 0) {
      embed.addFields({
        name: "👤 Required Permissions",
        value: command.memberPermissions.join(", "),
        inline: true,
      });
    }

    const options = command.data.options;
    if (options?.length > 0) {
      embed.addFields({
        name: "⚙️ Options",
        value: options
          .map(
            (opt) =>
              (opt.required ? "❗" : "⭕") +
              " " +
              opt.name +
              ": " +
              opt.description
          )
          .join("\n"),
        inline: false,
      });
    }

    embed.addFields({
      name: "📁 Category",
      value: info.emoji + " " + command.category,
      inline: true,
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("back_to_category")
        .setLabel("Back to Category")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("main_menu")
        .setLabel("Main Menu")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    const collector = interaction.channel.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 300000,
    });

    registerCollector(interaction.user.id, collector, "command");

    collector.on("collect", async (i) => {
      try {
        await i.deferUpdate();

        if (i.customId === "back_to_category") {
          await showCategoryCommands(
            interaction,
            command.category,
            interaction.client.scommands
          );
        } else if (i.customId === "main_menu") {
          cleanupCollectors(interaction.user.id);
          await showMainHelp(interaction, interaction.client.scommands, true);
        }
      } catch (error) {
        console.error("Error in command details interaction:", error);
      }
    });

    collector.on("end", () => {
      if (interaction.replied || interaction.deferred) {
        const disabledRow = ActionRowBuilder.from(row);
        disabledRow.components.forEach((button) => button.setDisabled(true));
        interaction.editReply({ components: [disabledRow] }).catch(() => {});
      }
    });
  } catch (error) {
    console.error("Error in showCommandDetails:", error);
    await interaction.editReply({
      content: "An error occurred while showing command details.",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("main_menu")
            .setLabel("Main Menu")
            .setStyle(ButtonStyle.Secondary)
        ),
      ],
    });
  }
}
