import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
} from "discord.js";
import {
  TUTORIAL_CHAPTERS,
  createTutorialEmbed,
  getPracticeHand,
  getRecommendedPlay,
} from "../../../utils/cardsTutorialUtils.js";

export default {
  data: new SlashCommandBuilder()
    .setName("cardstutorial")
    .setDescription("Learn how to play the Devious Dealer card game"),
  category: "Spirits",

  run: async ({ client, interaction, isDeferred = false }) => {
    if (!isDeferred) {
      await interaction.deferReply();
    }

    let currentChapter = "INTRODUCTION";
    let currentPage = 0;
    let practiceMode = false;

    const createNavigationRow = () => {
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
            currentPage === TUTORIAL_CHAPTERS[currentChapter].content.length - 1
          ),
        new ButtonBuilder()
          .setCustomId("practice")
          .setLabel("Practice Hand")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("end_tutorial")
          .setLabel("Exit")
          .setStyle(ButtonStyle.Danger)
      );
    };

    const createChapterSelect = () => {
      return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("chapter_select")
          .setPlaceholder("Select a Chapter")
          .addOptions(
            Object.entries(TUTORIAL_CHAPTERS).map(([key, chapter]) => ({
              label: chapter.title,
              description: `Chapter: ${chapter.id}`,
              value: key,
            }))
          )
      );
    };

    // Send initial tutorial embed
    const tutorialMessage = await interaction.editReply({
      embeds: [createTutorialEmbed(currentChapter, currentPage)],
      components: [createChapterSelect(), createNavigationRow()],
    });

    const collector = tutorialMessage.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 600000, // 10 minutes
    });

    collector.on("collect", async (i) => {
      try {
        await i.deferUpdate();

        if (i.customId === "chapter_select") {
          currentChapter = i.values[0];
          currentPage = 0;
          practiceMode = false;
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

          await i.editReply({
            embeds: [practiceEmbed],
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("new_practice")
                  .setLabel("Try Another Hand")
                  .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                  .setCustomId("back_to_tutorial")
                  .setLabel("Back to Tutorial")
                  .setStyle(ButtonStyle.Secondary)
              ),
            ],
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

          await i.editReply({
            embeds: [practiceEmbed],
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("new_practice")
                  .setLabel("Try Another Hand")
                  .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                  .setCustomId("back_to_tutorial")
                  .setLabel("Back to Tutorial")
                  .setStyle(ButtonStyle.Secondary)
              ),
            ],
          });
        } else if (i.customId === "back_to_tutorial") {
          practiceMode = false;
          await i.editReply({
            embeds: [createTutorialEmbed(currentChapter, currentPage)],
            components: [createChapterSelect(), createNavigationRow()],
          });
        } else if (i.customId === "end_tutorial") {
          const endEmbed = new EmbedBuilder()
            .setColor("#663399")
            .setTitle("Tutorial Ended")
            .setDescription(
              "Tutorial complete! Ready to try your luck against the Devious Dealer?\n\n" +
                "Use `/deviouscards` to start a game, and remember what you've learned!\n" +
                "You can always return to this tutorial with `/cardstutorial`."
            );

          await i.editReply({
            embeds: [endEmbed],
            components: [],
          });
          collector.stop();
          return;
        }

        if (!practiceMode) {
          await i.editReply({
            embeds: [createTutorialEmbed(currentChapter, currentPage)],
            components: [createChapterSelect(), createNavigationRow()],
          });
        }
      } catch (error) {
        console.error("Tutorial interaction error:", error);
        await interaction.followUp({
          content: "An error occurred. Please try again.",
          flags: MessageFlags.Ephemeral,
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

        await interaction.editReply({
          embeds: [timeoutEmbed],
          components: [],
        });
      }
    });
  },
};
