import sharp from "sharp";
import { EmbedBuilder } from "discord.js";
import axios from "axios";

export async function processImage(input, options = {}) {
  try {
    const { maxSize = 256 * 1024, format = "png" } = options; // 256KB default limit

    // Process the image
    let image = sharp(input);

    // Get image metadata
    const metadata = await image.metadata();

    // Convert to PNG and optimize
    image = image.toFormat(format, {
      quality: 100,
      effort: 10, // Maximum compression effort
    });

    // If image is too large, resize while maintaining aspect ratio
    let buffer = await image.toBuffer();
    if (buffer.length > maxSize) {
      const scale = Math.sqrt(maxSize / buffer.length);
      const newWidth = Math.floor(metadata.width * scale);
      const newHeight = Math.floor(metadata.height * scale);

      image = image.resize(newWidth, newHeight, {
        fit: "inside",
        withoutEnlargement: true,
      });

      buffer = await image.toBuffer();

      // If still too large, reduce quality
      if (buffer.length > maxSize) {
        image = image.toFormat(format, {
          quality: 80, // Reduce quality
          effort: 10,
        });
        buffer = await image.toBuffer();
      }
    }

    return buffer;
  } catch (error) {
    console.error("Error processing image:", error);
    throw error;
  }
}

export async function downloadImage(url) {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      validateStatus: (status) => status === 200,
    });

    // Validate content type
    const contentType = response.headers["content-type"];
    if (!contentType.startsWith("image/")) {
      throw new Error("URL does not point to a valid image");
    }

    return Buffer.from(response.data);
  } catch (error) {
    console.error("Error downloading image:", error);
    throw error;
  }
}

export function createErrorEmbed(message) {
  return new EmbedBuilder()
    .setColor("Red")
    .setTitle("❌ Error")
    .setDescription(message)
    .setTimestamp();
}

export function createSuccessEmbed(message) {
  return new EmbedBuilder()
    .setColor("Green")
    .setTitle("✅ Success")
    .setDescription(message)
    .setTimestamp();
}

export function validateImageUrl(url) {
  try {
    const parsed = new URL(url);
    const extension = parsed.pathname.split(".").pop().toLowerCase();
    const validExtensions = ["png", "jpg", "jpeg", "gif", "webp"];

    if (!validExtensions.includes(extension)) {
      throw new Error(
        "Invalid image format. Supported formats: PNG, JPG, GIF, WebP"
      );
    }

    return true;
  } catch (error) {
    throw new Error("Invalid URL format");
  }
}
