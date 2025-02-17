/**
 * @type {import("../../../index.js").Mcommand}
 */
export default {
  name: "ping",
  description: "Check the bot's latency with advanced metrics.",
  userPermissions: ["SendMessages"],
  botPermissions: ["SendMessages", "EmbedLinks"],
  category: "Misc",
  cooldown: 5,

  run: async ({ client, message, args, prefix }) => {
    // Record the current time before sending a message
    const start = Date.now();

    // Send a temporary message to calculate latency
    const tempMsg = await message.channel.send("Pinging...");

    // Calculate the round-trip latency
    const latency = Date.now() - start;

    // Use the websocket ping provided by the client's API
    const apiLatency = client.ws.ping;

    // Build an embed with the advanced ping details
    const embed = {
      color: 0x00ff00,
      title: "🏓 Pong!",
      fields: [
        {
          name: "Round-Trip Latency",
          value: `${latency} ms`,
          inline: true,
        },
        {
          name: "API Latency",
          value: `${apiLatency} ms`,
          inline: true,
        },
      ],
      timestamp: new Date(),
    };

    // Edit the temporary message to display the final embed
    await tempMsg.edit({ content: null, embeds: [embed] });
  },
};
