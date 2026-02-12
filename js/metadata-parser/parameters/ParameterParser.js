/**
 * ParameterParser.js - Parses A1111 parameter lines using registered handlers
 * Universal module (Browser + Node.js)
 */
(function(global) {
  'use strict';

/**
 * ParameterParser - Parses A1111 parameter lines using a handler system
 * 
 * This class provides an extensible way to parse A1111 parameter lines.
 * Handlers can be registered to process specific parameter types.
 * 
 * @example
 * const parser = new ParameterParser();
 * parser.registerHandler(new StandardParameterHandler());
 * parser.registerHandler(new LoraHashHandler());
 * 
 * const result = parser.parse("Steps: 20, Sampler: Euler a, CFG scale: 7");
 * // Returns: { steps: 20, sampler: 'Euler a', cfg: 7 }
 */
class ParameterParser {
  constructor() {
    /**
     * Registered parameter handlers
     * @type {Array<ParameterHandler>}
     */
    this.handlers = [];
  }
  
  /**
   * Register a parameter handler
   * Handlers are sorted by priority (lower = higher priority)
   * @param {ParameterHandler} handler - Handler to register
   */
  registerHandler(handler) {
    if (!handler || typeof handler.canHandle !== 'function' || typeof handler.handle !== 'function') {
      throw new Error('Handler must implement canHandle() and handle() methods');
    }
    
    this.handlers.push(handler);
    
    // Sort handlers by priority (lower = higher priority)
    this.handlers.sort((a, b) => {
      const priorityA = typeof a.getPriority === 'function' ? a.getPriority() : 100;
      const priorityB = typeof b.getPriority === 'function' ? b.getPriority() : 100;
      return priorityA - priorityB;
    });
  }
  
  /**
   * Parse parameter line into structured metadata
   * @param {string} line - Parameter line (e.g., "Steps: 20, Sampler: Euler a, ...")
   * @param {Object} [context={}] - Parsing context (e.g., prompts for LoRA extraction)
   * @returns {Object} Structured metadata object
   */
  parse(line, context = {}) {
    if (!line || typeof line !== 'string') {
      return {};
    }
    
    // Tokenize the line into key-value pairs
    const pairs = this._tokenize(line);
    
    // Parse each pair using registered handlers
    const result = {};
    
    for (const pair of pairs) {
      const { key, value } = this._parsePair(pair);
      if (!key) continue;
      
      // Find handler for this key
      const handler = this._findHandler(key);
      if (!handler) continue;
      
      // Handle the parameter
      const parsed = handler.handle(key, value, context);
      
      // Merge result
      this._mergeResult(result, parsed);
    }
    
    return result;
  }
  
  /**
   * Tokenize parameter line into key-value pairs
   * Splits by comma, respecting quoted values
   * @private
   * @param {string} line - Parameter line
   * @returns {Array<string>} Array of parameter pair strings
   */
  _tokenize(line) {
    const pairs = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = null;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      // Handle quotes
      if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = null;
        }
        current += char;
      }
      // Handle comma separator (only outside quotes)
      else if (char === ',' && !inQuotes) {
        if (current.trim()) {
          pairs.push(current.trim());
        }
        current = '';
      }
      // Regular character
      else {
        current += char;
      }
    }
    
    // Add last pair
    if (current.trim()) {
      pairs.push(current.trim());
    }
    
    return pairs;
  }
  
  /**
   * Parse a key-value pair string
   * @private
   * @param {string} pair - Pair string (e.g., "Steps: 20")
   * @returns {{key: string, value: string}} Parsed key and value
   */
  _parsePair(pair) {
    const colonIndex = pair.indexOf(':');
    if (colonIndex === -1) {
      return { key: null, value: null };
    }
    
    const key = pair.substring(0, colonIndex).trim();
    let value = pair.substring(colonIndex + 1).trim();
    
    // Remove quotes from value
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    return { key, value };
  }
  
  /**
   * Find handler for a given key
   * Returns first handler that can handle the key (handlers are sorted by priority)
   * @private
   * @param {string} key - Parameter key
   * @returns {ParameterHandler|null} Handler or null if none found
   */
  _findHandler(key) {
    for (const handler of this.handlers) {
      if (handler.canHandle(key)) {
        return handler;
      }
    }
    return null;
  }
  
  /**
   * Merge parsed result into target object
   * Handles nested objects (e.g., adetailer) by deep merging
   * @private
   * @param {Object} target - Target object to merge into
   * @param {Object} source - Source object to merge from
   */
  _mergeResult(target, source) {
    for (const key in source) {
      if (!source.hasOwnProperty(key)) continue;
      
      const sourceValue = source[key];
      
      // If both are objects (and not arrays), deep merge
      if (target[key] && 
          typeof target[key] === 'object' && 
          !Array.isArray(target[key]) &&
          typeof sourceValue === 'object' && 
          !Array.isArray(sourceValue)) {
        this._mergeResult(target[key], sourceValue);
      }
      // Otherwise, overwrite or set
      else {
        target[key] = sourceValue;
      }
    }
  }
}

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.ParameterParser = ParameterParser;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ParameterParser;
  }

})(typeof window !== 'undefined' ? window : global);
