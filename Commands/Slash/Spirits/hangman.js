import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { fetchWords, HangmanGame } from "../../../utils/hangmanUtils.js";

// Map to store active games with channel IDs as keys
const activeGames = new Map();

export default {
  name: "hangman",
  category: "Spirits",
  data: new SlashCommandBuilder()
    .setName("hangman")
    .setDescription("Play anime-themed hangman")
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Choose what to guess")
        .setRequired(true)
        .addChoices(
          { name: "Anime Title", value: "anime" },
          { name: "Character Name", value: "character" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("difficulty")
        .setDescription("Select difficulty")
        .setRequired(true)
        .addChoices(
          { name: "Easy Mode (4-8 letters)", value: "easy" },
          { name: "Hard Mode (9+ letters)", value: "hard" }
        )
    ),

  run: async ({ client, interaction }) => {
    try {
      await interaction.deferReply();

      const channelId = interaction.channelId;
      const type = interaction.options.getString("type");
      const difficulty = interaction.options.getString("difficulty");

      // Check if there's already a game in this channel
      if (activeGames.has(channelId)) {
        return interaction.editReply({
          content: "There's already an active hangman game in this channel!",
          ephemeral: true,
        });
      }

      // Start a new gambling session with 1 hour timeout
      if (!client.startGamblingSession(interaction.user.id, interaction)) {
        return interaction.editReply({
          content:
            "You already have an active game session. Please finish it first.",
          ephemeral: true,
        });
      }

      // Fetch a word from the API
      const word = await fetchWords(type, difficulty);
      const game = new HangmanGame(word);

      // Store the game in active games
      activeGames.set(channelId, {
        game,
        timeout: setTimeout(() => {
          activeGames.delete(channelId);
          client.endGamblingSession(interaction.user.id);
          interaction.channel.send({
            content: `The hangman game has timed out. The word was: **${word}**`,
          });
        }, 3600000), // 1 hour timeout
      });

      // Create initial embed
      const gameEmbed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle(
          `🎮 Anime Hangman - ${
            type === "anime" ? "Anime Title" : "Character Name"
          }`
        )
        .setDescription(
          `Difficulty: **${difficulty}**\n\n` +
            `\`\`\`\n${game.getStage()}\`\`\`\n\n` +
            `Word: **${game.getMaskedWord()}**\n` +
            `Guessed Letters: ${game.getStatus().guessedLetters || "None"}\n` +
            `Remaining Guesses: ${game.remainingGuesses}`
        )
        .setFooter({ text: "Type a letter in chat to make a guess!" });

      await interaction.editReply({ embeds: [gameEmbed] });

      // Create message collector for guesses
      const filter = (m) =>
        m.author.id === interaction.user.id &&
        /^[a-zA-Z]$/.test(m.content) &&
        activeGames.has(channelId);

      const collector = interaction.channel.createMessageCollector({
        filter,
        time: 3600000, // 1 hour
      });

      collector.on("collect", async (message) => {
        const activeGame = activeGames.get(channelId);
        if (!activeGame) return;

        const { game } = activeGame;
        const guess = message.content.toLowerCase();
        const result = game.makeGuess(guess);

        const updatedEmbed = new EmbedBuilder()
          .setColor("#0099ff")
          .setTitle(
            `🎮 Anime Hangman - ${
              type === "anime" ? "Anime Title" : "Character Name"
            }`
          )
          .setDescription(
            `Difficulty: **${difficulty}**\n\n` +
              `\`\`\`\n${game.getStage()}\`\`\`\n\n` +
              `Word: **${game.getMaskedWord()}**\n` +
              `Guessed Letters: ${game.getStatus().guessedLetters}\n` +
              `Remaining Guesses: ${game.remainingGuesses}\n\n` +
              `${result.message}`
          );

        await message.reply({ embeds: [updatedEmbed] });

        // Check win/lose conditions
        if (game.hasWon() || game.hasLost()) {
          collector.stop();
          clearTimeout(activeGame.timeout);
          activeGames.delete(channelId);
          client.endGamblingSession(interaction.user.id);

          const finalEmbed = new EmbedBuilder()
            .setColor(game.hasWon() ? "#00ff00" : "#ff0000")
            .setTitle("Game Over!")
            .setDescription(
              `${
                game.hasWon() ? "🎉 Congratulations! You won!" : "💀 Game Over!"
              }\n\n` +
                `The word was: **${game.word}**\n\n` +
                `\`\`\`\n${game.getStage()}\`\`\``
            );

          await message.reply({ embeds: [finalEmbed] });
        }
      });

      collector.on("end", (collected, reason) => {
        const activeGame = activeGames.get(channelId);
        if (activeGame) {
          clearTimeout(activeGame.timeout);
          activeGames.delete(channelId);
          client.endGamblingSession(interaction.user.id);

          if (reason === "time") {
            interaction.channel.send({
              content: `The hangman game has timed out. The word was: **${activeGame.game.word}**`,
            });
          }
        }
      });

      return true;
    } catch (error) {
      console.error("Hangman command error:", error);
      client.endGamblingSession(interaction.user.id);
      await interaction.editReply({
        content:
          "An error occurred while starting the hangman game. Please try again later.",
      });
      return false;
    }
  },
};
