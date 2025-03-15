/**
 * Simple in-memory cache for Urban Dictionary definitions
 */
class DefinitionCache {
  constructor() {
    this.cache = new Map();
    this.TTL = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up expired entries every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Get a cached definition
   * @param {string} term - The term to look up
   * @returns {Object|null} Cached data or null if not found/expired
   */
  get(term) {
    const key = term.toLowerCase();
    const cached = this.cache.get(key);

    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Store definitions in cache
   * @param {string} term - The term being cached
   * @param {Array} definitions - Array of definition objects
   */
  set(term, definitions) {
    const key = term.toLowerCase();
    this.cache.set(key, {
      timestamp: Date.now(),
      data: definitions,
    });
  }

  /**
   * Remove expired cache entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached definitions
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const definitionCache = new DefinitionCache();
