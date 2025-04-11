import { Message } from "discord.js";

// Configuration constants
const MESSAGE_DUPLICATE_THRESHOLD = 5;
const TIME_WINDOW_SECONDS = 60;
const LINK_DUPLICATE_THRESHOLD = 3;
const NEW_USER_THRESHOLD_HOURS = 24;
const TRUSTED_ROLE_IDS = ["902045721983844382", "938770418599337984"]; // Update with actual role IDs
const WHITELISTED_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "stackoverflow.com",
  "medium.com",
  "spotify.com",
  "apple.com",
  "twitch.tv",
  "twitter.com",
  "x.com",
  "reddit.com",
  "wikipedia.org",
  "google.com",
  "drive.google.com",
  "docs.google.com",
  "microsoft.com",
  "linkedin.com",
  "dev.to",
  "npmjs.com",
  "mozilla.org",
  "w3schools.com",
  "codepen.io",
  "jsfiddle.net",
  "replit.com",
  "figma.com",
  "notion.so",
];

// Message tracking maps
const userMessages = new Map();
const userLinks = new Map();

// Utility function to create message key
const createMessageKey = (userId, guildId) => `${userId}-${guildId}`;

// Function to clean message content for comparison
const normalizeMessage = (content) => {
  return content.toLowerCase().replace(/\s+/g, " ").trim();
};

// Function to extract all types of links from message
const extractLinks = (content) => {
  const results = [];

  // Match both markdown links [text](url) and regular URLs
  const urlRegex =
    /(?:\[(?:[^\]]*)\]\((https?:\/\/[^)]+)\))|(?:https?:\/\/[^\s\[\]()]+)/gi;
  const matches = content.matchAll(urlRegex);

  for (const match of matches) {
    const markdownUrl = match[1]; // Captures URL from markdown format
    const plainUrl = match[0]; // Full match for plain URLs

    try {
      // Use markdown URL if available, otherwise use plain URL
      const url = markdownUrl || plainUrl;
      // Clean URL by removing markdown wrapper if present
      const cleanUrl = url.replace(/^\[.*\]\((.*)\)$/, "$1");
      results.push(cleanUrl);
    } catch (error) {
      console.warn("Invalid URL format detected:", match[0]);
    }
  }

  return results;
};

// Function to check if domain is whitelisted with strict matching
const isDomainWhitelisted = (url) => {
  try {
    const urlObj = new URL(url.toLowerCase());
    const domain = urlObj.hostname;

    return WHITELISTED_DOMAINS.some((whitelistedDomain) => {
      // Exact domain match or proper subdomain match
      return (
        domain === whitelistedDomain || domain.endsWith(`.${whitelistedDomain}`)
      );
    });
  } catch (error) {
    // Consider invalid URLs as potential threats
    console.warn("Invalid URL format:", url);
    return false;
  }
};

/**
 * Track and analyze a message for spam detection
 * @param {Message} message Discord message object
 * @returns {Object} Analysis result with spam detection flags
 */
export const analyzeMessage = (message) => {
  const { author, guild, content, channel } = message;
  const messageKey = createMessageKey(author.id, guild.id);
  const normalizedContent = normalizeMessage(content);
  const links = extractLinks(content);

  // Initialize tracking for new users
  if (!userMessages.has(messageKey)) {
    userMessages.set(messageKey, []);
  }
  if (!userLinks.has(messageKey)) {
    userLinks.set(messageKey, new Map());
  }

  const now = Date.now();
  const timeWindow = now - TIME_WINDOW_SECONDS * 1000;

  // Update message tracking
  const userMessageList = userMessages.get(messageKey);
  userMessageList.push({
    content: normalizedContent,
    timestamp: now,
    channelId: channel.id,
    messageId: message.id,
  });

  // Clean up old messages
  while (
    userMessageList.length > 0 &&
    userMessageList[0].timestamp < timeWindow
  ) {
    userMessageList.shift();
  }

  // Update link tracking with enhanced URL normalization
  const userLinkMap = userLinks.get(messageKey);
  for (const link of links) {
    try {
      const urlObj = new URL(link.startsWith("http") ? link : `http://${link}`);
      const domain = urlObj.hostname.toLowerCase();

      // Skip if properly whitelisted
      if (isDomainWhitelisted(link)) continue;

      // Check for deceptive use of whitelisted domains in URL
      const pathParts = urlObj.pathname.toLowerCase().split("/");
      const isDeceptive = WHITELISTED_DOMAINS.some((whitelist) =>
        pathParts.some((part) => part.includes(whitelist))
      );

      if (isDeceptive) {
        // Mark as spam if trying to hide malicious URLs using whitelisted domains
        isSpam.linkSpam = true;
        return {
          isSpam,
          messageCount: userMessageList.length,
          uniqueChannels: channelCounts.size,
          duplicateCount: duplicateMessages,
          deceptiveLink: true,
        };
      }

      // Track normalized domain for duplicate detection
      const linkCount = userLinkMap.get(domain) || 0;
      userLinkMap.set(domain, linkCount + 1);
    } catch (error) {
      console.warn("Invalid or suspicious URL:", link);
      // Consider malformed URLs as potential threats
      isSpam.linkSpam = true;
    }
  }

  // Clean up old links
  for (const [link, lastSeen] of userLinkMap.entries()) {
    if (lastSeen < timeWindow) {
      userLinkMap.delete(link);
    }
  }

  // Analyze for spam patterns
  const channelCounts = new Map();
  const duplicateMessages = userMessageList.filter((msg) => {
    channelCounts.set(
      msg.channelId,
      (channelCounts.get(msg.channelId) || 0) + 1
    );
    return msg.content === normalizedContent;
  }).length;

  // Check for spam conditions
  const isSpam = {
    crossChannelSpam: channelCounts.size >= MESSAGE_DUPLICATE_THRESHOLD,
    duplicateContent: duplicateMessages >= MESSAGE_DUPLICATE_THRESHOLD,
    linkSpam: false,
  };

  // Check for link spam
  for (const [link, count] of userLinkMap.entries()) {
    if (count >= LINK_DUPLICATE_THRESHOLD) {
      isSpam.linkSpam = true;
      break;
    }
  }

  // Get all messages involved in the spam pattern
  const spamMessages = userMessageList
    .filter((msg) => msg.content === normalizedContent)
    .map((msg) => ({
      channelId: msg.channelId,
      messageId: msg.messageId,
    }));

  return {
    isSpam,
    messageCount: userMessageList.length,
    uniqueChannels: channelCounts.size,
    duplicateCount: duplicateMessages,
    spamMessages, // Add list of messages to delete
  };
};

/**
 * Clean up tracking data for a user
 * @param {string} userId User ID
 * @param {string} guildId Guild ID
 */
export const cleanupUserData = (userId, guildId) => {
  const messageKey = createMessageKey(userId, guildId);
  userMessages.delete(messageKey);
  userLinks.delete(messageKey);
};
