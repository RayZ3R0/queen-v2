import "dotenv/config";
import mongoose from "mongoose";
import { Bot } from "./handlers/Client.js";

// Connect to MongoDB
const mongodbUri = process.env.MONGODB_URI;
mongoose
  .connect(mongodbUri, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of default 30s
    socketTimeoutMS: 45000,
    retryWrites: true,
  })
  .then(() => console.log("> ✅ Connected to MongoDB"))
  .catch((err) => console.error("> ❌ Failed to connect to MongoDB:", err));
// mongoose.set("debug", true);

/**
 * The client instance representing the bot.
 * @type {Bot}
 */
export const client = new Bot();

// Login the bot using the provided token
client.build(client.config.TOKEN);

/**
 * Initializes and logs in the bot.
 * @module BotInitialization
 */

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("An uncaught exception occurred:", error);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  console.error("An unhandled promise rejection occurred:", error);
});
