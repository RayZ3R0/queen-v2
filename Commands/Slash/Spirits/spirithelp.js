import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export default {
  name: "spirithelp",
  data: new SlashCommandBuilder()
    .setName("spirithelp")
    .setDescription("Learn about spirit interactions and bonding")
    .addStringOption((option) =>
      option
        .setName("category")
        .setDescription("Choose a help category")
        .setRequired(false)
        .addChoices(
          { name: "Bonding", value: "bonding" },
          { name: "Spacequakes", value: "spacequakes" },
          { name: "Quests", value: "quests" },
          { name: "Affection", value: "affection" },
          { name: "Seasons", value: "seasons" }
        )
    ),
  category: "Spirits",
  cooldown: 5,
  run: async ({ client, interaction }) => {
    try {
      const category = interaction.options.getString("category");

      if (!category) {
        // Show main help menu
        const embed = new EmbedBuilder()
          .setTitle("Spirit Interaction Guide")
          .setDescription(
            "Welcome to the spirit interaction system! Choose a category to learn more:"
          )
          .addFields(
            {
              name: "💝 Bonding",
              value:
                "`/spirithelp bonding`\nLearn how to interact with spirits through dates, gifts, and conversations.",
            },
            {
              name: "⚡ Spacequakes",
              value:
                "`/spirithelp spacequakes`\nDiscover how to explore spacequakes and find new spirits.",
            },
            {
              name: "📜 Quests",
              value:
                "`/spirithelp quests`\nComplete daily quests to earn rewards and increase affection.",
            },
            {
              name: "❤️ Affection",
              value:
                "`/spirithelp affection`\nUnderstand how the affection system works and its benefits.",
            },
            {
              name: "🌟 Seasons",
              value:
                "`/spirithelp seasons`\nLearn about season pass rewards and progression.",
            }
          )
          .setColor("#ff69b4")
          .setFooter({
            text: "Use /start to begin your spirit journey!",
          });

        return interaction.reply({ embeds: [embed] });
      }

      // Show category-specific help
      const helpEmbed = new EmbedBuilder().setColor("#ff69b4");

      switch (category) {
        case "bonding": {
          helpEmbed
            .setTitle("Spirit Bonding Guide")
            .setDescription(
              "Build relationships with spirits through various interactions!"
            )
            .addFields(
              {
                name: "🎯 Daily Interactions",
                value:
                  "• `/bond date` - Take your spirit on a date\n" +
                  "• `/bond chat` - Have a conversation\n" +
                  "• `/bond gift` - Give a special gift",
              },
              {
                name: "📈 Progress Tracking",
                value:
                  "• `/emotion` - Check your spirit's feelings\n" +
                  "• `/profile` - View your bonding progress\n" +
                  "• `/affinitylb` - Compare affection levels",
              },
              {
                name: "💡 Tips",
                value:
                  "• Each spirit has favorite locations and gifts\n" +
                  "• Maintain a daily streak for bonus rewards\n" +
                  "• Higher affection unlocks special perks",
              }
            );
          break;
        }

        case "spacequakes": {
          helpEmbed
            .setTitle("Spacequake System Guide")
            .setDescription("Explore spacequakes to find and rescue spirits!")
            .addFields(
              {
                name: "🌀 Spacequake Basics",
                value:
                  "• `/spacequake explore` - Search spacequake zones\n" +
                  "• `/spacequake status` - Check active zones\n" +
                  "• `/spacequake party` - Join exploration parties",
              },
              {
                name: "⚔️ Combat",
                value:
                  "• Battle AST forces to protect spirits\n" +
                  "• Team up with other players\n" +
                  "• Use spirit powers strategically",
              },
              {
                name: "🎁 Rewards",
                value:
                  "• Find new spirits to bond with\n" +
                  "• Earn season pass progress\n" +
                  "• Collect rare items and currency",
              }
            );
          break;
        }

        case "quests": {
          helpEmbed
            .setTitle("Daily Quest Guide")
            .setDescription("Complete quests to earn rewards and progress!")
            .addFields(
              {
                name: "📝 Quest Types",
                value:
                  "• Bonding Quests - Interact with spirits\n" +
                  "• Exploration Quests - Search spacequakes\n" +
                  "• Combat Quests - Protect spirits from AST",
              },
              {
                name: "🏆 Rewards",
                value:
                  "• Spirit Coins for shops\n" +
                  "• Increased affection\n" +
                  "• Season pass experience",
              },
              {
                name: "⭐ Streaks",
                value:
                  "• Complete all daily quests\n" +
                  "• Maintain streaks for bonus rewards\n" +
                  "• Track progress with `/quests`",
              }
            );
          break;
        }

        case "affection": {
          helpEmbed
            .setTitle("Affection System Guide")
            .setDescription("Build stronger bonds with your spirits!")
            .addFields(
              {
                name: "💕 Affection Levels",
                value:
                  "• Suspicious (0-99)\n" +
                  "• Cautious (100-249)\n" +
                  "• Friendly (250-499)\n" +
                  "• Trusting (500-999)\n" +
                  "• Affectionate (1000+)",
              },
              {
                name: "✨ Benefits",
                value:
                  "• Increased rewards from activities\n" +
                  "• Special dialogue options\n" +
                  "• Unique spirit powers\n" +
                  "• Exclusive cosmetic items",
              },
              {
                name: "📊 Progress",
                value:
                  "• Daily interactions increase affection\n" +
                  "• Perfect gifts give bonus points\n" +
                  "• Track progress with `/emotion`",
              }
            );
          break;
        }

        case "seasons": {
          helpEmbed
            .setTitle("Season Pass Guide")
            .setDescription(
              "Progress through seasonal content and earn rewards!"
            )
            .addFields(
              {
                name: "🎯 Earning Experience",
                value:
                  "• Complete daily quests\n" +
                  "• Explore spacequakes\n" +
                  "• Bond with spirits",
              },
              {
                name: "🎁 Rewards",
                value:
                  "• Exclusive spirit cosmetics\n" +
                  "• Special titles and badges\n" +
                  "• Bonus affection items\n" +
                  "• Premium currency",
              },
              {
                name: "📈 Progress",
                value:
                  "• 100 levels per season\n" +
                  "• Free and premium tracks\n" +
                  "• Season-exclusive items",
              }
            );
          break;
        }
      }

      helpEmbed.setFooter({
        text: "Use /help for general bot commands",
      });

      return interaction.reply({ embeds: [helpEmbed] });
    } catch (error) {
      console.error("Error in spirithelp command:", error);
      return interaction.reply({
        content: "An error occurred while showing the help menu.",
        ephemeral: true,
      });
    }
  },
};
