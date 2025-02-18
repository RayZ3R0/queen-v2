export default {
  name: "worship",
  description: "Sends a worship GIF",
  cooldown: 3,
  category: "Gifs",
  userPermissions: [],
  botPermissions: [],
  aliases: [],
  run: async ({ client, message }) => {
    await message.channel.send({
      content:
        "https://media.discordapp.net/attachments/839082244060217404/1016222054359519252/Kuruworship.gif",
    });
  },
};
