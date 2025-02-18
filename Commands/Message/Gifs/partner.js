export default {
  name: "partner",
  description: "Sends a partner image",
  cooldown: 3,
  category: "Gifs",
  userPermissions: [],
  botPermissions: [],
  aliases: [],
  run: async ({ client, message }) => {
    await message.channel.send({
      content:
        "https://media.discordapp.net/attachments/839082244060217404/1026059820631064596/1664518192966.jpg?width=350&height=473",
    });
  },
};
