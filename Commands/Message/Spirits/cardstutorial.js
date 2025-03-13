import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import {
  TUTORIAL_CHAPTERS,
  createTutorialEmbed,
  getPracticeHand,
  getRecommendedPlay,
} from "../../../utils/cardsTutorialUtils.js";

export default {
  name: "cardstutorial",
  aliases: ["cardtutorial", "ctutorial"],
  description: "Learn how to play the Devious Dealer card game",
  usage: "",
  cooldown: 5,
  category: "Spirits",
  userPermissions: [],
  botPermissions: [],
  gambling: false,

  run: async ({ client, message, args }) => {
    try {
      let currentChapter = "INTRODUCTION";
      let currentPage = 0;
      let practiceMode = false;

      const createButtons = () => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prev_page")
            .setLabel("⬅️ Previous")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId("next_page")
            .setLabel("Next ➡️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(
              currentPage ===
                TUTORIAL_CHAPTERS[currentChapter].content.length - 1
            ),
          new ButtonBuilder()
            .setCustomId("practice")
            .setLabel("Practice Hand")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("chapters")
            .setLabel("Chapters")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("end_tutorial")
            .setLabel("Exit")
            .setStyle(ButtonStyle.Danger)
        );
      };

      // Send initial tutorial embed
      const tutorialMessage = await message.channel.send({
        embeds: [createTutorialEmbed(currentChapter, currentPage)],
        components: [createButtons()],
      });

      const collector = tutorialMessage.createMessageComponentCollector({
        filter: (i) => i.user.id === message.author.id,
        time: 600000, // 10 minutes
      });

      collector.on("collect", async (i) => {
        try {
          await i.deferUpdate();

          if (i.customId === "chapters") {
            const chapterList = Object.entries(TUTORIAL_CHAPTERS)
              .map(
                ([key, chapter]) =>
                  `**${chapter.id}.** ${chapter.title}\n${chapter.description}`
              )
              .join("\n\n");

            const numberEmojis = [
              "1️⃣",
              "2️⃣",
              "3️⃣",
              "4️⃣",
              "5️⃣",
              "6️⃣",
              "7️⃣",
              "8️⃣",
              "9️⃣",
              "🔟",
            ];
            const chapterKeys = Object.keys(TUTORIAL_CHAPTERS);

            const chaptersEmbed = new EmbedBuilder()
              .setColor("#663399")
              .setTitle("Tutorial Chapters")
              .setDescription(
                chapterList + "\n\nReact with the number to go to that chapter!"
              );

            const chaptersMsg = await message.channel.send({
              embeds: [chaptersEmbed],
            });

            // Add number reactions
            for (let i = 0; i < chapterKeys.length && i < 10; i++) {
              await chaptersMsg.react(numberEmojis[i]);
            }

            const chapterFilter = (reaction, user) =>
              numberEmojis.includes(reaction.emoji.name) &&
              user.id === message.author.id;

            const chapterCollector = chaptersMsg.createReactionCollector({
              filter: chapterFilter,
              time: 30000,
              max: 1,
            });

            chapterCollector.on("collect", async (reaction) => {
              const index = numberEmojis.indexOf(reaction.emoji.name);
              if (index >= 0 && index < chapterKeys.length) {
                currentChapter = chapterKeys[index];
                currentPage = 0;
                await tutorialMessage.edit({
                  embeds: [createTutorialEmbed(currentChapter, currentPage)],
                  components: [createButtons()],
                });
              }
              await chaptersMsg.delete();
            });

            chapterCollector.on("end", async (collected, reason) => {
              if (reason !== "messageDelete") {
                await chaptersMsg.delete().catch(() => {});
              }
            });
          } else if (i.customId === "prev_page" && currentPage > 0) {
            currentPage--;
            practiceMode = false;
          } else if (
            i.customId === "next_page" &&
            currentPage < TUTORIAL_CHAPTERS[currentChapter].content.length - 1
          ) {
            currentPage++;
            practiceMode = false;
          } else if (i.customId === "practice") {
            practiceMode = true;
            const practice = getPracticeHand();
            const recommendedPlay = getRecommendedPlay(
              practice.player,
              practice.dealer[0]
            );

            const practiceEmbed = new EmbedBuilder()
              .setColor("#663399")
              .setTitle("Practice Hand")
              .setDescription(
                "Let's practice with a real scenario!\n\n" +
                  `Your Hand: \`${practice.player.join("  ")}\`\n` +
                  `Dealer Shows: \`${practice.dealer[0]}\`\n\n` +
                  "What would you do in this situation?\n\n" +
                  `||Recommended Play: ${recommendedPlay}||`
              )
              .setFooter({
                text: "Tip: Click the spoiler to see the recommended play",
              });

            const practiceRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("new_practice")
                .setLabel("Try Another Hand")
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId("back_to_tutorial")
                .setLabel("Back to Tutorial")
                .setStyle(ButtonStyle.Secondary)
            );

            await tutorialMessage.edit({
              embeds: [practiceEmbed],
              components: [practiceRow],
            });
            return;
          } else if (i.customId === "new_practice") {
            const practice = getPracticeHand();
            const recommendedPlay = getRecommendedPlay(
              practice.player,
              practice.dealer[0]
            );

            const practiceEmbed = new EmbedBuilder()
              .setColor("#663399")
              .setTitle("Practice Hand")
              .setDescription(
                "Here's a new scenario to consider!\n\n" +
                  `Your Hand: \`${practice.player.join("  ")}\`\n` +
                  `Dealer Shows: \`${practice.dealer[0]}\`\n\n` +
                  "What would you do in this situation?\n\n" +
                  `||Recommended Play: ${recommendedPlay}||`
              )
              .setFooter({
                text: "Tip: Click the spoiler to see the recommended play",
              });

            const practiceRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId("new_practice")
                .setLabel("Try Another Hand")
                .setStyle(ButtonStyle.Primary),
              new ButtonBuilder()
                .setCustomId("back_to_tutorial")
                .setLabel("Back to Tutorial")
                .setStyle(ButtonStyle.Secondary)
            );

            await tutorialMessage.edit({
              embeds: [practiceEmbed],
              components: [practiceRow],
            });
          } else if (i.customId === "back_to_tutorial") {
            practiceMode = false;
            await tutorialMessage.edit({
              embeds: [createTutorialEmbed(currentChapter, currentPage)],
              components: [createButtons()],
            });
          } else if (i.customId === "end_tutorial") {
            const endEmbed = new EmbedBuilder()
              .setColor("#663399")
              .setTitle("Tutorial Ended")
              .setDescription(
                "Tutorial complete! Ready to try your luck against the Devious Dealer?\n\n" +
                  "Use `/cards` to start a game, and remember what you've learned!\n" +
                  "You can always return to this tutorial with `/cardstutorial`."
              );

            await tutorialMessage.edit({
              embeds: [endEmbed],
              components: [],
            });
            collector.stop();
            return;
          }

          if (!practiceMode) {
            await tutorialMessage.edit({
              embeds: [createTutorialEmbed(currentChapter, currentPage)],
              components: [createButtons()],
            });
          }
        } catch (error) {
          console.error("Tutorial interaction error:", error);
          await message.channel.send({
            content: "An error occurred. Please try again.",
          });
        }
      });

      collector.on("end", async (collected, reason) => {
        if (reason === "time") {
          const timeoutEmbed = new EmbedBuilder()
            .setColor("#663399")
            .setTitle("Tutorial Timed Out")
            .setDescription(
              "The tutorial has ended due to inactivity.\n" +
                "Feel free to start it again with `/cardstutorial`!"
            );

          await tutorialMessage.edit({
            embeds: [timeoutEmbed],
            components: [],
          });
        }
      });

      return true;
    } catch (error) {
      console.error("Cards tutorial error:", error);
      await message.reply({
        content: "An error occurred while showing the tutorial.",
      });
      return false;
    }
  },
};
