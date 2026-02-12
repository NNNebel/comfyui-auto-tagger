// js/metadata-parser/parsers/ParserRegistry.js
// Universal module (Browser + Node.js)
(function(global) {
  'use strict';

/**
 * ParserRegistry manages parser registration and delegation.
 * It maintains a registry of format-specific parsers and delegates parsing
 * requests to the appropriate parser based on the format name.
 * 
 * This class implements Requirements 2.2, 2.3, 2.4, and 2.5:
 * - 2.2: Parser registration mechanism
 * - 2.3: Delegation to appropriate format-specific parser
 * - 2.4: Support for multiple parser implementations
 * - 2.5: Graceful error handling when parsers fail
 */
class ParserRegistry {
  /**
   * Create a new ParserRegistry instance.
   * Initializes an empty parser registry.
   */
  constructor() {
    /**
     * Map of format names to parser instances
     * @type {Map<string, MetadataParser>}
     */
    this.parsers = new Map();
  }

  /**
   * Register a parser for a specific format.
   * The parser's format name (from getFormatName()) is used as the registry key.
   * 
   * @param {MetadataParser} parser - Parser instance implementing MetadataParser interface
   * @throws {Error} If parser is null/undefined or doesn't implement getFormatName()
   * 
   * @example
   * const registry = new ParserRegistry();
   * const comfyParser = new ComfyUIParser();
   * registry.register(comfyParser);
   */
  register(parser) {
    if (!parser) {
      throw new Error('Parser cannot be null or undefined');
    }

    try {
      const formatName = parser.getFormatName();
      if (!formatName || typeof formatName !== 'string') {
        throw new Error('Parser must return a valid format name from getFormatName()');
      }
      this.parsers.set(formatName, parser);
    } catch (error) {
      console.error('Failed to register parser:', error);
      throw error;
    }
  }

  /**
   * Parse metadata using the appropriate parser for the specified format.
   * 
   * This method implements error isolation (Requirement 2.5):
   * - If no parser is registered for the format, logs a warning and returns null
   * - If the parser throws an error, catches it, logs it, and returns null
   * - This allows other parsers to continue operation even if one fails
   * 
   * @param {string} format - Format name (e.g., 'comfyui', 'a1111')
   * @param {Object} rawChunks - Raw metadata chunks from ImageMetadataReader
   * @param {Object} [options={}] - Parser-specific options
   * @returns {ParsedMetadata|null} Parsed metadata or null if parser not found or parsing failed
   * 
   * @example
   * const metadata = registry.parse('comfyui', rawChunks, { suspiciousNodeHandling: 'exclude' });
   * if (metadata) {
   *   console.log('Checkpoint:', metadata.checkpoint);
   * }
   */
  parse(format, rawChunks, options = {}) {
    const parser = this.parsers.get(format);
    if (!parser) {
      console.warn(`No parser registered for format: ${format}`);
      return null;
    }

    try {
      return parser.parse(rawChunks, options);
    } catch (error) {
      console.error(`Parser error for format ${format}:`, error);
      return null;
    }
  }

  /**
   * Parse all detected formats and return results.
   * 
   * This method attempts to parse metadata for each detected format.
   * Failed parsers return null and are filtered out, allowing successful
   * parsers to return their results (Requirement 2.5).
   * 
   * @param {Array<string>} formats - Array of detected format names
   * @param {Object} rawChunks - Raw metadata chunks from ImageMetadataReader
   * @param {Object} [options={}] - Parser-specific options
   * @returns {Array<ParsedMetadata>} Array of successfully parsed metadata (may be empty)
   * 
   * @example
   * const formats = ['comfyui', 'a1111'];
   * const results = registry.parseAll(formats, rawChunks, { suspiciousNodeHandling: 'exclude' });
   * // results may contain 0, 1, or 2 ParsedMetadata objects
   * results.forEach(metadata => {
   *   console.log(`Format: ${metadata.format}`);
   * });
   */
  parseAll(formats, rawChunks, options = {}) {
    return formats
      .map(format => this.parse(format, rawChunks, options))
      .filter(result => result !== null);
  }
}

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.ParserRegistry = ParserRegistry;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ParserRegistry;
  }

})(typeof window !== 'undefined' ? window : global);
