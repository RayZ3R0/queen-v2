import fetch from "node-fetch";

const URBAN_API_URL = "https://api.urbandictionary.com/v0";

/**
 * Fetches definitions for a term from the Urban Dictionary API
 * @param {string} term - The term to search for
 * @returns {Promise<Array>} Array of definition objects
 * @throws {Error} If the API request fails
 */
export const searchTerm = async (term) => {
  try {
    const response = await fetch(
      `${URBAN_API_URL}/define?term=${encodeURIComponent(term)}`
    );

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.list || [];
  } catch (error) {
    console.error("Urban Dictionary API error:", error);
    throw new Error("Failed to fetch definitions");
  }
};

/**
 * Fetches autocomplete suggestions for a term
 * @param {string} term - The partial term to get suggestions for
 * @returns {Promise<Array<string>>} Array of suggested terms
 */
export const getAutoComplete = async (term) => {
  try {
    const response = await fetch(
      `${URBAN_API_URL}/autocomplete?term=${encodeURIComponent(term)}`
    );

    if (!response.ok) {
      return [];
    }

    const suggestions = await response.json();
    return suggestions.slice(0, 25); // Limit to 25 suggestions
  } catch (error) {
    console.error("Urban Dictionary autocomplete error:", error);
    return [];
  }
};

/**
 * Formats definition content, applying length limits and formatting
 * @param {string} text - The text to format
 * @param {number} maxLength - Maximum length for the text
 * @returns {string} Formatted text
 */
export const formatContent = (text, maxLength = 1024) => {
  if (!text) return "No content available";

  // Remove excessive newlines and spaces
  let formatted = text.replace(/\n{3,}/g, "\n\n").trim();

  // Truncate if too long
  if (formatted.length > maxLength) {
    formatted = formatted.substring(0, maxLength - 3) + "...";
  }

  // Discord markdown escape
  formatted = formatted
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/~/g, "\\~")
    .replace(/>/g, "\\>");

  return formatted;
};

/**
 * Formats a date string into a relative time format
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

/**
 * Filters potentially inappropriate content
 * @param {Object} definition - The definition object
 * @returns {boolean} True if the content is safe
 */
export const isContentSafe = (definition) => {
  // Basic content filtering - can be expanded
  const unsafePatterns = [
    /nsfw/i,
    /trigger warning/i,
    // Add more patterns as needed
  ];

  const contentToCheck =
    `${definition.word} ${definition.definition} ${definition.example}`.toLowerCase();
  return !unsafePatterns.some((pattern) => pattern.test(contentToCheck));
};
