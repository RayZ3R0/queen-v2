export default {
  name: "season5",
  description: "Sends a season 5 image",
  cooldown: 3,
  category: "Gifs",
  userPermissions: [],
  botPermissions: [],
  aliases: [],
  run: async ({ client, message }) => {
    await message.channel.send({
      content:
        "https://media.discordapp.net/attachments/965509744859185262/1239137654629597184/image0-transformed.png?ex=6641d45e&is=664082de&hm=c194d7b4101a2123d8e491341b6ad9a6f757bc18b680f10dd00cb36d6d7793f9&quality=lossless&",
    });
  },
};
