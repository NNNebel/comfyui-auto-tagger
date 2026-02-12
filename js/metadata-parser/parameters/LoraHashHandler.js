/**
 * LoraHashHandler.js - Handles "Lora hashes" parameter
 * Universal module (Browser + Node.js)
 */
(function(global) {
  'use strict';

  // Get dependencies for both environments
  var ParameterHandler;
  
  if (typeof window !== 'undefined') {
    // Browser environment
    ParameterHandler = window.ParameterHandler;
  } else if (typeof require !== 'undefined') {
    // Node.js environment (testing)
    ParameterHandler = require('./ParameterHandler');
  } else {
    throw new Error('Required dependencies not found');
  }

/**
 * LoraHashHandler - Handles "Lora hashes" parameter
 * 
 * Parses format: "name1: hash1, name2: hash2, ..."
 * Extracts LoRA names and their hashes into structured format.
 * 
 * @example
 * Input: "Lora hashes: myLora: abc123, anotherLora: def456"
 * Output: {
 *   lora_hashes: { myLora: "abc123", anotherLora: "def456" },
 *   loras: ["myLora", "anotherLora"]
 * }
 */
class LoraHashHandler extends ParameterHandler {
  /**
   * Check if this handler can process the given parameter key
   * @param {string} key - Parameter key
   * @returns {boolean} True if key is "Lora hashes"
   */
  canHandle(key) {
    return key === 'Lora hashes';
  }
  
  /**
   * Handle Lora hashes parameter
   * @param {string} key - Parameter key
   * @param {string} value - Parameter value (format: "name1: hash1, name2: hash2")
   * @param {Object} context - Parsing context
   * @returns {Object} Structured metadata with lora_hashes and loras
   */
  handle(key, value, context) {
    const loraHashes = {};
    const loras = [];
    
    // Parse "name1: hash1, name2: hash2" format
    // Match: name (non-colon chars), colon, hash (non-comma chars, trimmed)
    const loraMatches = value.matchAll(/([^:,]+):\s*([^,]+?)(?=\s*,|$)/g);
    
    for (const match of loraMatches) {
      const name = match[1].trim();
      const hash = match[2].trim();
      
      if (name && hash) {
        loraHashes[name] = hash;
        if (!loras.includes(name)) {
          loras.push(name);
        }
      }
    }
    
    const result = {};
    if (Object.keys(loraHashes).length > 0) {
      result.lora_hashes = loraHashes;
    }
    if (loras.length > 0) {
      result.loras = loras;
    }
    
    return result;
  }
  
  /**
   * Get handler priority
   * @returns {number} Priority value (20 = medium-high priority)
   */
  getPriority() {
    return 20;
  }
}

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.LoraHashHandler = LoraHashHandler;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoraHashHandler;
  }

})(typeof window !== 'undefined' ? window : global);
