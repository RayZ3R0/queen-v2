export default {
  name: "council",
  description: "Sends a council warning",
  cooldown: 3,
  category: "Gifs",
  userPermissions: [],
  botPermissions: [],
  aliases: [],
  run: async ({ client, message }) => {
    await message.channel.send({
      content:
        "https://media.discordapp.net/attachments/938770418599337984/966556469711499365/unknown.png",
    });
  },
};
