/**
 * Utility functions for social media embed fixing
 * Inspired by seriaati/embed-fixer
 */

export const ALLOWED_CHANNELS = ["912942764000419850", "901338500383789056"];

/**
 * Sanitizes a username for Discord Webhook usage.
 * Discord rejects usernames containing "discord" or "clyde".
 * @param {string} username
 * @returns {string}
 */
export function sanitizeUsername(username) {
  if (!username || typeof username !== "string") return "User";
  let sanitized = username
    .replace(/discord/gi, "discorɗ")
    .replace(/clyde/gi, "clydė")
    .trim();

  if (sanitized.length < 2) sanitized = `${sanitized}_`;
  if (sanitized.length > 80) sanitized = sanitized.slice(0, 80);
  return sanitized;
}

/**
 * Extracts candidate URLs from message text along with spoiler info.
 * Explicitly ignores URLs wrapped in < > (which suppresses embeds in Discord)
 * and URLs preceded by $.
 * @param {string} text
 * @returns {Array<{ url: string, spoilered: boolean, raw: string }>}
 */
export function extractFixableUrls(text) {
  if (!text || typeof text !== "string") return [];

  // 1. Extract spoilered URLs: ||https://...||
  const spoilerRegex = /\|\|(https?:\/\/[^\s|]+)\|\|/g;
  const spoileredMatches = [];
  let match;
  while ((match = spoilerRegex.exec(text)) !== null) {
    spoileredMatches.push({ url: match[1], spoilered: true, raw: match[0] });
  }

  // 2. Remove spoilered URLs to prevent double matching
  const textWithoutSpoilers = text.replace(spoilerRegex, " ");

  // 3. Extract regular URLs not surrounded by < > and not preceded by $
  const regularRegex = /(?<![<$])(https?:\/\/[^\s>]+)(?![>])/g;
  const regularMatches = [];
  while ((match = regularRegex.exec(textWithoutSpoilers)) !== null) {
    regularMatches.push({ url: match[1], spoilered: false, raw: match[0] });
  }

  return [...spoileredMatches, ...regularMatches];
}

/**
 * Returns the fixed replacement URL for a given social media URL, or null if not applicable.
 * @param {string} rawUrl
 * @returns {string | null}
 */
export function getFixedUrl(rawUrl) {
  let urlObj;
  try {
    urlObj = new URL(rawUrl);
  } catch {
    return null;
  }

  const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, "");
  const pathname = urlObj.pathname;

  // 1. Twitter / X
  if (hostname === "twitter.com" && pathname.includes("/status/")) {
    return `https://fxtwitter.com${pathname}`;
  }
  if (hostname === "x.com" && pathname.includes("/status/")) {
    return `https://fixupx.com${pathname}`;
  }

  // 2. Instagram (posts, reels, shares)
  if (hostname === "instagram.com" && /\/(p|reels?|share)\//.test(pathname)) {
    return `https://ddinstagram.com${pathname}`;
  }

  // 3. TikTok
  if (hostname === "tiktok.com" || hostname === "vm.tiktok.com" || hostname === "vt.tiktok.com") {
    if (hostname.startsWith("vm.") || hostname.startsWith("vt.")) {
      return `https://vxtiktok.com${pathname}`;
    }
    if (pathname.includes("/video/") || pathname.startsWith("/t/")) {
      return `https://tnktok.com${pathname}`;
    }
    return `https://tnktok.com${pathname}`;
  }

  // 4. Reddit
  if ((hostname === "reddit.com" || hostname === "old.reddit.com") && (pathname.includes("/comments/") || pathname.includes("/s/"))) {
    return `https://rxddit.com${pathname}`;
  }

  // 5. Bluesky
  if (hostname === "bsky.app" && pathname.includes("/post/")) {
    return `https://bskx.app${pathname}`;
  }

  // 6. Pixiv
  if (hostname === "pixiv.net" && pathname.includes("/artworks/")) {
    return `https://phixiv.net${pathname}`;
  }

  // 7. Threads
  if (hostname === "threads.net" && pathname.includes("/post/")) {
    return `https://fixthreads.net${pathname}`;
  }

  // 8. Twitch Clips
  if (hostname === "clips.twitch.tv") {
    return `https://fxtwitch.seria.moe/clip${pathname}`;
  }
  if (hostname === "twitch.tv" && pathname.includes("/clip/")) {
    return `https://fxtwitch.seria.moe${pathname}`;
  }

  // 9. FurAffinity
  if (hostname === "furaffinity.net" && pathname.includes("/view/")) {
    return `https://xfuraffinity.net${pathname}`;
  }

  // 10. Tumblr
  if (hostname === "tumblr.com" && /^\/[a-zA-Z0-9_\-]+\/\d+/.test(pathname)) {
    return `https://tpmblr.com${pathname}`;
  }

  // 11. Facebook Reels
  if ((hostname === "facebook.com" || hostname === "web.facebook.com") && (pathname.includes("/reel/") || pathname.includes("/share/r/"))) {
    return `https://facebed.seria.moe${pathname}`;
  }

  return null;
}

/**
 * Checks a message content and replaces all fixable URLs.
 * Returns null if no URLs were fixed.
 * @param {string} content
 * @returns {{ fixedContent: string, count: number } | null}
 */
export function processMessageContent(content) {
  const extracted = extractFixableUrls(content);
  if (extracted.length === 0) return null;

  let count = 0;
  let fixedContent = content;

  for (const item of extracted) {
    const fixed = getFixedUrl(item.url);
    if (!fixed) continue;

    if (item.spoilered) {
      fixedContent = fixedContent.replace(`||${item.url}||`, `||${fixed}||`);
    } else {
      fixedContent = fixedContent.replace(item.url, fixed);
    }
    count++;
  }

  if (count === 0) return null;
  return { fixedContent, count };
}
