/**
 * Validators - Input validation utilities
 * 
 * This module provides validation functions to ensure data integrity
 * and catch errors early with clear error messages.
 */
(function(global) {
  'use strict';

  class Validators {
    /**
     * Validate raw chunks structure
     * @param {Object} chunks - Raw chunks to validate
     * @returns {boolean} True if valid
     * @throws {Error} If invalid with descriptive message
     * 
     * @example
     * Validators.validateRawChunks({ workflow: {}, prompt: {} });
     * // Returns: true
     */
    static validateRawChunks(chunks) {
      if (!chunks || typeof chunks !== 'object') {
        throw new Error('Raw chunks must be an object');
      }
      
      if (Array.isArray(chunks)) {
        throw new Error('Raw chunks must be an object, not an array');
      }
      
      return true;
    }

    /**
     * Validate parsed metadata structure
     * @param {Object} metadata - Parsed metadata to validate
     * @returns {boolean} True if valid
     * @throws {Error} If invalid with descriptive message
     * 
     * @example
     * Validators.validateParsedMetadata({
     *   format: 'comfyui',
     *   checkpoint: 'model.safetensors',
     *   steps: 20
     * });
     * // Returns: true
     */
    /**
         * Validate parsed metadata structure
         * @param {Object} metadata - Parsed metadata to validate
         * @returns {boolean} True if valid
         * @throws {Error} If invalid with descriptive message
         * 
         * @example
         * Validators.validateParsedMetadata({
         *   format: 'comfyui',
         *   checkpoint: 'model.safetensors',
         *   steps: 20
         * });
         * // Returns: true
         */
        static validateParsedMetadata(metadata) {
          if (!metadata || typeof metadata !== 'object') {
            throw new Error('Parsed metadata must be an object');
          }

          if (Array.isArray(metadata)) {
            throw new Error('Parsed metadata must be an object, not an array');
          }

          // Format is required
          if (!metadata.format || typeof metadata.format !== 'string') {
            throw new Error('Parsed metadata must have a format string');
          }

          // Validate optional top-level fields if present
          // Note: We don't validate nested arrays like extra_samplers or generationSteps
          // as they have their own internal structure
          if ('checkpoint' in metadata && metadata.checkpoint !== null && typeof metadata.checkpoint !== 'string') {
            throw new Error('Checkpoint must be a string or null');
          }

          if ('loras' in metadata && metadata.loras !== null && !Array.isArray(metadata.loras)) {
            throw new Error('LoRAs must be an array or null');
          }

          if ('positive' in metadata && metadata.positive !== null && typeof metadata.positive !== 'string') {
            throw new Error('Positive prompt must be a string or null');
          }

          if ('negative' in metadata && metadata.negative !== null && typeof metadata.negative !== 'string') {
            throw new Error('Negative prompt must be a string or null');
          }

          // Only validate top-level seed, not nested ones in arrays
          if ('seed' in metadata && metadata.seed !== null && metadata.seed !== undefined && typeof metadata.seed !== 'number') {
            throw new Error('Seed must be a number or null');
          }

          if ('steps' in metadata && metadata.steps !== null && typeof metadata.steps !== 'number') {
            throw new Error('Steps must be a number or null');
          }

          if ('cfg' in metadata && metadata.cfg !== null && typeof metadata.cfg !== 'number') {
            throw new Error('CFG must be a number or null');
          }

          if ('sampler' in metadata && metadata.sampler !== null && typeof metadata.sampler !== 'string') {
            throw new Error('Sampler must be a string or null');
          }

          if ('scheduler' in metadata && metadata.scheduler !== null && typeof metadata.scheduler !== 'string') {
            throw new Error('Scheduler must be a string or null');
          }

          return true;
        }


    /**
     * Validate settings object
     * @param {Object} settings - Settings to validate
     * @returns {boolean} True if valid
     * @throws {Error} If invalid with descriptive message
     * 
     * @example
     * Validators.validateSettings({
     *   checkpoint: true,
     *   lora: true,
     *   chunkSize: 5
     * });
     * // Returns: true
     */
    static validateSettings(settings) {
      if (!settings || typeof settings !== 'object') {
        throw new Error('Settings must be an object');
      }
      
      if (Array.isArray(settings)) {
        throw new Error('Settings must be an object, not an array');
      }
      
      // Boolean fields
      const booleanFields = [
        'checkpoint', 'lora', 'positive', 'negative',
        'seed', 'sampler', 'steps', 'cfg', 
        'addTags', 'writeNotes', 'debug'
      ];
      
      for (const field of booleanFields) {
        if (field in settings && typeof settings[field] !== 'boolean') {
          throw new Error(`${field} must be a boolean`);
        }
      }
      
      // Number fields
      if ('chunkSize' in settings) {
        if (typeof settings.chunkSize !== 'number') {
          throw new Error('chunkSize must be a number');
        }
        if (settings.chunkSize < 1) {
          throw new Error('chunkSize must be at least 1');
        }
      }
      
      return true;
    }

    /**
     * Validate buffer
     * @param {Uint8Array} buffer - Buffer to validate
     * @param {number} minSize - Minimum required size (optional)
     * @returns {boolean} True if valid
     * @throws {Error} If invalid with descriptive message
     * 
     * @example
     * Validators.validateBuffer(new Uint8Array([1, 2, 3]), 2);
     * // Returns: true
     */
    static validateBuffer(buffer, minSize = 0) {
      if (!(buffer instanceof Uint8Array)) {
        throw new Error('Buffer must be a Uint8Array');
      }
      
      if (buffer.length < minSize) {
        throw new Error(`Buffer too small: ${buffer.length} bytes (minimum: ${minSize} bytes)`);
      }
      
      return true;
    }

    /**
     * Validate MIME type
     * @param {string} mimeType - MIME type to validate
     * @returns {boolean} True if valid
     * @throws {Error} If invalid with descriptive message
     * 
     * @example
     * Validators.validateMimeType('image/png');
     * // Returns: true
     */
    static validateMimeType(mimeType) {
      if (!mimeType || typeof mimeType !== 'string') {
        throw new Error('MIME type must be a non-empty string');
      }
      
      const validMimeTypes = ['image/png', 'image/webp', 'image/jpeg'];
      
      if (!validMimeTypes.includes(mimeType)) {
        throw new Error(`Unsupported MIME type: ${mimeType} (supported: ${validMimeTypes.join(', ')})`);
      }
      
      return true;
    }

    /**
     * Validate format name
     * @param {string} format - Format name to validate
     * @returns {boolean} True if valid
     * @throws {Error} If invalid with descriptive message
     * 
     * @example
     * Validators.validateFormat('comfyui');
     * // Returns: true
     */
    static validateFormat(format) {
      if (!format || typeof format !== 'string') {
        throw new Error('Format must be a non-empty string');
      }
      
      const validFormats = ['comfyui', 'a1111'];
      
      if (!validFormats.includes(format)) {
        throw new Error(`Unknown format: ${format} (known formats: ${validFormats.join(', ')})`);
      }
      
      return true;
    }
  }

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.Validators = Validators;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Validators;
  }
})(typeof window !== 'undefined' ? window : global);
