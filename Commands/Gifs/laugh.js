export default {
  name: "laugh",
  description: "Sends a laugh GIF",
  cooldown: 3,
  category: "Gifs",
  userPermissions: [],
  botPermissions: [],
  aliases: [],
  run: async ({ client, message }) => {
    await message.channel.send({
      content: "https://tenor.com/bVrrF.gif",
    });
  },
};
