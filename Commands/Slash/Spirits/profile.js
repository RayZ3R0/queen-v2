import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import profileSchema from "../../../schema/profile.js";
import spiritSchema from "../../../schema/spirits.js";

export default {
  name: "profile",
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View or edit your profile")
    .addSubcommandGroup((group) =>
      group
        .setName("set")
        .setDescription("Edit your profile settings")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("image")
            .setDescription("Set your profile image")
            .addStringOption((option) =>
              option
                .setName("url")
                .setDescription("The URL of the image")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("bio")
            .setDescription("Set your profile bio")
            .addStringOption((option) =>
              option
                .setName("text")
                .setDescription("Your new bio text")
                .setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("color")
            .setDescription("Set your profile color")
            .addStringOption((option) =>
              option
                .setName("hex")
                .setDescription("The hex color code (e.g., #ff0000)")
                .setRequired(true)
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View a user's profile")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user whose profile to view")
            .setRequired(false)
        )
    ),

  category: "Spirits",

  run: async ({ client, interaction }) => {
    try {
      await interaction.deferReply();

      const subcommandGroup = interaction.options.getSubcommandGroup();
      const subcommand = interaction.options.getSubcommand();

      if (subcommandGroup === "set") {
        let userProfile = await profileSchema.findOne({
          userid: interaction.user.id,
        });

        // Create default profile if it doesn't exist
        if (!userProfile) {
          userProfile = new profileSchema({
            userid: interaction.user.id,
            selected: "None",
            image:
              "https://c.tenor.com/E6P9PZdh7W0AAAAC/date-a-live-kurumi.gif",
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

        switch (subcommand) {
          case "image": {
            const imageUrl = interaction.options.getString("url");
            await profileSchema.findOneAndUpdate(
              { userid: interaction.user.id },
              { image: imageUrl }
            );
            return interaction.editReply({
              content: `Set ${imageUrl} as your profile image.`,
            });
          }

          case "bio": {
            const bioText = interaction.options.getString("text");
            await profileSchema.findOneAndUpdate(
              { userid: interaction.user.id },
              { bio: bioText }
            );
            return interaction.editReply({
              content: `Set \`${bioText}\` as your profile bio.`,
            });
          }

          case "color": {
            const colorHex = interaction.options.getString("hex");
            await profileSchema.findOneAndUpdate(
              { userid: interaction.user.id },
              { color: colorHex }
            );
            return interaction.editReply({
              content: `Set \`${colorHex}\` as your profile color.`,
            });
          }
        }
      } else if (subcommand === "view") {
        // View profile
        const targetUser =
          interaction.options.getUser("user") || interaction.user;
        let userProfile = await profileSchema.findOne({
          userid: targetUser.id,
        });

        // Create default profile if it doesn't exist
        if (!userProfile) {
          userProfile = new profileSchema({
            userid: targetUser.id,
            selected: "None",
            image:
              "https://c.tenor.com/E6P9PZdh7W0AAAAC/date-a-live-kurumi.gif",
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

        const spiritData = await spiritSchema.findOne({
          id: userProfile.selected,
        });
        const allSpirits = await spiritSchema.find({
          husband: targetUser.id,
        });
        const selectedSpirit = spiritData
          ? `${spiritData.name} 【${"<a:starSpin:1006138461234937887>".repeat(
              spiritData.stars
            )}】`
          : "None";

        const profileEmbed = new EmbedBuilder()
          .setColor(userProfile.color)
          .setAuthor({
            name: targetUser.username,
            iconURL: targetUser.displayAvatarURL({ dynamic: true }),
          })
          .addFields(
            { name: "Selected Spirit", value: selectedSpirit, inline: false },
            {
              name: "Total Spirits",
              value: `${allSpirits.length}`,
              inline: false,
            },
            { name: "Bio", value: userProfile.bio, inline: false }
          )
          .setImage(userProfile.image);

        return interaction.editReply({ embeds: [profileEmbed] });
      }
    } catch (error) {
      console.error("Profile command error:", error);
      return interaction.editReply({
        content: "An error occurred. Please try again later.",
      });
    }
  },
};
