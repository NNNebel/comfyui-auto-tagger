// js/metadata-parser/integration/MetadataService.js
// Universal module (Browser + Node.js)
(function(global) {
  'use strict';

  // Get dependencies for both environments
  var ImageMetadataReader, FormatDetector, ParserRegistry, ComfyUIParser, A1111Parser, ErrorHandler, Validators;
  
  if (typeof window !== 'undefined') {
    // Browser environment
    ImageMetadataReader = window.ImageMetadataReader;
    FormatDetector = window.FormatDetector;
    ParserRegistry = window.ParserRegistry;
    ComfyUIParser = window.ComfyUIParser;
    A1111Parser = window.A1111Parser;
    ErrorHandler = window.ErrorHandler;
    Validators = window.Validators;
  } else if (typeof require !== 'undefined') {
    // Node.js environment
    ImageMetadataReader = require('../binary-extraction/ImageMetadataReader');
    FormatDetector = require('../binary-extraction/FormatDetector');
    ParserRegistry = require('../parsers/ParserRegistry');
    ComfyUIParser = require('../parsers/ComfyUIParser');
    A1111Parser = require('../parsers/A1111Parser');
    ErrorHandler = require('../utils/ErrorHandler').ErrorHandler;
    Validators = require('../utils/Validators');
  } else {
    throw new Error('Dependencies not found');
  }

/**
 * MetadataService
 * 
 * Orchestrates the metadata parsing pipeline and provides a clean API for Eagle integration.
 * This service coordinates the binary extraction, format detection, and parsing layers.
 * 
 * Implements Requirements 2.2, 2.3, and 2.4:
 * - 2.2: Parser registration mechanism
 * - 2.3: Delegation to appropriate format-specific parser
 * - 2.4: Support for multiple parser implementations
 */
class MetadataService {
  /**
   * Create a new MetadataService instance.
   * Initializes the parser registry and registers all available parsers.
   */
  constructor() {
    /**
     * Parser registry for managing format-specific parsers
     * @type {ParserRegistry}
     */
    this.registry = new ParserRegistry();
    this.initializeParsers();
  }

  /**
   * Initialize and register all available parsers.
   * This method registers ComfyUI and A1111 parsers by default.
   * Additional parsers can be registered by extending this method.
   * @private
   */
  initializeParsers() {
    this.registry.register(new ComfyUIParser());
    this.registry.register(new A1111Parser());
  }

  /**
   * Extract and parse metadata from image buffer.
   * 
   * This method orchestrates the complete parsing pipeline:
   * 1. Extract raw metadata chunks from the image buffer
   * 2. Detect which metadata formats are present
   * 3. Parse all detected formats using registered parsers
   * 
   * @param {Uint8Array} buffer - Image file buffer
   * @param {string} mimeType - Image MIME type ('image/png' or 'image/webp')
   * @returns {Array<ParsedMetadata>} Array of parsed metadata from all detected formats
   * 
   * @example
   * const service = new MetadataService();
   * const buffer = await fs.readFile('image.png');
   * const results = service.extractMetadata(buffer, 'image/png');
   * results.forEach(metadata => {
   *   console.log(`Format: ${metadata.format}`);
   *   console.log(`Checkpoint: ${metadata.checkpoint}`);
   * });
   */
  extractMetadata(buffer, mimeType) {
    return ErrorHandler.safeExecute(
      () => {
        // Validate inputs
        Validators.validateBuffer(buffer);
        Validators.validateMimeType(mimeType);
        
        // Step 1: Extract raw chunks from the image
        const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, mimeType);
        
        // Validate raw chunks
        Validators.validateRawChunks(rawChunks);
        
        // Step 2: Detect which formats are present
        const formats = FormatDetector.detectFormats(rawChunks);
        
        // Step 3: Parse all detected formats
        const results = this.registry.parseAll(formats, rawChunks);
        
        return results;
      },
      [],
      'MetadataService',
      { mimeType, bufferSize: buffer.length }
    );
  }

  /**
   * Extract metadata and prefer a specific format.
   * 
   * This method extracts metadata from all detected formats but returns
   * the result from the preferred format if available. If the preferred
   * format is not found, it falls back to the first available format.
   * 
   * This is useful for maintaining backward compatibility where ComfyUI
   * format is preferred, but other formats can be used as fallback.
   * 
   * @param {Uint8Array} buffer - Image file buffer
   * @param {string} mimeType - Image MIME type ('image/png' or 'image/webp')
   * @param {string} [preferredFormat='comfyui'] - Preferred format name (e.g., 'comfyui', 'a1111')
   * @returns {ParsedMetadata|null} Parsed metadata from preferred format, or first available, or null if no metadata found
   * 
   * @example
   * const service = new MetadataService();
   * const buffer = await fs.readFile('image.png');
   * 
   * // Try to get ComfyUI metadata first, fall back to any other format
   * const metadata = service.extractPreferredMetadata(buffer, 'image/png', 'comfyui');
   * if (metadata) {
   *   console.log(`Using ${metadata.format} format`);
   *   console.log(`Checkpoint: ${metadata.checkpoint}`);
   * } else {
   *   console.log('No metadata found');
   * }
   */
  extractPreferredMetadata(buffer, mimeType, preferredFormat = 'comfyui') {
    return ErrorHandler.safeExecute(
      () => {
        // Validate inputs
        Validators.validateBuffer(buffer);
        Validators.validateMimeType(mimeType);
        Validators.validateFormat(preferredFormat);
        
        const results = this.extractMetadata(buffer, mimeType);
        
        // Try preferred format first
        const preferred = results.find(r => r.format === preferredFormat);
        if (preferred) return preferred;
        
        // Fall back to first available
        return results.length > 0 ? results[0] : null;
      },
      null,
      'MetadataService',
      { mimeType, preferredFormat, bufferSize: buffer.length }
    );
  }
}

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.MetadataService = MetadataService;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetadataService;
  }

})(typeof window !== 'undefined' ? window : global);

