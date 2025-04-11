import { readdir } from "node:fs/promises";
import { Logger } from "../utils/Logger.js";

/**
 * Loads event handlers for the client.
 * @param {Bot} client - The client instance.
 */
export default async (client) => {
  try {
    const spinnerId = Logger.startSpinner("Loading events");
    let count = 0;
    let loadedEvents = [];

    const eventFiles = await readdir("./events");
    const eventFilesFiltered = eventFiles.filter((file) =>
      file.endsWith(".js")
    );

    await Promise.all(
      eventFilesFiltered.map(async (file) => {
        try {
          await import(`../events/${file}`).then((r) => r.default);
          count++;
          loadedEvents.push(file.replace(".js", ""));
          Logger.updateSpinner(
            spinnerId,
            `Loading events... (${count}/${eventFilesFiltered.length})`
          );
        } catch (error) {
          console.error(`[x] Error loading event from file ${file}:`, error);
          return 0;
        }
      })
    );

    Logger.succeedSpinner(spinnerId);
    console.log(
      Logger.createBox("Events Loaded", [
        `[*] Total Events: ${count}`,
        "",
        "Loaded Events:",
        ...loadedEvents.map((event) => `  + ${event}`),
      ])
    );
  } catch (error) {
    console.error(
      "[x] An error occurred while reading the events folder:",
      error
    );
  }
};
