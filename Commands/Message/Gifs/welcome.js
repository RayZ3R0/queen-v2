export default {
  name: "welcome",
  description: "Sends a welcome image",
  cooldown: 3,
  category: "Gifs",
  userPermissions: [],
  botPermissions: [],
  aliases: [],
  run: async ({ client, message }) => {
    await message.channel.send({
      content:
        "https://cdn.discordapp.com/attachments/965509744859185262/1031638285883281459/1666032075971.jpg",
    });
  },
};
