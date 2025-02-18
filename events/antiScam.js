import { EmbedBuilder } from "discord.js";
import warningDB from "../schema/warndb.js";
import axios from "axios";
import { client } from "../bot.js";

// Caching configuration
let cachedScamLinks = [];
let cacheTimestamp = 0;
const CACHE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Function to fetch scam links with caching
async function fetchScamLinks() {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_INTERVAL_MS && cachedScamLinks.length) {
    return cachedScamLinks;
  }
  const url =
    "https://raw.githubusercontent.com/Discord-AntiScam/scam-links/main/list.json";
  try {
    const response = await axios.get(url);
    if (Array.isArray(response.data)) {
      cachedScamLinks = response.data;
      cacheTimestamp = Date.now();
      return cachedScamLinks;
    } else {
      console.error("Fetched data is not an array.");
      return cachedScamLinks;
    }
  } catch (error) {
    console.error("Error fetching scam links:", error);
    return cachedScamLinks;
  }
}

client.on("messageCreate", async (message) => {
  // Skip bot messages or messages without content
  if (message.author.bot || !message.content) return;

  const scamLinkArray = await fetchScamLinks();

  let isScamDetected = false;
  message.content.split(" ").forEach((token) => {
    let sanitizedToken;
    if (/^(ftp|http|https):\/\/[^ "]+$/.test(token)) {
      sanitizedToken = token
        .replaceAll("http://", "")
        .replaceAll("https://", "")
        .replaceAll("www.", "www.")
        .replaceAll("/", "");
    } else {
      sanitizedToken = token;
    }
    if (scamLinkArray.includes(sanitizedToken)) isScamDetected = true;
  });

  if (isScamDetected) {
    try {
      await message.delete();
    } catch (err) {
      console.error("Failed to delete scam message:", err);
    }
    const dmEmbed = new EmbedBuilder()
      .setTitle("No scam links.")
      .setColor("Red");
    await message.author.send({ embeds: [dmEmbed] });
  } else {
    return;
  }

  // Warning handling
  const warnReason = "Scam links";
  const targetMember = message.member;
  const moderatorId = client.user.id;

  try {
    let userWarnings = await warningDB
      .findOne({
        guild: message.guild.id,
        user: targetMember.user.id,
      })
      .exec();

    const newWarning = {
      moderator: moderatorId,
      reason: warnReason,
      time: Math.floor(Date.now() / 1000),
      id: Math.floor(Math.random() * Date.now()).toString(36),
    };

    if (!userWarnings) {
      userWarnings = new warningDB({
        guild: message.guild.id,
        user: targetMember.user.id,
        content: [newWarning],
      });
    } else {
      userWarnings.content.push(newWarning);
    }
    await userWarnings.save();

    const warnCount = userWarnings.content.length;

    if (warnCount > 2 && warnCount < 5) {
      const muteDuration = 5 * 60000; // 5 minutes in ms
      await targetMember.timeout(muteDuration, "Posting scam links");
      await message.author.send({
        content: `${message.author} You have been muted for sending scam links.`,
      });
      const warningEmbed = new EmbedBuilder()
        .setAuthor({
          name: "Warning",
          iconURL: targetMember.displayAvatarURL({ dynamic: true, size: 512 }),
        })
        .setDescription(`Warned ${targetMember} for **${warnReason}**`)
        .setColor("Red")
        .addFields(
          { name: "Total warns:", value: `${warnCount}` },
          {
            name: "Action",
            value: `${targetMember} is now muted for 5 minutes.`,
          }
        )
        .setTimestamp()
        .setFooter({ text: `Warned by ${message.author.username}` });
      message.channel.send({ embeds: [warningEmbed] });
    } else if (warnCount > 4 && warnCount < 7) {
      const muteDuration = 10 * 60000; // 10 minutes in ms
      await targetMember.timeout(muteDuration, "Posting scam links");
      await message.author.send({
        content: `${message.author} You have been muted for sending scam links.`,
      });
      const warningEmbed = new EmbedBuilder()
        .setAuthor({
          name: "Warning",
          iconURL: targetMember.displayAvatarURL({ dynamic: true, size: 512 }),
        })
        .setDescription(`Warned ${targetMember} for **${warnReason}**`)
        .setColor("Red")
        .addFields(
          { name: "Total warns:", value: `${warnCount}` },
          {
            name: "Action",
            value: `${targetMember} has been muted for 10 minutes.`,
          }
        )
        .setTimestamp()
        .setFooter({ text: `Warned by ${message.author.username}` });
      message.channel.send({ embeds: [warningEmbed] });
    } else if (warnCount > 6) {
      const kickReason = "Too many warns.";
      try {
        await targetMember.kick({ reason: kickReason });
        const kickEmbed = new EmbedBuilder()
          .setColor("#34e628")
          .setAuthor({
            name: targetMember.user.username,
            iconURL: targetMember.displayAvatarURL({
              dynamic: true,
              size: 512,
            }),
          })
          .setDescription(
            `${targetMember} has been kicked due to too many warns!`
          )
          .addFields({ name: "\u200b", value: "\u200b", inline: true })
          .setTimestamp()
          .setFooter({ text: "Bai bai~" });
        message.channel.send({ embeds: [kickEmbed] });
      } catch (kickError) {
        console.error("Kick error:", kickError);
        const errorEmbed = new EmbedBuilder()
          .setColor("Red")
          .setDescription("Failed to kick the user.");
        message.channel.send({ embeds: [errorEmbed] });
      }
    } else {
      const warningEmbed = new EmbedBuilder()
        .setAuthor({
          name: "Warnings",
          iconURL: targetMember.displayAvatarURL({ dynamic: true, size: 512 }),
        })
        .setDescription(`Warned ${targetMember} for **${warnReason}**`)
        .setColor("Red")
        .addFields({ name: "Total warns:", value: `${warnCount}` })
        .setTimestamp()
        .setFooter({ text: "Warned" });
      message.channel.send({ embeds: [warningEmbed] });
    }
  } catch (error) {
    console.error("Error processing warns:", error);
  }
});
