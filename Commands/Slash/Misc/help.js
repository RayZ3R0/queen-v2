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

// Utility function to get command description from either source
function getCommandDescription(command) {
  if (command.description) {
    return command.description;
  }
  if (command.data?.description) {
    return command.data.description;
  }
  return "No description available";
}

// Category icons and colors
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

    // If a specific command is requested
    if (commandName) {
      const command = client.scommands.get(commandName);
      if (!command) {
        return interaction.editReply({
          content: "❌ Command not found!",
          ephemeral: true,
        });
      }
      return showCommandDetails(interaction, command);
    }

    // If a category is specified
    if (category) {
      return showCategoryCommands(interaction, category, client.scommands);
    }

    // Show main help menu
    return showMainHelp(interaction, client.scommands);
  },

  // Autocomplete handler for command names
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

async function showMainHelp(interaction, commands) {
  try {
    // Get unique categories and sort them
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
        name:
          info.emoji + " " + category + " [" + categoryCommands.length + "]",
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
              description: "View all " + category + " commands",
            };
          })
        )
    );

    const message = await interaction.editReply({
      embeds: [mainEmbed],
      components: [row],
    });

    // Create collector for category selection
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: "This menu isn't for you!",
          ephemeral: true,
        });
      }

      try {
        await i.deferUpdate();
        const selectedCategory = i.values[0];
        await showCategoryCommands(interaction, selectedCategory, commands, i);
      } catch (error) {
        console.error("Error in category selection:", error);
        if (!i.replied && !i.deferred) {
          await i.reply({
            content: "An error occurred. Please try again.",
            ephemeral: true,
          });
        }
      }
    });

    collector.on("end", () => {
      if (message.editable) {
        row.components[0].setDisabled(true);
        interaction.editReply({ components: [row] }).catch(() => {});
      }
    });
  } catch (error) {
    console.error("Error in showMainHelp:", error);
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({
        content: "An error occurred while showing the help menu.",
      });
    }
  }
}

async function showCategoryCommands(interaction, category, commands, i = null) {
  try {
    const categoryCommands = Array.from(commands.values()).filter(
      (cmd) => cmd.category === category
    );

    if (categoryCommands.length === 0) {
      const response = {
        content: "No commands found in this category.",
        ephemeral: true,
      };
      return i ? i.editReply(response) : interaction.editReply(response);
    }

    const info = categoryInfo[category] || {
      emoji: "📁",
      color: Colors.Grey,
      description: "Various commands",
    };

    const embed = new EmbedBuilder()
      .setColor(info.color)
      .setTitle(info.emoji + " " + category + " Commands")
      .setDescription(info.description)
      .setTimestamp();

    // Create chunks of commands for pagination
    const itemsPerPage = 9;
    const chunks = [];
    for (let i = 0; i < categoryCommands.length; i += itemsPerPage) {
      chunks.push(categoryCommands.slice(i, i + itemsPerPage));
    }

    let currentPage = 0;

    function getPageEmbed(page) {
      const pageEmbed = EmbedBuilder.from(embed);
      chunks[page].forEach((cmd) => {
        const description = getCommandDescription(cmd);
        pageEmbed.addFields({
          name: "/" + cmd.name,
          value: description,
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

    // Create command selection menu for the current page
    function getCommandMenu(page) {
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

    // Create navigation buttons if needed
    const getNavigationRow = () => {
      const row = new ActionRowBuilder().addComponents(
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
        new ButtonBuilder()
          .setCustomId("main_menu")
          .setLabel("Main Menu")
          .setStyle(ButtonStyle.Secondary)
      );
      return row;
    };

    const components = [getCommandMenu(currentPage)];
    if (chunks.length > 1) {
      components.push(getNavigationRow());
    }

    const response = {
      embeds: [getPageEmbed(currentPage)],
      components,
    };

    const message = await (i
      ? i.editReply(response)
      : interaction.editReply(response));

    if (chunks.length === 1 && categoryCommands.length <= 1) return;

    const collector = message.createMessageComponentCollector({
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: "These controls aren't for you!",
          ephemeral: true,
        });
      }

      try {
        await i.deferUpdate();

        if (i.customId === "command_select") {
          const command = commands.get(i.values[0]);
          await showCommandDetails(interaction, command, i);
        } else if (i.customId === "main_menu") {
          await showMainHelp(interaction, commands);
        } else {
          if (i.customId === "prev") currentPage--;
          else if (i.customId === "next") currentPage++;

          await i.editReply({
            embeds: [getPageEmbed(currentPage)],
            components: [getCommandMenu(currentPage), getNavigationRow()],
          });
        }
      } catch (error) {
        console.error("Error in category command interaction:", error);
        if (!i.replied && !i.deferred) {
          await i.reply({
            content: "An error occurred. Please try again.",
            ephemeral: true,
          });
        }
      }
    });

    collector.on("end", () => {
      if (message.editable) {
        const disabledComponents = components.map((row) => {
          const disabledRow = ActionRowBuilder.from(row);
          disabledRow.components.forEach((c) => c.setDisabled(true));
          return disabledRow;
        });
        interaction
          .editReply({ components: disabledComponents })
          .catch(() => {});
      }
    });
  } catch (error) {
    console.error("Error in showCategoryCommands:", error);
    const errorResponse = {
      content: "An error occurred while showing category commands.",
      ephemeral: true,
    };
    if (i && (i.replied || i.deferred)) {
      await i.editReply(errorResponse);
    } else if (interaction.replied || interaction.deferred) {
      await interaction.editReply(errorResponse);
    }
  }
}

async function showCommandDetails(interaction, command, i = null) {
  try {
    const info = categoryInfo[command.category] || {
      emoji: "📁",
      color: Colors.Grey,
    };

    const embed = new EmbedBuilder()
      .setColor(info.color)
      .setTitle("Command: /" + command.name)
      .setDescription(getCommandDescription(command))
      .setTimestamp();

    // Add cooldown info if available
    if (command.cooldown) {
      embed.addFields({
        name: "⏰ Cooldown",
        value: command.cooldown + " seconds",
        inline: true,
      });
    }

    // Add permissions if available
    if (command.memberPermissions?.length > 0) {
      embed.addFields({
        name: "👤 Required Permissions",
        value: command.memberPermissions.join(", "),
        inline: true,
      });
    }

    // Add options if available
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

    // Add category info
    embed.addFields({
      name: "📁 Category",
      value: info.emoji + " " + command.category,
      inline: true,
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("back_to_category")
        .setLabel("Back to Category")
        .setStyle(ButtonStyle.Secondary)
    );

    const response = { embeds: [embed], components: [row] };

    const message = await (i
      ? i.editReply(response)
      : interaction.editReply(response));

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: "This button isn't for you!",
          ephemeral: true,
        });
      }

      try {
        await i.deferUpdate();

        if (i.customId === "back_to_category") {
          await showCategoryCommands(
            interaction,
            command.category,
            interaction.client.scommands
          );
        }
      } catch (error) {
        console.error("Error in command details interaction:", error);
        if (!i.replied && !i.deferred) {
          await i.reply({
            content: "An error occurred. Please try again.",
            ephemeral: true,
          });
        }
      }
    });

    collector.on("end", () => {
      if (message.editable) {
        row.components.forEach((button) => button.setDisabled(true));
        interaction.editReply({ components: [row] }).catch(() => {});
      }
    });
  } catch (error) {
    console.error("Error in showCommandDetails:", error);
    const errorResponse = {
      content: "An error occurred while showing command details.",
      ephemeral: true,
    };
    if (i && (i.replied || i.deferred)) {
      await i.editReply(errorResponse);
    } else if (interaction.replied || interaction.deferred) {
      await interaction.editReply(errorResponse);
    }
  }
}
