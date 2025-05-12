import { EmbedBuilder } from "discord.js";
import Notes from "../../../schema/notes.js";

/**
 * @type {import("../../../index.js").Mcommand}
 */
export default {
  name: "notes",
  aliases: ["note"],
  cooldown: 5,
  description: "Create and manage your personal notes",
  usage: "<add/view/list/edit/delete> [name] [content]",
  userPermissions: ["SendMessages"],
  botPermissions: ["SendMessages", "EmbedLinks"],
  category: "Misc",
  run: async ({ client, message, args, prefix }) => {
    const userId = message.author.id;
    const guildId = message.guild.id;

    // Helper function to create embeds
    const createEmbed = (title, description, color = "Green") => {
      return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setTimestamp()
        .setFooter({
          text: `Requested by ${message.author.tag}`,
          iconURL: message.author.displayAvatarURL({ dynamic: true }),
        });
    };

    // Show help if no arguments provided
    if (!args[0]) {
      const helpEmbed = createEmbed(
        "📝 Notes Command Help",
        `**Available subcommands:**\n
• \`${prefix}notes add <name> <content>\` - Create a new note
• \`${prefix}notes view <name>\` - View a specific note
• \`${prefix}notes list\` - List all your notes
• \`${prefix}notes edit <name> <content>\` - Edit an existing note
• \`${prefix}notes delete <name>\` - Delete a note`,
        "Blue",
      );
      return message.channel.send({ embeds: [helpEmbed] });
    }

    // Get the subcommand from the first argument
    const subcommand = args[0].toLowerCase();

    try {
      switch (subcommand) {
        case "add": {
          if (args.length < 3) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Missing Arguments",
                  `Please provide both a name and content for your note.\nUsage: \`${prefix}notes add <name> <content>\``,
                  "Red",
                ),
              ],
            });
          }

          const noteName = args[1].trim();
          const noteContent = args.slice(2).join(" ").trim();

          // Check if note already exists
          const existingNote = await Notes.findOne({
            userId,
            guildId,
            noteName,
          });

          if (existingNote) {
            return message.channel.send({
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

          return message.channel.send({
            embeds: [
              createEmbed(
                "✅ Note Created",
                `Your note **${noteName}** has been created.`,
              ),
            ],
          });
        }

        case "view": {
          if (!args[1]) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Missing Arguments",
                  `Please provide the name of the note to view.\nUsage: \`${prefix}notes view <name>\``,
                  "Red",
                ),
              ],
            });
          }

          const noteName = args[1].trim();
          const note = await Notes.findOne({ userId, guildId, noteName });

          if (!note) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Note Not Found",
                  "You don't have a note with that name.",
                  "Red",
                ),
              ],
            });
          }

          return message.channel.send({
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
            return message.channel.send({
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

          return message.channel.send({
            embeds: [
              createEmbed(
                `📒 Your Notes (${notes.length})`,
                `Here are all your saved notes:\n\n${notesList}`,
              ),
            ],
          });
        }

        case "edit": {
          if (args.length < 3) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Missing Arguments",
                  `Please provide both a name and new content.\nUsage: \`${prefix}notes edit <name> <new content>\``,
                  "Red",
                ),
              ],
            });
          }

          const noteName = args[1].trim();
          const newContent = args.slice(2).join(" ").trim();

          const note = await Notes.findOneAndUpdate(
            { userId, guildId, noteName },
            { noteContent: newContent, lastUpdated: Date.now() },
            { new: true },
          );

          if (!note) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Note Not Found",
                  "You don't have a note with that name.",
                  "Red",
                ),
              ],
            });
          }

          return message.channel.send({
            embeds: [
              createEmbed(
                "✏️ Note Updated",
                `Your note **${noteName}** has been updated.`,
              ),
            ],
          });
        }

        case "delete": {
          if (!args[1]) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Missing Arguments",
                  `Please provide the name of the note to delete.\nUsage: \`${prefix}notes delete <name>\``,
                  "Red",
                ),
              ],
            });
          }

          const noteName = args[1].trim();
          const result = await Notes.findOneAndDelete({
            userId,
            guildId,
            noteName,
          });

          if (!result) {
            return message.channel.send({
              embeds: [
                createEmbed(
                  "❌ Note Not Found",
                  "You don't have a note with that name.",
                  "Red",
                ),
              ],
            });
          }

          return message.channel.send({
            embeds: [
              createEmbed(
                "🗑️ Note Deleted",
                `Your note **${noteName}** has been deleted.`,
              ),
            ],
          });
        }

        default: {
          return message.channel.send({
            embeds: [
              createEmbed(
                "❓ Unknown Subcommand",
                `Unknown subcommand: \`${subcommand}\`.\nUse \`${prefix}notes\` to see available subcommands.`,
                "Red",
              ),
            ],
          });
        }
      }
    } catch (error) {
      console.error("Error in notes command:", error);
      return message.channel.send({
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
