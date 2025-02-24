import { client } from "../bot.js";
import starboard from "../utils/starboard.js";

client.on("messageReactionAdd", (reaction, user) => {
  starboard(client, reaction, {
    event: "messageReactionAdd",
    chid: "909828472145338398",
    embedColor: "#ff0000",
    min: 2,
  });
});

client.on("messageReactionRemove", (reaction, user) => {
  starboard(client, reaction, {
    event: "messageReactionRemove",
    chid: "909828472145338398",
    min: 2,
  });
});

client.on("messageDelete", (message) => {
  // For messageDelete, the parameter is a Message rather than a Reaction.
  starboard(client, message, {
    event: "messageDelete",
    chid: "909828472145338398",
  });
});
