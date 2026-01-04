import sharp from "sharp";
import axios from "axios";

/**
 * Calculate perceptual hash (pHash) for an image
 * This creates a fingerprint that can detect similar images even if they're modified
 * Uses 16x16 resolution for better resistance to compression
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

    // Resize to 16x16 grayscale image (larger for better Discord compression resistance)
    const size = 16;
    const resized = await sharp(imageBuffer)
      .resize(size, size, {
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
    // Split into chunks since we need 256 bits
    const chunks = [];
    for (let chunk = 0; chunk < 4; chunk++) {
      let hash = 0n;
      for (let i = 0; i < 64; i++) {
        const idx = chunk * 64 + i;
        if (resized[idx] > average) {
          hash |= 1n << BigInt(i);
        }
      }
      chunks.push(hash.toString(16).padStart(16, "0"));
    }

    // Combine all chunks into one hex string
    return chunks.join("");
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
 * @returns {number} - Hamming distance (0-256 for 16x16, lower is more similar)
 */
export function hammingDistance(hash1, hash2) {
  if (!hash1 || !hash2) return 256;
  
  // If hashes are different lengths, they're incompatible (old vs new format)
  if (hash1.length !== hash2.length) return 256;
  
  // For 16x16 hashes (256 bits split into 4 chunks of 64 bits)
  let distance = 0;
  
  // Process in 16-character chunks (64 bits each)
  for (let i = 0; i < hash1.length; i += 16) {
    const chunk1 = hash1.substring(i, i + 16);
    const chunk2 = hash2.substring(i, i + 16);
    
    // Skip empty chunks (shouldn't happen with proper length check, but safety)
    if (!chunk1 || !chunk2) continue;
    
    const num1 = BigInt("0x" + chunk1);
    const num2 = BigInt("0x" + chunk2);
    const xor = num1 ^ num2;

    // Count number of 1s in XOR result
    let n = xor;
    while (n > 0n) {
      distance++;
      n &= n - 1n;
    }
  }

  return distance;
}

/**
 * Check if two images are similar based on their perceptual hashes
 * @param {string} hash1 - First hash
 * @param {string} hash2 - Second hash
 * @param {number} threshold - Maximum hamming distance to consider a match (default: 15 for 16x16)
 * @returns {boolean} - True if images are similar
 */
export function areImagesSimilar(hash1, hash2, threshold = 15) {
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
