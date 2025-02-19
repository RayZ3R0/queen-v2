export default {
  name: "rules",
  description: "Sends server rules image",
  cooldown: 3,
  category: "Gifs",
  userPermissions: [],
  botPermissions: [],
  aliases: [],
  run: async ({ client, message }) => {
    await message.channel.send({
      content:
        "https://cdn.discordapp.com/attachments/1015214307400753163/1044297647449718784/1669050328326.jpg",
    });
  },
};
