import { ApplicationCommandType, EmbedBuilder } from "discord.js";

/**
 * @type {import("../../../index").Scommand}
 */
export default {
  name: "ping",
  description: "Check the bot's latency.",
  userPermissions: ["SendMessages"],
  botPermissions: ["SendMessages", "EmbedLinks"],
  category: "Misc",
  type: ApplicationCommandType.ChatInput,

  run: async ({ client, interaction }) => {
    const startTime = Date.now();
    
    // Use withResponse instead of fetchReply
    const reply = await interaction.reply({ content: "Pinging...", withResponse: true });
    const timeTaken = Date.now() - startTime;
    const heartbeat = Math.round(client.ws.ping);

    const embed = new EmbedBuilder()
      .setTitle("🏓 Pong!")
      .setDescription(`**Message Latency:** ${timeTaken}ms\n**WebSocket Ping:** ${heartbeat}ms`)
      .setColor("Random")
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  },
};
