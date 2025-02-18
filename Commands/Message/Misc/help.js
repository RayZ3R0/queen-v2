import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} from "discord.js";

/**
 * @type {import("../../../index.js").Mcommand}
 */
export default {
  name: "help",
  aliases: ["h"],
  cooldown: 3,
  description:
    "Shows all available bot commands. Use `help` followed by a command name to get additional information and usage details.",
  userPermissions: [],
  botPermissions: [],
  category: "Misc",
  run: async ({ client, message, args, prefix }) => {
    // Use the bot’s configured prefix; fallback to provided.
    const cmdPrefix = client.config.prefix || prefix;
    // In v14, use message.guild.members.me instead of message.guild.me.
    const roleColor =
      message.guild.members.me.displayHexColor === "#000000"
        ? "#ffffff"
        : message.guild.members.me.displayHexColor;

    // If no argument is provided, show the interactive help menu.
    if (!args[0]) {
      // Group commands by their category.
      const categories = {};
      // Use client.mcommands (message commands collection)
      client.mcommands.forEach((cmd) => {
        const category = cmd.category || "Uncategorized";
        if (!categories[category]) categories[category] = [];
        categories[category].push({
          name: cmd.name,
          description: cmd.description || "No description provided.",
        });
      });

      // Build select menu options from category names.
      const options = Object.entries(categories).map(([cat]) => ({
        label: cat,
        value: cat.toLowerCase(),
        description: `Show commands from ${cat}.`,
      }));

      // Create the initial embed.
      const helpEmbed = new EmbedBuilder()
        .setTitle("Help Menu")
        .setDescription(
          `Select a category below to view its commands.\nFor detailed info on a command, use \`${cmdPrefix}help <command>\`.`
        )
        .setColor(roleColor);

      // Build the select menu component.
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("help-menu")
        .setPlaceholder("Select a category")
        .addOptions(options);
      const row = new ActionRowBuilder().addComponents(selectMenu);

      const initialMessage = await message.channel.send({
        embeds: [helpEmbed],
        components: [row],
      });

      // Create a collector for menu interactions.
      const collector = message.channel.createMessageComponentCollector({
        filter: (interaction) => interaction.user.id === message.author.id,
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      collector.on("collect", async (interaction) => {
        const selectedCategory = interaction.values[0];
        // Find the proper category key (case-insensitive).
        const categoryKey = Object.keys(categories).find(
          (cat) => cat.toLowerCase() === selectedCategory
        );
        const commands = categories[categoryKey];
        const categoryEmbed = new EmbedBuilder()
          .setTitle(`${categoryKey} Commands`)
          .setDescription(
            commands.map((c) => `**${c.name}**: ${c.description}`).join("\n")
          )
          .setColor(roleColor)
          .setTimestamp();
        await interaction.update({ embeds: [categoryEmbed] });
      });

      collector.on("end", () => {
        initialMessage.edit({ components: [] });
      });
      return;
    } else {
      // Detailed help for a specific command based on the provided argument.
      const search = args[0].toLowerCase();
      const command =
        client.mcommands.get(search) ||
        client.mcommands.find(
          (cmd) =>
            cmd.aliases &&
            cmd.aliases.map((a) => a.toLowerCase()).includes(search)
        );
      if (!command) {
        const errorEmbed = new EmbedBuilder()
          .setTitle("Invalid command")
          .setDescription(
            `No command found for \`${args[0]}\`. Use \`${cmdPrefix}help\` to view all available commands.`
          )
          .setColor("Red")
          .setTimestamp();
        return message.channel.send({ embeds: [errorEmbed] });
      }
      const detailEmbed = new EmbedBuilder()
        .setTitle(`Command: ${command.name}`)
        .setColor(roleColor)
        .addFields(
          {
            name: "Description",
            value: command.description || "No description provided.",
            inline: false,
          },
          {
            name: "Usage",
            value: command.usage
              ? `\`${cmdPrefix}${command.name} ${command.usage}\``
              : `\`${cmdPrefix}${command.name}\``,
            inline: false,
          },
          {
            name: "Aliases",
            value: command.aliases ? command.aliases.join(", ") : "None",
            inline: false,
          },
          {
            name: "Cooldown",
            value: command.timeout ? `${command.timeout}s` : "None",
            inline: false,
          },
          {
            name: "Category",
            value: command.category || "Uncategorized",
            inline: false,
          }
        )
        .setFooter({
          text: `Requested by ${message.author.tag}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true }),
        })
        .setTimestamp();
      return message.channel.send({ embeds: [detailEmbed] });
    }
  },
};
