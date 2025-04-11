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

// Global view state manager with improved error handling
const viewManager = {
  states: new Map(),
  collectors: new Map(),
  inTransition: new Set(), // Track users in navigation transition

  registerView(userId, state, collector = null) {
    this.states.set(userId, state);
    if (collector) {
      this.stopCollector(userId);
      this.collectors.set(userId, collector);
    }
  },

  getState(userId) {
    return this.states.get(userId);
  },

  stopCollector(userId) {
    const collector = this.collectors.get(userId);
    if (collector) {
      collector.stop();
      this.collectors.delete(userId);
    }
  },

  cleanup(userId) {
    this.states.delete(userId);
    this.stopCollector(userId);
    this.inTransition.delete(userId); // Clean up transition state
  },

  // Track when a user is navigating between views
  setTransitioning(userId, isTransitioning) {
    if (isTransitioning) {
      this.inTransition.add(userId);
    } else {
      this.inTransition.delete(userId);
    }
  },

  isTransitioning(userId) {
    return this.inTransition.has(userId);
  },
};

// Category configuration
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

  // Command execution
  run: async ({ client, interaction }) => {
    await interaction.deferReply();

    try {
      // Clean up any existing state for this user
      viewManager.cleanup(interaction.user.id);

      const category = interaction.options.getString("category");
      const commandName = interaction.options.getString("command");

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

function getCommandDescription(command) {
  if (command.description) return command.description;
  if (command.data?.description) return command.data.description;
  return "No description available";
}

function createMainMenuButton(disabled = false) {
  return new ButtonBuilder()
    .setCustomId("main_menu")
    .setLabel("Main Menu")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled);
}

async function showMainHelp(interaction, commands) {
  try {
    const categories = [...new Set(commands.map((cmd) => cmd.category))].sort();

    const mainEmbed = new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle("📚 Command Categories")
      .setDescription(
        "Select a category from the dropdown menu below or use `/help category`"
      )
      .setTimestamp();

    // Add category fields
    categories.forEach((category) => {
      const info = categoryInfo[category] || {
        emoji: "📁",
        description: "Various commands",
      };
      const categoryCommands = Array.from(commands.values()).filter(
        (cmd) => cmd.category === category
      );
      mainEmbed.addFields({
        name: `${info.emoji} ${category} [${categoryCommands.length}]`,
        value: info.description || "No description available",
        inline: false,
      });
    });

    // Create category selection menu
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
              description: `View ${category} commands`,
            };
          })
        )
    );

    // End transition state before replying
    viewManager.setTransitioning(interaction.user.id, false);

    // Send initial message
    const message = await interaction.editReply({
      embeds: [mainEmbed],
      components: [row],
    });

    // Create collector
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 300000, // 5 minutes
    });

    viewManager.registerView(interaction.user.id, { view: "main" }, collector);

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: "This menu isn't for you!",
          ephemeral: true,
        });
      }

      try {
        // Prevent multiple concurrent interactions
        if (viewManager.isTransitioning(i.user.id)) {
          return i.reply({
            content: "Please wait, processing your previous selection...",
            ephemeral: true,
          });
        }

        viewManager.setTransitioning(i.user.id, true);
        await i.deferUpdate();

        const selectedCategory = i.values[0];
        collector.stop();
        await showCategoryCommands(interaction, selectedCategory, commands);
      } catch (error) {
        viewManager.setTransitioning(i.user.id, false);
        console.error("Error in category selection:", error);
        i.followUp({
          content: "An error occurred while processing your selection.",
          ephemeral: true,
        }).catch(() => {});
      }
    });

    collector.on("end", () => {
      if (message.editable) {
        const disabledRow = ActionRowBuilder.from(row);
        disabledRow.components[0].setDisabled(true);
        interaction.editReply({ components: [disabledRow] }).catch(() => {});
      }
    });
  } catch (error) {
    console.error("Error in showMainHelp:", error);
    await interaction.editReply({
      content: "An error occurred while showing the help menu.",
    });
  }
}

async function showCategoryCommands(interaction, category, commands) {
  try {
    viewManager.cleanup(interaction.user.id);

    const categoryCommands = Array.from(commands.values()).filter(
      (cmd) => cmd.category === category
    );

    const info = categoryInfo[category] || {
      emoji: "📁",
      color: Colors.Grey,
      description: "Various commands",
    };

    // Handle empty category
    if (categoryCommands.length === 0) {
      viewManager.setTransitioning(interaction.user.id, false);
      return await interaction.editReply({
        content: "No commands found in this category.",
        components: [
          new ActionRowBuilder().addComponents(createMainMenuButton()),
        ],
      });
    }

    const embed = new EmbedBuilder()
      .setColor(info.color)
      .setTitle(`${info.emoji} ${category} Commands`)
      .setDescription(info.description)
      .setTimestamp();

    // Paginate commands
    const itemsPerPage = 9;
    const chunks = [];
    for (let i = 0; i < categoryCommands.length; i += itemsPerPage) {
      chunks.push(categoryCommands.slice(i, i + itemsPerPage));
    }

    let currentPage = 0;

    // Create page display
    function createPageContent(page) {
      const pageEmbed = EmbedBuilder.from(embed);

      // Add command fields
      chunks[page].forEach((cmd) => {
        pageEmbed.addFields({
          name: `/${cmd.name}`,
          value: getCommandDescription(cmd),
          inline: false,
        });
      });

      // Add page number if needed
      if (chunks.length > 1) {
        pageEmbed.setFooter({
          text: `Page ${page + 1} of ${chunks.length}`,
        });
      }

      // Create command selection menu
      const commandSelect = new ActionRowBuilder().addComponents(
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

      // Create navigation row
      const navigationRow = new ActionRowBuilder().addComponents(
        createMainMenuButton(),
        ...(chunks.length > 1
          ? [
              new ButtonBuilder()
                .setCustomId("prev_page")
                .setLabel("Previous")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 0),
              new ButtonBuilder()
                .setCustomId("next_page")
                .setLabel("Next")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === chunks.length - 1),
            ]
          : [])
      );

      return {
        embeds: [pageEmbed],
        components: [commandSelect, navigationRow],
      };
    }

    // End transition state before replying
    viewManager.setTransitioning(interaction.user.id, false);

    // Send initial message
    const message = await interaction.editReply(createPageContent(currentPage));

    // Create collector for interactions
    const collector = message.createMessageComponentCollector({
      time: 300000, // 5 minutes
    });

    viewManager.registerView(
      interaction.user.id,
      { view: "category", category, currentPage },
      collector
    );

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: "These controls aren't for you!",
          ephemeral: true,
        });
      }

      try {
        // Prevent multiple concurrent interactions
        if (viewManager.isTransitioning(i.user.id)) {
          return i.reply({
            content: "Please wait, processing your previous selection...",
            ephemeral: true,
          });
        }

        viewManager.setTransitioning(i.user.id, true);
        await i.deferUpdate();

        switch (i.customId) {
          case "command_select": {
            const command = commands.get(i.values[0]);
            collector.stop();
            await showCommandDetails(interaction, command);
            break;
          }
          case "main_menu":
            collector.stop();
            await showMainHelp(interaction, commands);
            break;
          case "prev_page":
            currentPage = Math.max(0, currentPage - 1);
            viewManager.setTransitioning(i.user.id, false);
            await interaction.editReply(createPageContent(currentPage));
            break;
          case "next_page":
            currentPage = Math.min(chunks.length - 1, currentPage + 1);
            viewManager.setTransitioning(i.user.id, false);
            await interaction.editReply(createPageContent(currentPage));
            break;
        }
      } catch (error) {
        viewManager.setTransitioning(i.user.id, false);
        console.error("Error handling interaction:", error);
        i.followUp({
          content: "An error occurred while processing your selection.",
          ephemeral: true,
        }).catch(() => {});
      }
    });

    collector.on("end", () => {
      if (message.editable) {
        const lastContent = createPageContent(currentPage);
        lastContent.components.forEach((row) => {
          row.components.forEach((c) => c.setDisabled(true));
        });
        interaction.editReply(lastContent).catch(() => {});
      }
    });
  } catch (error) {
    viewManager.setTransitioning(interaction.user.id, false);
    console.error("Error in showCategoryCommands:", error);
    await interaction.editReply({
      content: "An error occurred while showing category commands.",
      components: [
        new ActionRowBuilder().addComponents(createMainMenuButton()),
      ],
    });
  }
}

async function showCommandDetails(interaction, command) {
  try {
    viewManager.cleanup(interaction.user.id);

    const info = categoryInfo[command.category] || {
      emoji: "📁",
      color: Colors.Grey,
    };

    const embed = new EmbedBuilder()
      .setColor(info.color)
      .setTitle(`Command: /${command.name}`)
      .setDescription(getCommandDescription(command))
      .setTimestamp();

    if (command.cooldown) {
      embed.addFields({
        name: "⏰ Cooldown",
        value: `${command.cooldown} seconds`,
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
              `${opt.required ? "❗" : "⭕"} ${opt.name}: ${opt.description}`
          )
          .join("\n"),
        inline: false,
      });
    }

    embed.addFields({
      name: "📁 Category",
      value: `${info.emoji} ${command.category}`,
      inline: true,
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("back_to_category")
        .setLabel("Back to Category")
        .setStyle(ButtonStyle.Secondary),
      createMainMenuButton()
    );

    // End transition state before replying
    viewManager.setTransitioning(interaction.user.id, false);

    const message = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    const collector = message.createMessageComponentCollector({
      time: 300000, // 5 minutes
    });

    viewManager.registerView(
      interaction.user.id,
      { view: "command", command: command.name },
      collector
    );

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: "These controls aren't for you!",
          ephemeral: true,
        });
      }

      try {
        // Prevent multiple concurrent interactions
        if (viewManager.isTransitioning(i.user.id)) {
          return i.reply({
            content: "Please wait, processing your previous selection...",
            ephemeral: true,
          });
        }

        viewManager.setTransitioning(i.user.id, true);
        await i.deferUpdate();

        if (i.customId === "back_to_category") {
          collector.stop();
          await showCategoryCommands(
            interaction,
            command.category,
            interaction.client.scommands
          );
        } else if (i.customId === "main_menu") {
          collector.stop();
          await showMainHelp(interaction, interaction.client.scommands);
        }
      } catch (error) {
        viewManager.setTransitioning(i.user.id, false);
        console.error("Error handling interaction:", error);
        i.followUp({
          content: "An error occurred while processing your selection.",
          ephemeral: true,
        }).catch(() => {});
      }
    });

    collector.on("end", () => {
      if (message.editable) {
        const disabledRow = ActionRowBuilder.from(row);
        disabledRow.components.forEach((c) => c.setDisabled(true));
        interaction.editReply({ components: [disabledRow] }).catch(() => {});
      }
    });
  } catch (error) {
    viewManager.setTransitioning(interaction.user.id, false);
    console.error("Error in showCommandDetails:", error);
    await interaction.editReply({
      content: "An error occurred while showing command details.",
      components: [
        new ActionRowBuilder().addComponents(createMainMenuButton()),
      ],
    });
  }
}
