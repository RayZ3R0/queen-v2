export default {
  name: "cri",
  description: "No.",
  cooldown: 3,
  category: "Gifs",
  userPermissions: [],
  botPermissions: [],
  aliases: [],
  run: async ({ client, message }) => {
    await message.channel.send({
      content:
        "https://cdn.discordapp.com/attachments/900307317491384320/981461266067492884/Kurumi_Cry.mp4?size=4096",
    });
  },
};
