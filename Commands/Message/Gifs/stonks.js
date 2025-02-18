export default {
  name: "stonks",
  description: "Sends a stonks meme",
  cooldown: 3,
  category: "Gifs",
  userPermissions: [],
  botPermissions: [],
  aliases: [],
  run: async ({ client, message }) => {
    await message.channel.send({
      content:
        "https://cdn.discordapp.com/attachments/839082244060217404/1037236623387148298/1667365614808.jpg",
    });
  },
};
