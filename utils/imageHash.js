import sharp from "sharp";
import axios from "axios";

/**
 * Calculate perceptual hash (pHash) for an image
 * This creates a fingerprint that can detect similar images even if they're modified
 * @param {Buffer|string} input - Image buffer or URL
 * @returns {Promise<string>} - Perceptual hash as hex string
 */
export async function calculatePerceptualHash(input) {
  try {
    let imageBuffer;

    // If input is a URL, download it first
    if (typeof input === "string") {
      const response = await axios.get(input, {
        responseType: "arraybuffer",
        timeout: 10000,
        maxContentLength: 50 * 1024 * 1024, // 50MB max
        validateStatus: (status) => status === 200,
      });

      // Validate content type
      const contentType = response.headers["content-type"];
      if (!contentType || !contentType.startsWith("image/")) {
        throw new Error("URL does not point to a valid image");
      }

      imageBuffer = Buffer.from(response.data);
    } else {
      imageBuffer = input;
    }

    // Resize to 8x8 grayscale image (standard for pHash)
    const resized = await sharp(imageBuffer)
      .resize(8, 8, {
        fit: "fill",
        kernel: sharp.kernel.nearest,
      })
      .grayscale()
      .raw()
      .toBuffer();

    // Calculate average pixel value
    let sum = 0;
    for (let i = 0; i < resized.length; i++) {
      sum += resized[i];
    }
    const average = sum / resized.length;

    // Create hash based on whether each pixel is above or below average
    let hash = 0n;
    for (let i = 0; i < resized.length; i++) {
      if (resized[i] > average) {
        hash |= 1n << BigInt(i);
      }
    }

    // Convert to hex string
    return hash.toString(16).padStart(16, "0");
  } catch (error) {
    console.error("Error calculating perceptual hash:", error);
    throw error;
  }
}

/**
 * Calculate Hamming distance between two perceptual hashes
 * Lower distance = more similar images
 * @param {string} hash1 - First hash (hex string)
 * @param {string} hash2 - Second hash (hex string)
 * @returns {number} - Hamming distance (0-64, lower is more similar)
 */
export function hammingDistance(hash1, hash2) {
  if (!hash1 || !hash2) return 64;

  const num1 = BigInt("0x" + hash1);
  const num2 = BigInt("0x" + hash2);
  const xor = num1 ^ num2;

  // Count number of 1s in XOR result
  let distance = 0;
  let n = xor;
  while (n > 0n) {
    distance++;
    n &= n - 1n;
  }

  return distance;
}

/**
 * Check if two images are similar based on their perceptual hashes
 * @param {string} hash1 - First hash
 * @param {string} hash2 - Second hash
 * @param {number} threshold - Maximum hamming distance to consider a match (default: 5)
 * @returns {boolean} - True if images are similar
 */
export function areImagesSimilar(hash1, hash2, threshold = 5) {
  const distance = hammingDistance(hash1, hash2);
  return distance <= threshold;
}

/**
 * Extract direct image URLs from message content
 * Returns URLs that end with image extensions
 * @param {string} content - Message content
 * @returns {string[]} - Array of direct image URLs
 */
export function extractDirectImageUrls(content) {
  if (!content) return [];

  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
  const urlRegex = /https?:\/\/[^\s\[\]()]+/gi;
  const urls = content.match(urlRegex) || [];

  return urls.filter((url) => {
    const lowerUrl = url.toLowerCase();
    // Check if URL ends with an image extension (before query params)
    const urlWithoutQuery = lowerUrl.split("?")[0];
    return imageExtensions.some((ext) => urlWithoutQuery.endsWith(ext));
  });
}

/**
 * Validate if a URL is a direct image URL
 * @param {string} url - URL to validate
 * @returns {boolean} - True if it's a direct image URL
 */
export function isDirectImageUrl(url) {
  if (!url) return false;
  const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
  const lowerUrl = url.toLowerCase();
  const urlWithoutQuery = lowerUrl.split("?")[0];
  return imageExtensions.some((ext) => urlWithoutQuery.endsWith(ext));
}
