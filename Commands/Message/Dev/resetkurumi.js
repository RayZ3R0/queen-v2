import KurumiImage from "../../../schema/kurumiImage.js";

const AUTHORIZED_USER_ID = "636598760616624128";

export default {
    name: "resetkurumi",
    description: "Resets the Kurumi image database. (Specific User Only)",
    category: "Dev",
    owneronly: true, // Also restrict to owner as a safeguard, though we check ID manually too
    run: async ({ message }) => {
        if (message.author.id !== AUTHORIZED_USER_ID) {
            return message.channel.send("You are not authorized to use this command.");
        }

        try {
            const confirmationMsg = await message.channel.send(
                "⚠️ **WARNING** ⚠️\nAre you sure you want to delete ALL images from the Kurumi database? This cannot be undone.\nType `confirm` to proceed."
            );

            const filter = (m) => m.author.id === message.author.id && m.content.toLowerCase() === "confirm";
            const collector = message.channel.createMessageCollector({ filter, time: 10000, max: 1 });

            collector.on("collect", async () => {
                await KurumiImage.deleteMany({});
                message.channel.send("✅ Kurumi image database has been reset.");
            });

            collector.on("end", (collected) => {
                if (collected.size === 0) {
                    message.channel.send("❌ Reset cancelled (timed out).");
                }
            });

        } catch (error) {
            console.error("Error resetting kurumi DB:", error);
            message.channel.send("An error occurred while resetting the database.");
        }
    },
};
