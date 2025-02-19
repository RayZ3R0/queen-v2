export default {
  name: "disagree",
  description: "No.",
  cooldown: 3,
  category: "Gifs",
  userPermissions: [],
  botPermissions: [],
  aliases: [],
  run: async ({ client, message }) => {
    await message.channel.send({
      content:
        "https://tenor.com/view/the-council-of-kurumi-kurumi-kurumi-tokisaki-kurumi-s4-dal-gif-26043923",
    });
  },
};
