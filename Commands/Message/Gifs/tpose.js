export default {
  name: "tpose",
  description: "Sends a T-pose image",
  cooldown: 3,
  category: "Gifs",
  userPermissions: [],
  botPermissions: [],
  aliases: [],
  run: async ({ client, message }) => {
    await message.channel.send({
      content:
        "https://cdn.discordapp.com/attachments/901338354166140928/1025496710841122898/kurumi_T_pose.png",
    });
  },
};
