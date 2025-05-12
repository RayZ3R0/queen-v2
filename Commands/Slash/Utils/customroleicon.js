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
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("url")
        .setDescription("URL of the image to use as the role icon")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("emoji")
        .setDescription("Use an emoji as the role icon (can be custom emoji)")
        .setRequired(false),
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
              "You need to be a server booster to use this command.",
            ),
          ],
          ephemeral: true,
        });
      }

      // Get image from attachment, URL, or emoji
      const attachment = interaction.options.getAttachment("image");
      const url = interaction.options.getString("url");
      const emoji = interaction.options.getString("emoji");

      const optionsCount = [attachment, url, emoji].filter(Boolean).length;

      if (optionsCount === 0) {
        return await interaction.reply({
          embeds: [
            createErrorEmbed(
              "Please provide one of the following: an image attachment, a URL to an image, or an emoji.",
            ),
          ],
          ephemeral: true,
        });
      }

      if (optionsCount > 1) {
        return await interaction.reply({
          embeds: [
            createErrorEmbed(
              "Please provide only one of the following: an image attachment, a URL, or an emoji.",
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
              "You don't have a custom role yet. Use `/customrole create` first.",
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
              "Your custom role was deleted. Please create a new one.",
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
        } else if (url) {
          // Validate and process URL
          validateImageUrl(url);
          const downloadedImage = await downloadImage(url);
          imageBuffer = await processImage(downloadedImage);
        } else if (emoji) {
          // Process emoji
          // Check if it's a custom emoji (format like <:name:id> or <a:name:id>)
          const emojiRegex = /<(?:a)?:([a-zA-Z0-9_]+):(\d+)>/;
          const emojiMatch = emoji.match(emojiRegex);

          if (emojiMatch) {
            // It's a custom emoji
            const emojiId = emojiMatch[2];
            const isAnimated = emoji.startsWith("<a:");
            const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${isAnimated ? "gif" : "png"}`;

            const downloadedEmoji = await downloadImage(emojiUrl);
            imageBuffer = await processImage(downloadedEmoji);
          } else {
            // It's a default/unicode emoji - not supported for role icons
            return await interaction.editReply({
              embeds: [
                createErrorEmbed(
                  "Only custom emojis are supported for role icons. Default Discord emojis cannot be used.",
                ),
              ],
            });
          }
        }

        // Set role icon
        await role.setIcon(
          imageBuffer,
          `Custom role icon set by ${interaction.user.tag}`,
        );

        // Create preview attachment
        const preview = new AttachmentBuilder(imageBuffer, {
          name: "icon-preview.png",
        });

        return await interaction.editReply({
          embeds: [
            createSuccessEmbed(
              "Custom role icon has been updated successfully!",
            ).setImage("attachment://icon-preview.png"),
          ],
          files: [preview],
        });
      } catch (error) {
        console.error("Error processing image:", error);
        return await interaction.editReply({
          embeds: [
            createErrorEmbed(
              error.message || "An error occurred while processing the image.",
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
