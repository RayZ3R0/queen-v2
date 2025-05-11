import {
  SlashCommandBuilder,
  EmbedBuilder,
  ApplicationCommandOptionType,
} from "discord.js";
import Notes from "../../../schema/notes.js";

export default {
  name: "notes",
  data: new SlashCommandBuilder()
    .setName("notes")
    .setDescription("Create and manage your notes")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Add a new note")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of your note")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("content")
            .setDescription("The content of your note")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View one of your notes")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the note to view")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("list").setDescription("List all of your notes"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("edit")
        .setDescription("Edit one of your notes")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the note to edit")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("content")
            .setDescription("The new content for your note")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Delete one of your notes")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("The name of the note to delete")
            .setRequired(true),
        ),
    ),
  memberPermissions: ["SendMessages"],
  botPermissions: ["SendMessages", "EmbedLinks"],
  category: "Misc",
  cooldown: 5,

  run: async ({ client, interaction }) => {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    // Helper function to create embeds
    const createEmbed = (title, description, color = "Green") => {
      return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: `Requested by ${interaction.user.tag}` });
    };

    try {
      switch (subcommand) {
        case "add": {
          const noteName = interaction.options.getString("name").trim();
          const noteContent = interaction.options.getString("content").trim();

          // Check if note already exists
          const existingNote = await Notes.findOne({
            userId,
            guildId,
            noteName,
          });
          if (existingNote) {
            return interaction.reply({
              embeds: [
                createEmbed(
                  "❌ Error",
                  "You already have a note with this name.",
                  "Red",
                ),
              ],
            });
          }

          // Create new note
          await Notes.create({
            userId,
            guildId,
            noteName,
            noteContent,
          });

          return interaction.reply({
            embeds: [
              createEmbed(
                "✅ Note Created",
                `Your note **${noteName}** has been created.`,
              ),
            ],
          });
        }

        case "view": {
          const noteName = interaction.options.getString("name");
          const note = await Notes.findOne({ userId, guildId, noteName });

          if (!note) {
            return interaction.reply({
              embeds: [
                createEmbed(
                  "❌ Note Not Found",
                  "You don't have a note with that name.",
                  "Red",
                ),
              ],
            });
          }

          return interaction.reply({
            embeds: [
              createEmbed(
                `📝 Note: ${note.noteName}`,
                note.noteContent,
                "Blue",
              ),
            ],
          });
        }

        case "list": {
          const notes = await Notes.find({ userId, guildId })
            .select("noteName")
            .sort("noteName");

          if (!notes.length) {
            return interaction.reply({
              embeds: [
                createEmbed(
                  "📒 Your Notes",
                  "You don't have any notes yet.",
                  "Orange",
                ),
              ],
            });
          }

          const notesList = notes
            .map((note, index) => `**${index + 1}.** ${note.noteName}`)
            .join("\n");

          return interaction.reply({
            embeds: [
              createEmbed(
                `📒 Your Notes (${notes.length})`,
                `Here are all your saved notes:\n\n${notesList}`,
              ),
            ],
          });
        }

        case "edit": {
          const noteName = interaction.options.getString("name");
          const newContent = interaction.options.getString("content").trim();

          const note = await Notes.findOneAndUpdate(
            { userId, guildId, noteName },
            { noteContent: newContent, lastUpdated: Date.now() },
            { new: true },
          );

          if (!note) {
            return interaction.reply({
              embeds: [
                createEmbed(
                  "❌ Note Not Found",
                  "You don't have a note with that name.",
                  "Red",
                ),
              ],
            });
          }

          return interaction.reply({
            embeds: [
              createEmbed(
                "✏️ Note Updated",
                `Your note **${noteName}** has been updated.`,
              ),
            ],
          });
        }

        case "delete": {
          const noteName = interaction.options.getString("name");
          const result = await Notes.findOneAndDelete({
            userId,
            guildId,
            noteName,
          });

          if (!result) {
            return interaction.reply({
              embeds: [
                createEmbed(
                  "❌ Note Not Found",
                  "You don't have a note with that name.",
                  "Red",
                ),
              ],
            });
          }

          return interaction.reply({
            embeds: [
              createEmbed(
                "🗑️ Note Deleted",
                `Your note **${noteName}** has been deleted.`,
              ),
            ],
          });
        }
      }
    } catch (error) {
      console.error("Error in notes command:", error);
      return interaction.reply({
        embeds: [
          createEmbed(
            "⚠️ Error",
            "An error occurred while processing your request.",
            "Red",
          ),
        ],
      });
    }
  },
};
