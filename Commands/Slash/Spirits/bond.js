import { SlashCommandBuilder } from "discord.js";
import { createAffectionEmbed } from "../../../utils/spirits/emotionSystem.js";
import profileSchema from "../../../schema/profile.js";
import { emitSpiritAction } from "../../../events/questProgress.js";
import { BOND_ACTIVITIES } from "../../../utils/spirits/emotionSystem.js";

export default {
  name: "bond",
  data: new SlashCommandBuilder()
    .setName("bond")
    .setDescription("Interact with your selected spirit")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("date")
        .setDescription("Take your spirit on a date")
        .addStringOption((option) =>
          option
            .setName("location")
            .setDescription("Choose a date location")
            .setRequired(true)
            .addChoices(
              ...BOND_ACTIVITIES.date.locations.map((loc) => ({
                name: loc.name,
                value: loc.name,
              }))
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("chat")
        .setDescription("Have a conversation with your spirit")
        .addStringOption((option) =>
          option
            .setName("topic")
            .setDescription("Choose a conversation topic")
            .setRequired(true)
            .addChoices(
              ...BOND_ACTIVITIES.chat.topics.map((topic) => ({
                name: topic.name,
                value: topic.name,
              }))
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("gift")
        .setDescription("Give a gift to your spirit")
        .addStringOption((option) =>
          option
            .setName("item")
            .setDescription("Choose a gift")
            .setRequired(true)
            .addChoices(
              ...BOND_ACTIVITIES.gift.items.map((item) => ({
                name: `${item.name} (${item.cost} coins)`,
                value: item.name,
              }))
            )
        )
    ),
  category: "Spirits",
  run: async ({ client, interaction }) => {
    try {
      const userProfile = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      if (!userProfile?.selected || userProfile.selected === "None") {
        return interaction.reply({
          content: "You need to select a spirit first using `/select`!",
          ephemeral: true,
        });
      }

      const subcommand = interaction.options.getSubcommand();
      const activity = BOND_ACTIVITIES[subcommand];
      const spirit = userProfile.selected;

      // Check cooldowns (use profile method)
      if (
        !userProfile.canInteract(spirit, subcommand, activity.cooldown / 3600)
      ) {
        return interaction.reply({
          content: `You must wait before ${subcommand}ing with ${spirit} again!`,
          ephemeral: true,
        });
      }

      switch (subcommand) {
        case "date": {
          const location = interaction.options.getString("location");
          const locationData = activity.locations.find(
            (loc) => loc.name === location
          );

          if (!locationData) {
            return interaction.reply({
              content: "Invalid location selected!",
              ephemeral: true,
            });
          }

          // Calculate affinity gain with location bonus
          const affinityGain = Math.floor(
            activity.affinity *
              (locationData.spirits.includes(spirit) ? locationData.bonus : 1)
          );

          // Record interaction and update profile
          await userProfile.recordInteraction(spirit, "date");
          await userProfile.updateAffinity(spirit, affinityGain);

          // Emit spirit action for quest tracking
          emitSpiritAction(client, interaction.user.id, "DATE", {
            location,
            affinity: affinityGain,
            spirit,
          });

          const embed = createAffectionEmbed(spirit, userProfile.affinity);
          embed.setDescription(
            `You took ${spirit} to ${location}!\n\n` +
              `${locationData.description}\n\n` +
              `Gained ${affinityGain} affinity${
                locationData.spirits.includes(spirit)
                  ? " (Location Bonus!)"
                  : ""
              }`
          );

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case "chat": {
          const topic = interaction.options.getString("topic");
          const topicData = activity.topics.find((t) => t.name === topic);

          if (!topicData) {
            return interaction.reply({
              content: "Invalid topic selected!",
              ephemeral: true,
            });
          }

          // Calculate affinity gain with topic bonus
          const affinityGain = Math.floor(
            activity.affinity *
              (topicData.spirits.includes(spirit) ? topicData.bonus : 1)
          );

          // Record interaction and update profile
          await userProfile.recordInteraction(spirit, "chat");
          await userProfile.updateAffinity(spirit, affinityGain);

          // Emit spirit action for quest tracking
          emitSpiritAction(client, interaction.user.id, "CHAT", {
            topic,
            affinity: affinityGain,
            spirit,
          });

          const embed = createAffectionEmbed(spirit, userProfile.affinity);
          embed.setDescription(
            `You discussed ${topic} with ${spirit}!\n\n` +
              `${topicData.description}\n\n` +
              `Gained ${affinityGain} affinity${
                topicData.spirits.includes(spirit) ? " (Topic Bonus!)" : ""
              }`
          );

          await interaction.reply({ embeds: [embed] });
          break;
        }

        case "gift": {
          const itemName = interaction.options.getString("item");
          const item = activity.items.find((i) => i.name === itemName);

          if (!item) {
            return interaction.reply({
              content: "Invalid gift selected!",
              ephemeral: true,
            });
          }

          // Check if user can afford the gift
          if (userProfile.balance < item.cost) {
            return interaction.reply({
              content: "You don't have enough Spirit Coins for this gift!",
              ephemeral: true,
            });
          }

          // Calculate affinity gain with gift bonus
          const affinityGain = Math.floor(
            activity.affinity * (item.spirits.includes(spirit) ? item.bonus : 1)
          );

          // Record interaction and update profile
          await userProfile.recordInteraction(spirit, "gift");
          await userProfile.updateAffinity(spirit, affinityGain);
          await profileSchema.findOneAndUpdate(
            { userid: interaction.user.id },
            { $inc: { balance: -item.cost } }
          );

          // Emit spirit action for quest tracking
          emitSpiritAction(client, interaction.user.id, "GIFT", {
            item: itemName,
            affinity: affinityGain,
            spirit,
            perfect: item.spirits.includes(spirit),
          });

          const embed = createAffectionEmbed(spirit, userProfile.affinity);
          embed.setDescription(
            `You gave ${item.name} to ${spirit}!\n\n` +
              `${item.description}\n\n` +
              `Spent ${item.cost} Spirit Coins\n` +
              `Gained ${affinityGain} affinity${
                item.spirits.includes(spirit) ? " (Perfect Gift!)" : ""
              }`
          );

          await interaction.reply({ embeds: [embed] });
          break;
        }
      }
    } catch (error) {
      console.error("Error in bond command:", error);
      return interaction.reply({
        content: "An error occurred while processing the command.",
        ephemeral: true,
      });
    }
  },
};
