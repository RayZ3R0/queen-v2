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
const SHRINE_CHANNEL_ID = "912942764000419850"; // Kurumi Shrine
const NSFW_CHANNEL_ID = "913436035264962600"; // NSFW Channel
const LOG_CHANNEL_ID = "1458093264002355210"; // Log channel
const SPECIAL_USER_ID = "636598760616624128"; // z3r0

// Helper to extract media from a message (or snapshot)
function extractMediaFromMessage(msg) {
    const mediaUrls = new Set();
    const mediaTypes = new Map(); // url -> 'image' | 'video'

    // 1. Attachments
    if (msg.attachments) {
        msg.attachments.forEach((attachment) => {
            const isImage = attachment.contentType?.startsWith("image/");
            const isVideo = attachment.contentType?.startsWith("video/");

            if (isImage || isVideo) {
                mediaUrls.add(attachment.url);
                mediaTypes.set(attachment.url, isVideo ? "video" : "image");
            }
        });
    }

    // 2. Embeds
    if (msg.embeds) {
        msg.embeds.forEach((embed) => {
            // Standard Image
            if (embed.image) {
                mediaUrls.add(embed.image.url);
                mediaTypes.set(embed.image.url, "image");
            }
            // Video (often used by FxTwitter/FixupX/Tenor)
            if (embed.video) {
                mediaUrls.add(embed.video.url);
                mediaTypes.set(embed.video.url, "video");
            }
            // Thumbnails (sometimes relevant)
            else if (embed.thumbnail) {
                mediaUrls.add(embed.thumbnail.url);
                mediaTypes.set(embed.thumbnail.url, "image");
            }
        });
    }

    return { mediaUrls, mediaTypes };
}

// Proactive Duplicate Detection Listener
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (message.channel.id !== SHRINE_CHANNEL_ID) return;

    // Extract media from message and snapshots
    const allMediaUrls = new Set();

    const processMessageContent = (msg) => {
        const { mediaUrls } = extractMediaFromMessage(msg);
        mediaUrls.forEach(url => allMediaUrls.add(url));
    };

    processMessageContent(message);

    if (message.messageSnapshots && message.messageSnapshots.size > 0) {
        message.messageSnapshots.forEach(snapshot => processMessageContent(snapshot));
    }

    if (allMediaUrls.size === 0) return; // Don't check DB if no media

    // Check for ANY duplicate
    for (const url of allMediaUrls) {
        const exists = await KurumiImage.findOne({ url });
        if (exists) {
            try {
                await message.react("♻️");
            } catch (e) {
                console.error("Failed to react to duplicate:", e);
            }
            return; // One duplicate is enough to trigger the reaction
        }
    }
});

client.on("messageReactionAdd", async (reaction, user) => {
    try {
        // 1. Partial Fetching
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error("Error fetching message:", error);
                return;
            }
        }
        if (user.partial) {
            try {
                await user.fetch();
            } catch (error) {
                console.error("Error fetching user:", error);
                return;
            }
        }

        const message = reaction.message;
        const channelId = message.channel.id;

        // 2. Channel & Trigger Checks
        let defaultCategory = null;
        let shouldProcess = false;

        // NSFW Channel Logic
        if (channelId === NSFW_CHANNEL_ID) {
            // ONLY triggered by SPECIAL_USER_ID
            if (user.id === SPECIAL_USER_ID) {
                shouldProcess = true;
                defaultCategory = "NSFW";
            }
        }
        // Shrine Channel Logic
        else if (channelId === SHRINE_CHANNEL_ID) {
            const totalReactions = message.reactions.cache.reduce(
                (acc, r) => acc + r.count,
                0
            );
            // Triggered by SPECIAL_USER_ID OR 3+ reactions
            if (user.id === SPECIAL_USER_ID || totalReactions >= 3) {
                shouldProcess = true;
            }
        } else {
            return; // Wrong channel
        }

        if (!shouldProcess) return;

        // 3. Extraction (Recursive for Forwarded Messages)
        const allMediaUrls = new Set();
        const allMediaTypes = new Map();

        const processMessageContent = (msg) => {
            const { mediaUrls, mediaTypes } = extractMediaFromMessage(msg);
            mediaUrls.forEach(url => {
                allMediaUrls.add(url);
                allMediaTypes.set(url, mediaTypes.get(url));
            });
        };

        // Process Original Message
        processMessageContent(message);

        // Process Forwarded Messages (Message Snapshots)
        if (message.messageSnapshots && message.messageSnapshots.size > 0) {
            message.messageSnapshots.forEach(snapshot => {
                processMessageContent(snapshot);
            });
        }

        if (allMediaUrls.size === 0) return;

        // 4. Processing & Storage
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);

        for (const url of allMediaUrls) {
            // Check if exists
            const exists = await KurumiImage.findOne({ url });
            if (exists) {
                // DUPLICATE HANDLING: React with Recycle Emoji
                try {
                    await message.react("♻️");
                } catch (e) {
                    // Ignore (might not have perm or blocked)
                }
                continue;
            }

            // Save to DB
            const newImage = new KurumiImage({
                url,
                messageId: message.id,
                uploaderId: message.author.id,
                category: defaultCategory,
            });
            await newImage.save();

            // 5. Logging
            if (logChannel) {
                const type = allMediaTypes.get(url);
                const isVideo = type === "video";

                const embed = new EmbedBuilder()
                    .setColor("#ff0000")
                    .setAuthor({
                        name: `Uploaded by ${message.author.tag}`,
                        iconURL: message.author.displayAvatarURL(),
                    })
                    .setDescription(
                        `**Source:** [Jump to Message](${message.url})\n**ID:** \`${newImage._id}\`\n**Category:** ${defaultCategory || "None"}\n${isVideo ? `\n**[Watch Video](${url})**` : ""}`
                    )
                    .setFooter({ text: "Kurumi Image Collector" })
                    .setTimestamp();

                if (!isVideo) {
                    embed.setImage(url);
                }

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
                        default: c.name === defaultCategory,
                    }));

                    const selectMenu = new StringSelectMenuBuilder()
                        .setCustomId(`select_kurumi_category_${newImage._id}`)
                        .setPlaceholder("Select a Category")
                        .addOptions(options);

                    rows.push(new ActionRowBuilder().addComponents(selectMenu));
                }

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

            // Basic description update handling
            let desc = oldEmbed.description;
            // Regex to replace Category line if exists, or append it
            if (desc.includes("**Category:**")) {
                desc = desc.replace(/\*\*Category:\*\* .*/, `**Category:** ${categoryName}`);
            } else {
                desc += `\n**Category:** ${categoryName}`;
            }

            const newEmbed = EmbedBuilder.from(oldEmbed).setDescription(desc);

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
