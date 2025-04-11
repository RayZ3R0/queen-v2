import { SlashCommandBuilder } from "discord.js";
import spiritSchema from "../../../schema/spirits.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "sharden",
  category: "Spirits",
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName("sharden")
    .setDescription("Convert a spirit to shards")
    .addStringOption((option) =>
      option
        .setName("spiritid")
        .setDescription("The ID of the spirit to convert into shards")
        .setRequired(true)
    ),

  run: async ({ client, interaction }) => {
    try {
      await interaction.deferReply();

      const spiritId = interaction.options.getString("spiritid");
      const spirit = await spiritSchema.findOne({ id: spiritId });

      if (!spirit) {
        return interaction.editReply({ content: "Invalid spirit ID." });
      }

      if (spirit.husband !== interaction.user.id) {
        return interaction.editReply({
          content:
            "You cannot sharden a spirit who is married to another person. Don't be a thief bitch.",
        });
      }

      // Delete the spirit record after shardening
      await spiritSchema.deleteOne({ id: spiritId });

      const profile = await profileSchema.findOne({ userid: spirit.husband });
      if (!profile) {
        return interaction.editReply({
          content: "Error: Your profile could not be found.",
        });
      }

      const items = profile.items;
      const existingItem = items.find(
        (item) => item.name === `${spirit.name} Shards`
      );

      if (existingItem) {
        // Remove the old item and push the updated one
        items.splice(items.indexOf(existingItem), 1);
        items.push({
          name: `${spirit.name} Shards`,
          count: existingItem.count + spirit.stars,
        });
      } else {
        items.push({
          name: `${spirit.name} Shards`,
          count: spirit.stars,
        });
      }

      await profileSchema.findOneAndUpdate(
        { userid: spirit.husband },
        { items }
      );

      return interaction.editReply({
        content: `Successfully shardened **${
          spirit.name
        }**【${"<a:starSpin:1006138461234937887>".repeat(
          spirit.stars
        )}】 to \`${spirit.stars}\` **${spirit.name} Shards**`,
      });
    } catch (error) {
      console.error("Sharden command error:", error);
      await interaction.editReply({
        content: "An error occurred while shardening the spirit.",
      });
      return false;
    }
  },
};
