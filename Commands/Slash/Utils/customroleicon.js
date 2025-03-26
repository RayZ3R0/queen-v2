import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  AttachmentBuilder,
} from "discord.js";
import CustomRoles from "../../../schema/customRoles.js";
import {
  processImage,
  downloadImage,
  validateImageUrl,
  createErrorEmbed,
  createSuccessEmbed,
} from "../../../utils/imageProcessor.js";

export default {
  name: "customroleicon",
  data: new SlashCommandBuilder()
    .setName("customroleicon")
    .setDescription("Set an icon for your custom role")
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("Upload an image to use as the role icon")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("url")
        .setDescription("URL of the image to use as the role icon")
        .setRequired(false)
    ),
  category: "Utils",
  botPermissions: [PermissionFlagsBits.ManageRoles],
  cooldown: 300,

  run: async ({ client, interaction }) => {
    try {
      // Check if user is a booster
      if (!interaction.member.premiumSince) {
        return await interaction.reply({
          embeds: [
            createErrorEmbed(
              "You need to be a server booster to use this command."
            ),
          ],
          ephemeral: true,
        });
      }

      // Get image from attachment or URL
      const attachment = interaction.options.getAttachment("image");
      const url = interaction.options.getString("url");

      if (!attachment && !url) {
        return await interaction.reply({
          embeds: [
            createErrorEmbed(
              "Please provide either an image attachment or a URL to the image."
            ),
          ],
          ephemeral: true,
        });
      }

      if (attachment && url) {
        return await interaction.reply({
          embeds: [
            createErrorEmbed(
              "Please provide either an image attachment or a URL, not both."
            ),
          ],
          ephemeral: true,
        });
      }

      // Defer reply as image processing might take time
      await interaction.deferReply();

      // Get user's custom role
      const customRole = await CustomRoles.findOne({
        userId: interaction.user.id,
        guildId: interaction.guild.id,
      });

      if (!customRole) {
        return await interaction.editReply({
          embeds: [
            createErrorEmbed(
              "You don't have a custom role yet. Use `/customrole create` first."
            ),
          ],
        });
      }

      const role = await interaction.guild.roles.fetch(customRole.roleId);
      if (!role) {
        await CustomRoles.findByIdAndDelete(customRole._id);
        return await interaction.editReply({
          embeds: [
            createErrorEmbed(
              "Your custom role was deleted. Please create a new one."
            ),
          ],
        });
      }

      let imageBuffer;
      try {
        if (attachment) {
          // Validate attachment
          if (!attachment.contentType?.startsWith("image/")) {
            return await interaction.editReply({
              embeds: [createErrorEmbed("The uploaded file is not an image.")],
            });
          }

          // Download and process attachment
          const downloadedImage = await downloadImage(attachment.url);
          imageBuffer = await processImage(downloadedImage);
        } else {
          // Validate and process URL
          validateImageUrl(url);
          const downloadedImage = await downloadImage(url);
          imageBuffer = await processImage(downloadedImage);
        }

        // Set role icon
        await role.setIcon(
          imageBuffer,
          `Custom role icon set by ${interaction.user.tag}`
        );

        // Create preview attachment
        const preview = new AttachmentBuilder(imageBuffer, {
          name: "icon-preview.png",
        });

        return await interaction.editReply({
          embeds: [
            createSuccessEmbed(
              "Custom role icon has been updated successfully!"
            ).setImage("attachment://icon-preview.png"),
          ],
          files: [preview],
        });
      } catch (error) {
        console.error("Error processing image:", error);
        return await interaction.editReply({
          embeds: [
            createErrorEmbed(
              error.message || "An error occurred while processing the image."
            ),
          ],
        });
      }
    } catch (error) {
      console.error("Error in customroleicon command:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [
            createErrorEmbed("An error occurred while setting the role icon."),
          ],
          ephemeral: true,
        });
      } else {
        await interaction.editReply({
          embeds: [
            createErrorEmbed("An error occurred while setting the role icon."),
          ],
        });
      }
    }
  },
};
