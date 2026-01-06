import KurumiCategory from "../../../schema/kurumiCategory.js";
import KurumiImage from "../../../schema/kurumiImage.js";

export default {
    name: "category",
    description: "Manage Kurumi image categories. (Admin Only)",
    userPermissions: ["Administrator"],
    category: "Admin",
    run: async ({ message, args }) => {
        const subcommand = args[0]?.toLowerCase();
        const categoryName = args.slice(1).join(" ");

        if (!subcommand) {
            return message.channel.send(
                "Usage: `!category <add|remove|list> [name]`"
            );
        }

        try {
            if (subcommand === "add") {
                if (!categoryName) return message.channel.send("Please provide a category name.");

                const exists = await KurumiCategory.findOne({ name: categoryName });
                if (exists) return message.channel.send("Category already exists.");

                await KurumiCategory.create({ name: categoryName });
                return message.channel.send(`Category **${categoryName}** added.`);
            }

            if (subcommand === "remove") {
                if (!categoryName) return message.channel.send("Please provide a category name.");

                const deleted = await KurumiCategory.findOneAndDelete({ name: categoryName });
                if (!deleted) return message.channel.send("Category not found.");

                // Remove category from images
                await KurumiImage.updateMany(
                    { category: categoryName },
                    { $set: { category: null } }
                );

                return message.channel.send(`Category **${categoryName}** removed.`);
            }

            if (subcommand === "list") {
                const categories = await KurumiCategory.find({});
                if (categories.length === 0) return message.channel.send("No categories found.");

                const list = categories.map((c) => `- ${c.name}`).join("\n");
                return message.channel.send(`**Categories:**\n${list}`);
            }

            return message.channel.send("Invalid subcommand. Use `add`, `remove`, or `list`.");
        } catch (error) {
            console.error("Category command error:", error);
            message.channel.send("An error occurred.");
        }
    },
};
