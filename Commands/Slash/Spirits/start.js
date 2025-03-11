import { SlashCommandBuilder } from "discord.js";
import profileSchema from "../../../schema/profile.js";

export default {
  name: "start",
  data: new SlashCommandBuilder()
    .setName("start")
    .setDescription("Start your spirit journey and receive 5000 Spirit Coins"),

  category: "Spirits",

  run: async ({ client, interaction }) => {
    try {
      await interaction.deferReply();

      const profileData = await profileSchema.findOne({
        userid: interaction.user.id,
      });

      if (profileData && profileData.started) {
        return interaction.editReply({
          content: "You have already started the game. You cannot do it again.",
        });
      }

      if (profileData) {
        await profileSchema.findOneAndUpdate(
          { userid: interaction.user.id },
          { balance: profileData.balance + 5000, started: true },
          { new: true }
        );
      } else {
        const newProfile = new profileSchema({
          userid: interaction.user.id,
          selected: "None",
          image: "https://c.tenor.com/E6P9PZdh7W0AAAAC/date-a-live-kurumi.gif",
          color: "#ff0000",
          bio: "None",
          level: 0,
          xp: 0,
          energy: 60,
          balance: 5000,
          items: [],
          started: true,
        });
        await newProfile.save();
      }

      return interaction.editReply({
        content:
          "You have successfully started the game! You have received `5000` Spirit Coins as a reward. Use `/summon` command to summon a spirit.",
      });
    } catch (error) {
      console.error("Start command error:", error);
      return interaction.editReply({
        content: "An error occurred. Please try again later.",
      });
    }
  },
};
