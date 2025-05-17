import { readdir } from "node:fs/promises";

/**
 * Loads event handlers for the client.
 * @param {Bot} client - The client instance.
 */
export default async (client) => {
  try {
    console.log("Loading events...");
    let count = 0;
    let loadedEvents = [];

    const eventFiles = await readdir("./events");
    const eventFilesFiltered = eventFiles.filter((file) =>
      file.endsWith(".js")
    );

    await Promise.all(
      eventFilesFiltered.map(async (file) => {
        try {
          const eventModule = await import(`../events/${file}`);
          if (typeof eventModule.default === "function") {
            await eventModule.default(client);
          }
          count++;
          loadedEvents.push(file.replace(".js", ""));
          process.stdout.write(
            `\rLoading events... (${count}/${eventFilesFiltered.length})`
          );
        } catch (error) {
          console.error(`[x] Error loading event from file ${file}:`, error);
          return 0;
        }
      })
    );

    console.log("\n");
    console.log("+==========================+");
    console.log("| Events Loaded            |");
    console.log("+--------------------------+");
    console.log(
      [
        `[*] Total Events: ${count}`,
        "",
        "Loaded Events:",
        ...loadedEvents.map((event) => `  + ${event}`),
      ].join("\n")
    );
    console.log("+==========================+");
  } catch (error) {
    console.error(
      "[x] An error occurred while reading the events folder:",
      error
    );
  }
};
