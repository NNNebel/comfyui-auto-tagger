/**
 * ParsingUtils - Common parsing utilities used across multiple parsers
 * 
 * This module provides shared parsing operations to eliminate code duplication
 * and ensure consistent behavior across all metadata parsers.
 */
(function(global) {
  'use strict';

  class ParsingUtils {
    /**
     * Safely parse JSON with fallback value
     * @param {string} text - JSON text to parse
     * @param {*} fallback - Value to return on parse error (default: null)
     * @returns {*} Parsed JSON object or fallback value
     * 
     * @example
     * const data = ParsingUtils.parseJsonSafely('{"key": "value"}', {});
     * // Returns: { key: "value" }
     * 
     * const invalid = ParsingUtils.parseJsonSafely('invalid json', {});
     * // Returns: {}
     */
    static parseJsonSafely(text, fallback = null) {
      if (!text || typeof text !== 'string') {
        return fallback;
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error('JSON parse failed:', e.message);
        return fallback;
      }
    }

    /**
     * Convert string value to appropriate type (number, boolean, or string)
     * @param {string} value - String value to convert
     * @returns {string|number|boolean} Converted value
     * 
     * @example
     * ParsingUtils.parseValue('123')      // Returns: 123 (number)
     * ParsingUtils.parseValue('3.14')     // Returns: 3.14 (number)
     * ParsingUtils.parseValue('true')     // Returns: true (boolean)
     * ParsingUtils.parseValue('hello')    // Returns: 'hello' (string)
     */
    static parseValue(value) {
      if (typeof value !== 'string') {
        return value;
      }

      // Integer
      if (/^-?\d+$/.test(value)) {
        return parseInt(value, 10);
      }

      // Float
      if (/^-?\d+\.\d+$/.test(value)) {
        return parseFloat(value);
      }

      // Boolean
      if (value === 'True' || value === 'true') {
        return true;
      }
      if (value === 'False' || value === 'false') {
        return false;
      }

      // String (unchanged)
      return value;
    }

    /**
     * Extract filename from path (cross-platform)
     * @param {string} path - File path (Windows or Unix style)
     * @returns {string} Filename with extension
     * 
     * @example
     * ParsingUtils.extractFilename('C:\\models\\model.safetensors')
     * // Returns: 'model.safetensors'
     * 
     * ParsingUtils.extractFilename('/home/user/models/model.safetensors')
     * // Returns: 'model.safetensors'
     */
    static extractFilename(path) {
      if (!path || typeof path !== 'string') {
        return '';
      }
      return path.split(/[/\\]/).pop();
    }

    /**
     * Extract filename without extension
     * @param {string} path - File path
     * @returns {string} Filename without extension
     * 
     * @example
     * ParsingUtils.extractBaseName('model.safetensors')
     * // Returns: 'model'
     * 
     * ParsingUtils.extractBaseName('/path/to/model.ckpt')
     * // Returns: 'model'
     */
    static extractBaseName(path) {
      const filename = this.extractFilename(path);
      return filename.replace(/\.[^/\\.]+$/, '');
    }

    /**
     * Split text into lines, handling different line endings
     * @param {string} text - Text to split
     * @returns {Array<string>} Array of lines
     * 
     * @example
     * ParsingUtils.splitLines('line1\nline2\rline3\r\nline4')
     * // Returns: ['line1', 'line2', 'line3', 'line4']
     */
    static splitLines(text) {
      if (!text || typeof text !== 'string') {
        return [];
      }
      // Handle CRLF, LF, and CR line endings
      return text.split(/\r\n|\r|\n/);
    }

    /**
     * Parse key-value pairs from text
     * @param {string} text - Text containing "key: value" pairs
     * @param {string} separator - Pair separator (default: ',')
     * @returns {Object} Parsed key-value pairs
     * 
     * @example
     * ParsingUtils.parseKeyValuePairs('Steps: 20, Sampler: Euler, CFG: 7')
     * // Returns: { Steps: '20', Sampler: 'Euler', CFG: '7' }
     */
    static parseKeyValuePairs(text, separator = ',') {
      const pairs = {};
      
      if (!text || typeof text !== 'string') {
        return pairs;
      }

      const items = text.split(separator).map(s => s.trim());
      
      for (const item of items) {
        const colonIndex = item.indexOf(':');
        if (colonIndex === -1) continue;
        
        const key = item.substring(0, colonIndex).trim();
        const value = item.substring(colonIndex + 1).trim();
        
        if (key) {
          pairs[key] = value;
        }
      }
      
      return pairs;
    }
  }

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.ParsingUtils = ParsingUtils;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ParsingUtils;
  }
})(typeof window !== 'undefined' ? window : global);
