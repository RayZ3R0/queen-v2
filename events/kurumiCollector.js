import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} from "discord.js";
import { client } from "../bot.js";
import KurumiImage from "../schema/kurumiImage.js";
import KurumiCategory from "../schema/kurumiCategory.js";

// Configuration
const TARGET_CHANNEL_ID = "912942764000419850"; // Kurumi Shrine
const LOG_CHANNEL_ID = "1458093264002355210"; // Log channel
const SPECIAL_USER_ID = "636598760616624128"; // z3r0

client.on("messageReactionAdd", async (reaction, user) => {
    try {
        // 1. Partial Fetching
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error("Something went wrong when fetching the message:", error);
                return;
            }
        }
        if (user.partial) {
            try {
                await user.fetch();
            } catch (error) {
                console.error("Something went wrong when fetching the user:", error);
                return;
            }
        }

        const message = reaction.message;

        // 2. Channel Check
        if (message.channel.id !== TARGET_CHANNEL_ID) return;

        // 3. Trigger Check
        // Condition A: 3 or more reactions total (count is across all emojis, need to sum if needed, but per-emoji count is usually enough for "popular" check)
        // The request said "if a message has 3 reactions of any emoji or more".
        // reaction.count is specific to THAT emoji.
        // To check TOTAL reactions on message, we sum them up.
        const totalReactions = message.reactions.cache.reduce(
            (acc, r) => acc + r.count,
            0
        );

        // Condition B: z3r0 reacted
        const isSpecialUser = user.id === SPECIAL_USER_ID;

        if (totalReactions < 3 && !isSpecialUser) return;

        // 4. Extraction
        const imageUrls = new Set();

        // Attachments
        message.attachments.forEach((attachment) => {
            if (attachment.contentType?.startsWith("image/")) {
                imageUrls.add(attachment.url);
            }
        });

        // Embeds (FxTwitter / FixupX / Tenor / etc)
        message.embeds.forEach((embed) => {
            if (embed.image) imageUrls.add(embed.image.url);
            if (embed.thumbnail) imageUrls.add(embed.thumbnail.url);
            // FxTwitter/FixupX/Tenor often put the main image in 'video' for gifs or just 'url' sometimes,
            // but 'image.url' is the standard for the full size preview.
            // We'll trust the requested logic: "extract https://pbs.twimg... if message has 3 reactions"
        });

        if (imageUrls.size === 0) return;

        // 5. Processing & Storage
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);

        for (const url of imageUrls) {
            // Check if exists
            const exists = await KurumiImage.findOne({ url });
            if (exists) continue;

            // Save to DB
            const newImage = new KurumiImage({
                url,
                messageId: message.id,
                uploaderId: message.author.id,
            });
            await newImage.save();

            // 6. Logging
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setColor("#ff0000")
                    .setImage(url)
                    .setAuthor({
                        name: `Uploaded by ${message.author.tag}`,
                        iconURL: message.author.displayAvatarURL(),
                    })
                    .setDescription(
                        `**Source:** [Jump to Message](${message.url})\n**ID:** \`${newImage._id}\``
                    )
                    .setFooter({ text: "Kurumi Image Collector" })
                    .setTimestamp();

                // Create Delete Button
                const deleteBtn = new ButtonBuilder()
                    .setCustomId(`delete_kurumi_${newImage._id}`)
                    .setLabel("Delete DB")
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji("🗑️");

                // Create Category Select Menu
                const categories = await KurumiCategory.find({});
                const rows = [];

                if (categories.length > 0) {
                    const options = categories.map((c) => ({
                        label: c.name,
                        value: c.name,
                    }));

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`select_kurumi_category_${newImage._id}`)
                        .setPlaceholder("Select a Category")
                        .addOptions(options);

                    rows.push(new ActionRowBuilder().addComponents(selectMenu));
                }

                // Add Delete Button to a separate row (or same if possible, but select menus take full width usually)
                // Select Menus MUST be on their own row.
                rows.push(new ActionRowBuilder().addComponents(deleteBtn));

                await logChannel.send({ embeds: [embed], components: rows });
            }
        }
    } catch (error) {
        console.error("Error in kurumiCollector:", error);
    }
});

// Interaction Handler
client.on("interactionCreate", async (interaction) => {
    // Admin Check
    if (
        !client.config.Owners.includes(interaction.user.id) &&
        !interaction.member.permissions.has("Administrator")
    ) {
        // Only verify admin for our buttons
        if (
            interaction.customId?.startsWith("delete_kurumi_") ||
            interaction.customId?.startsWith("select_kurumi_category_")
        ) {
            return interaction.reply({
                content: "You do not have permission to manage images.",
                ephemeral: true,
            });
        }
        return;
    }

    // Deletion Handler
    if (interaction.isButton() && interaction.customId.startsWith("delete_kurumi_")) {
        const imageId = interaction.customId.replace("delete_kurumi_", "");

        try {
            await KurumiImage.findByIdAndDelete(imageId);

            const disabledRow = new ActionRowBuilder().addComponents(
                ButtonBuilder.from(interaction.component).setDisabled(true)
            );

            // Update the embed to show it was deleted
            const oldEmbed = interaction.message.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed)
                .setColor("#57F287") // Green for done
                .setTitle("🗑️ Image Deleted from Database");

            await interaction.update({
                embeds: [newEmbed],
                components: [disabledRow],
            });
        } catch (error) {
            console.error("Error deleting kurumi image:", error);
            await interaction.reply({
                content: "Failed to delete image from database.",
                ephemeral: true,
            });
        }
    }

    // Category Selection Handler
    if (
        interaction.isStringSelectMenu() &&
        interaction.customId.startsWith("select_kurumi_category_")
    ) {
        const imageId = interaction.customId.replace("select_kurumi_category_", "");
        const categoryName = interaction.values[0];

        try {
            const image = await KurumiImage.findByIdAndUpdate(
                imageId,
                { category: categoryName },
                { new: true }
            );

            if (!image) {
                return interaction.reply({ content: "Image not found.", ephemeral: true });
            }

            // Update Embed to show category
            const oldEmbed = interaction.message.embeds[0];
            const newEmbed = EmbedBuilder.from(oldEmbed).setDescription(
                `**Source:** [Jump to Message](${oldEmbed.description.split("(")[1].split(")")[0]
                })\n` +
                `**ID:** \`${image._id}\`\n` +
                `**Category:** ${categoryName}`
            );

            await interaction.update({ embeds: [newEmbed] });
        } catch (error) {
            console.error("Error updating category:", error);
            await interaction.reply({
                content: "Failed to update category.",
                ephemeral: true,
            });
        }
    }
});
