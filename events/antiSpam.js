import { client } from "../bot.js";

const userMessageMap = new Map();
const MESSAGE_LIMIT = 1;
const TIMEOUT_DURATION = 300000; // 5 minutes in ms
const TIME_DIFF_THRESHOLD = 5000; // 2 seconds

const exemptChannelIds = [
  "955399577895317524",
  "957979414812065852",
  "901338643128516648",
  "957980980201816174",
  "957981195604471858",
];

const ownerIds = ["636598760616624128"];

client.on("messageCreate", async (message) => {
  try {
    // Ignore bots, exempt channels and owners.
    if (message.author.bot) return;
    if (ownerIds.includes(message.author.id)) return;
    if (exemptChannelIds.includes(message.channel.id)) return;

    // Ensure that message comes from a guild.
    if (!message.guild || !message.member) return;

    const userId = message.author.id;
    const currentTimestamp = message.createdTimestamp;

    if (userMessageMap.has(userId)) {
      const userData = userMessageMap.get(userId);
      const timeDifference =
        currentTimestamp - userData.lastMessage.createdTimestamp;
      let msgCount = userData.msgCount;

      if (timeDifference > TIME_DIFF_THRESHOLD) {
        clearTimeout(userData.timer);
        // Reset message count and update lastMessage
        userData.msgCount = 1;
        userData.lastMessage = message;
        userData.timer = setTimeout(() => {
          userMessageMap.delete(userId);
        }, TIMEOUT_DURATION);
        userMessageMap.set(userId, userData);
      } else {
        // Increment message count within allowable time difference
        msgCount++;
        if (msgCount === MESSAGE_LIMIT) {
          // Check if the bot can timeout the member
          if (typeof message.member.timeout === "function") {
            try {
              await message.member.timeout(
                TIMEOUT_DURATION,
                "Spamming messages"
              );
            } catch (error) {
              console.error(
                `Error timing out member ${message.member.user.tag}:`,
                error
              );
            }
          } else {
            console.warn(
              `Timeout not available for member ${message.member.user.tag}.`
            );
          }
          try {
            await message.author.send({
              content: `${message.author}, you have been muted for spamming. You will be unmuted after 5 minutes.`,
            });
          } catch (error) {
            console.error(`Could not send DM to ${message.author.tag}:`, error);
          }
        } else {
          userData.msgCount = msgCount;
          userMessageMap.set(userId, userData);
        }
      }
    } else {
      // New user: initialize in map with a removal timer.
      const removalTimer = setTimeout(() => {
        userMessageMap.delete(userId);
      }, TIMEOUT_DURATION);

      userMessageMap.set(userId, {
        msgCount: 1,
        lastMessage: message,
        timer: removalTimer,
      });
    }
  } catch (err) {
    console.error("Error handling messageCreate event:", err);
  }
});
