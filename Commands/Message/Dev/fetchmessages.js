import { AttachmentBuilder } from "discord.js";

export default {
    name: "fetchmessages",
    description: "Fetches the last 100 messages and sends them as a text file. (Owner Only)",
    owneronly: true,
    aliases: ["fm", "dump"],
    category: "Dev",
    run: async ({ message }) => {
        try {
            const sentMessage = await message.channel.send("Fetching messages...");

            const messages = await message.channel.messages.fetch({ limit: 100 });
            const sorted = Array.from(messages.values()).sort(
                (a, b) => a.createdTimestamp - b.createdTimestamp
            );

            let output = `Fetched ${sorted.length} messages from #${message.channel.name} (${message.channel.id})\n`;
            output += `Guild: ${message.guild.name}\n`;
            output += `Date: ${new Date().toLocaleString()}\n\n`;

            for (const m of sorted) {
                output += `[${m.createdAt.toLocaleString()}] ${m.author.tag} (${m.author.id
                    }):\n`;

                if (m.content) {
                    output += `Content: ${m.content}\n`;
                }

                if (m.embeds.length > 0) {
                    output += `[Embeds: ${m.embeds.length}]\n`;
                    for (let i = 0; i < m.embeds.length; i++) {
                        const e = m.embeds[i];
                        output += `  Embed #${i + 1} (${e.type}):\n`;
                        if (e.title) output += `    Title: ${e.title}\n`;
                        if (e.description)
                            output += `    Desc: ${e.description.replace(/\n/g, " ")}\n`;
                        if (e.url) output += `    URL: ${e.url}\n`;
                        if (e.image) output += `    Image: ${e.image.url}\n`;
                        if (e.thumbnail) output += `    Thumbnail: ${e.thumbnail.url}\n`;
                        if (e.video) output += `    Video: ${e.video.url}\n`;
                        if (e.footer) output += `    Footer: ${e.footer.text}\n`;
                    }
                }

                if (m.attachments.size > 0) {
                    output += `[Attachments: ${m.attachments.size}]\n`;
                    m.attachments.forEach((a) => {
                        output += `  - ${a.url}\n`;
                    });
                }

                output += `\n${"-".repeat(50)}\n\n`;
            }

            const buffer = Buffer.from(output, "utf-8");
            const attachment = new AttachmentBuilder(buffer, {
                name: `messages-${message.channel.name}.txt`,
            });

            await sentMessage.edit({
                content: "Here are the last 100 messages:",
                files: [attachment],
            });
        } catch (error) {
            console.error("Error fetching messages:", error);
            message.channel.send(`Error: ${error.message}`);
        }
    },
};
