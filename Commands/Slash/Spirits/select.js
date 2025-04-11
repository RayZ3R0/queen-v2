import { SlashCommandBuilder } from "discord.js";
import spiritSchema from "../../../schema/spirits.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "select",
  category: "Spirits",
  cooldown: 10,
  data: new SlashCommandBuilder()
    .setName("select")
    .setDescription("Select a Spirit for battle and dating")
    .addStringOption((option) =>
      option
        .setName("spiritid")
        .setDescription("The ID of the spirit to select")
        .setRequired(true)
    ),

  run: async ({ client, interaction }) => {
    try {
      await interaction.deferReply();

      const spiritID = interaction.options.getString("spiritid");

      // Find the spirit in our database
      const spiritEntity = await spiritSchema.findOne({ id: spiritID });

      if (!spiritEntity) {
        return interaction.editReply({
          content:
            "Invalid ID. Provide a valid ID or die. Use the `/harem` command to check your spirits and find their ID.",
        });
      }

      if (spiritEntity.husband !== interaction.user.id) {
        return interaction.editReply({
          content:
            "You cannot select a spirit who is married to another person. Don't be a thief bitch.",
        });
      }

      // Find or create the user profile and update the selected spirit
      let userProfile = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      if (userProfile) {
        userProfile.selected = spiritID;
        await userProfile.save();
      } else {
        userProfile = new profileSchema({
          userid: interaction.user.id,
          selected: spiritID,
          image: "https://c.tenor.com/E6P9PZdh7W0AAAAC/date-a-live-kurumi.gif",
          color: "#ff0000",
          bio: "None",
          level: 0,
          xp: 0,
          energy: 60,
          balance: 0,
          items: [],
          started: false,
        });
        await userProfile.save();
      }

      return interaction.editReply({
        content: `Successfully selected **${
          spiritEntity.name
        }**【${"<a:starSpin:1006138461234937887>".repeat(
          spiritEntity.stars
        )}】`,
      });
    } catch (error) {
      console.error("Select command error:", error);
      await interaction.editReply({
        content: "An error occurred while selecting the spirit.",
      });
      return false;
    }
  },
};
