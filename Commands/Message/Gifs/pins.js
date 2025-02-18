export default {
  name: "pins",
  description: "Displays pins image",
  cooldown: 3,
  category: "Gifs",
  userPermissions: [],
  botPermissions: [],
  aliases: [],
  run: async ({ client, message }) => {
    await message.channel.send({
      content:
        "https://cdn.discordapp.com/attachments/1009408632317804544/1239903000148054086/pins.png?ex=66449d27&is=66434ba7&hm=4d1d0a74c6d660e9f17ba3cd910d099427c8f16ea1fdfb4e34b80b0c6aff1bfe&",
    });
  },
};
