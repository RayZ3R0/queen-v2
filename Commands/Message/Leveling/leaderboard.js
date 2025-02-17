import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ComponentType,
} from "discord.js";
import levelModel from "../../../schema/level.js";

/**
 * Retrieves leaderboard data from the level database.
 *
 * @param {import('discord.js').Client} client - The Discord client.
 * @param {string} guildID - The guild ID.
 * @returns {Promise<Array>} An array of leaderboard entries.
 */
async function getLeaderboard(client, guildID) {
  if (!guildID) throw new Error("[XP] Guild ID was not provided.");

  const guild = client.guilds.cache.get(guildID);
  if (!guild) throw new Error("[XP] Guild was not found.");

  // Retrieve level data sorted descending by XP.
  const data = await levelModel
    .find({ guild: guildID })
    .sort({ xp: -1 })
    .exec();
  const led = [];

  function shortener(count) {
    const COUNT_ABBRS = ["", "k", "M", "T"];
    const i = count === 0 ? 0 : Math.floor(Math.log(count) / Math.log(1000));
    let result = parseFloat((count / Math.pow(1000, i)).toFixed(2));
    result += COUNT_ABBRS[i];
    return result;
  }

  const promises = data.map(async (entry) => {
    const member = await guild.members.fetch(entry.user).catch(() => null);
    if (!member) {
      // If the member is not found, delete the entry from the DB.
      await levelModel.deleteOne({ user: entry.user, guild: guildID });
      return;
    }
    if (entry.xp === 0) return;
    const position = data.indexOf(entry) + 1;
    led.push({
      guildID: entry.guild,
      userID: entry.user,
      xp: entry.xp,
      shortxp: shortener(entry.xp),
      level: entry.level,
      position,
      username: member.user.username,
      tag: member.user.tag,
    });
  });

  await Promise.all(promises);
  return led;
}

export default {
  name: "leaderboard",
  aliases: ["lb"],
  description: "Display the leaderboard entries for this guild.",
  cooldown: 5,
  userPermissions: [PermissionFlagsBits.SendMessages],
  botPermissions: [
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
  ],
  category: "Leveling",

  run: async ({ client, message, args, prefix }) => {
    try {
      const lbData = await getLeaderboard(client, message.guild.id);
      if (!lbData || lbData.length === 0) {
        return message.channel.send({ content: "No leaderboard data found." });
      }

      // Sort by rank (position)
      lbData.sort((a, b) => a.position - b.position);

      // Pagination: 10 entries per page.
      const itemsPerPage = 10;
      const pages = [];
      for (let i = 0; i < lbData.length; i += itemsPerPage) {
        const current = lbData.slice(i, i + itemsPerPage);
        const description = current
          .map(
            (e) =>
              `**#${e.position}** - ${e.tag} • Level: ${e.level} • XP: ${e.shortxp}`
          )
          .join("\n");

        const embed = new EmbedBuilder()
          .setTitle(`${message.guild.name} Leaderboard`)
          .setDescription(description)
          .setColor("Random")
          .setFooter({
            text: `Page ${Math.floor(i / itemsPerPage) + 1} of ${Math.ceil(
              lbData.length / itemsPerPage
            )}`,
          })
          .setTimestamp();
        pages.push(embed);
      }

      let currentPage = 0;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev")
          .setLabel("Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId("next")
          .setLabel("Next")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pages.length <= 1)
      );

      const msg = await message.channel.send({
        embeds: [pages[currentPage]],
        components: [row],
      });

      if (pages.length <= 1) return;

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
      });

      collector.on("collect", async (interaction) => {
        // Only allow command invoker members to interact.
        if (interaction.user.id !== message.author.id) {
          return interaction.reply({
            content: "These buttons aren't for you.",
            ephemeral: true,
          });
        }
        if (interaction.customId === "prev") {
          currentPage = currentPage > 0 ? currentPage - 1 : pages.length - 1;
        } else if (interaction.customId === "next") {
          currentPage = currentPage < pages.length - 1 ? currentPage + 1 : 0;
        }

        // Update button disabled status
        row.components[0].setDisabled(currentPage === 0);
        row.components[1].setDisabled(currentPage === pages.length - 1);

        await interaction.update({
          embeds: [pages[currentPage]],
          components: [row],
        });
      });

      collector.on("end", async () => {
        row.components.forEach((btn) => btn.setDisabled(true));
        await msg.edit({ components: [row] });
      });
    } catch (error) {
      console.error("Error in leaderboard command:", error);
      return message.channel.send({
        content: "An error occurred while retrieving the leaderboard.",
      });
    }
  },
};
