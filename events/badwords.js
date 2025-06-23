import { client } from "../bot.js";
import { EmbedBuilder } from "discord.js";
import warningDB from "../schema/warndb.js";

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const member = message.member;
  const wordPassRole = message.guild.roles.cache.find(
    (role) => role.name === "Word Pass"
  );
  if (wordPassRole && member.roles.cache.has(wordPassRole.id)) return;

  const nsfwChannel = message.guild.channels.cache.find(
    (chan) => chan.name === "『🔞』nsfw" || chan.name === "nsfw"
  );
  if (nsfwChannel && message.channel.id === nsfwChannel.id) return;

  const messageWords = message.content.toLowerCase().split(" ");
  const badWords = [
    "ass-fucker",
    "assfucker",
    "assfukka",
    "bellend",
    "boiolas",
    "buceta",
    "bugger",
    "bunny fucker",
    "cawk",
    "chink",
    "cipa",
    "cuntlick",
    "cuntlicker",
    "cuntlicking",
    "cyalis",
    "dirsa",
    "dog-fucker",
    "donkeyribber",
    "doosh",
    "duche",
    "dyke",
    "fag",
    "fagging",
    "faggitt",
    "faggot",
    "faggs",
    "fagot",
    "fagots",
    "fags",
    "fanny",
    "fannyflaps",
    "fannyfucker",
    "fanyy",
    "fecker",
    "felching",
    "flange",
    "gaylord",
    "gaysex",
    "goatse",
    "hoar",
    "hoare",
    "hoer",
    "hore",
    "kawk",
    "kunilingus",
    "n1gga",
    "n1gger",
    "nazi",
    "nigg3r",
    "nigg4h",
    "nigga",
    "niggah",
    "niggas",
    "niggaz",
    "nigger",
    "niggers",
    "nutsack",
    "pigfucker",
    "pimpis",
    "pissflaps",
    "rimjaw",
    "scroat",
    "scrote",
    "scrotum",
    "slut",
    "sluts",
    "twathead",
    "twatty",
    "twunt",
    "twunter",
    "whoar",
    "whore",
    "kneeger",
    "neeger",
    "neger",
    "niiger",
    "knigger",
    "kneger",
    "kneegger",
    "niggerfag",
    "fagnigga",
    "kneegear",
    "knee gear",
    "kneeger",
    "saedma",
  ];

  const containsBadWords = messageWords.some((word) => badWords.includes(word));

  if (containsBadWords) {
    try {
      await message.delete();
    } catch (delError) {
      console.error("Failed to delete message:", delError);
    }
    const dmEmbed = new EmbedBuilder()
      .setTitle("**No bad words in general.**")
      .setColor("Red");
    try {
      await message.author.send({ embeds: [dmEmbed] });
    } catch (dmError) {
      console.error("Failed to send DM:", dmError);
    }
  } else {
    return;
  }

  // Warning handling
  const warnReason = "Bad words";
  const moderatorID = client.user.id;

  try {
    let warningData = await warningDB
      .findOne({ guild: message.guild.id, user: member.user.id })
      .exec();

    const newWarning = {
      moderator: moderatorID,
      reason: warnReason,
      time: Math.floor(Date.now() / 1000),
      id: Math.floor(Math.random() * Date.now()).toString(36),
    };

    if (!warningData) {
      warningData = new warningDB({
        guild: message.guild.id,
        user: member.user.id,
        content: [newWarning],
      });
    } else {
      warningData.content.push(newWarning);
    }
    await warningData.save();

    const warnCount = warningData.content.length;

    if (warnCount > 3 && warnCount < 6) {
      const muteDuration = 60000; // 1 minute
      await member.timeout(muteDuration, "Bad words");
      try {
        await message.author.send({
          content: `${message.author} You have been muted for using bad words.`,
        });
      } catch (dmError) {
        console.error("Failed to send DM:", dmError);
      }
      const warnEmbed = new EmbedBuilder()
        .setAuthor({
          name: "Warning",
          iconURL: member.displayAvatarURL({ dynamic: true, size: 512 }),
        })
        .setDescription(`Warned ${member} for **${warnReason}**`)
        .setColor("Red")
        .addFields(
          { name: "Total warns:", value: `${warnCount}` },
          { name: "Action", value: `${member} is now muted for 1 minute.` }
        )
        .setTimestamp()
        .setFooter({ text: `Warned by ${message.author.username}` });
      message.channel.send({ embeds: [warnEmbed] });
    } else if (warnCount > 5 && warnCount < 8) {
      const muteDuration = 2 * 60 * 1000; // 2 minutes
      await member.timeout(muteDuration, "Bad words");
      try {
        await message.author.send({
          content: `${message.author} You have been muted for using bad words.`,
        });
      } catch (dmError) {
        console.error("Failed to send DM:", dmError);
      }
      const warnEmbed = new EmbedBuilder()
        .setAuthor({
          name: "Warning",
          iconURL: member.displayAvatarURL({ dynamic: true, size: 512 }),
        })
        .setDescription(`Warned ${member} for **${warnReason}**`)
        .setColor("Red")
        .addFields(
          { name: "Total warns:", value: `${warnCount}` },
          { name: "Action", value: `${member} has been muted for 2 minutes.` }
        )
        .setTimestamp()
        .setFooter({ text: `Warned by ${message.author.username}` });
      message.channel.send({ embeds: [warnEmbed] });
    } else if (warnCount > 7) {
      if (member) {
        const kickReason = "Too many warns.";
        try {
          await member.kick({ reason: kickReason });
          const kickEmbed = new EmbedBuilder()
            .setColor("#34e628")
            .setAuthor({
              name: member.user.username,
              iconURL: member.displayAvatarURL({ dynamic: true, size: 512 }),
            })
            .setDescription(`${member} has been kicked due to too many warns!`)
            .addFields({ name: "\u200b", value: "\u200b", inline: true })
            .setTimestamp()
            .setFooter({ text: "Bai bai~" });
          message.channel.send({ embeds: [kickEmbed] });
        } catch (kickError) {
          console.error("Failed to kick member:", kickError);
          const errorEmbed = new EmbedBuilder()
            .setColor("Red")
            .setDescription("Failed to kick the user.");
          message.channel.send({ embeds: [errorEmbed] });
        }
      } else {
        const errorEmbed = new EmbedBuilder()
          .setColor("Red")
          .setDescription("User not found");
        message.channel.send({ embeds: [errorEmbed] });
      }
    } else {
      const warnEmbed = new EmbedBuilder()
        .setAuthor({
          name: "Warnings",
          iconURL: member.displayAvatarURL({ dynamic: true, size: 512 }),
        })
        .setDescription(`Warned ${member} for **${warnReason}**`)
        .setColor("Red")
        .addFields({ name: "Total warns:", value: `${warnCount}` })
        .setTimestamp()
        .setFooter({ text: "Warned" });
      message.channel.send({ embeds: [warnEmbed] });
    }
  } catch (error) {
    console.error("Error processing warnings:", error);
  }
});
