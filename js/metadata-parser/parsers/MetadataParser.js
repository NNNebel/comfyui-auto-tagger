/**
 * @typedef {Object} ParsedMetadata
 * @property {string} format - Format name ('comfyui', 'a1111')
 * @property {string} [checkpoint] - Model/checkpoint name
 * @property {Array<string>} [loras] - LoRA names
 * @property {string} [positive] - Positive prompt
 * @property {string} [negative] - Negative prompt
 * @property {number} [seed] - Generation seed
 * @property {number} [steps] - Sampling steps
 * @property {number} [cfg] - CFG scale
 * @property {string} [sampler] - Sampler name
 * @property {string} [scheduler] - Scheduler name
 * @property {Array<Object>} [extra_samplers] - Additional sampler info (ComfyUI)
 * @property {boolean} [sampler_fallback] - Whether base sampler detection used fallback
 */

/**
 * Base class for metadata parsers.
 * All format-specific parsers must extend this class and implement the abstract methods.
 */
class MetadataParser {
  /**
   * Get the format name this parser handles.
   * @abstract
   * @returns {string} Format identifier (e.g., 'comfyui', 'a1111')
   * @throws {Error} If not implemented by subclass
   */
  getFormatName() {
    throw new Error('Must implement getFormatName()');
  }

  /**
   * Parse raw metadata into structured format.
   * @abstract
   * @param {Object} rawChunks - Raw metadata chunks from ImageMetadataReader
   * @returns {ParsedMetadata} Structured metadata object
   * @throws {Error} If not implemented by subclass
   */
  parse(rawChunks) {
    throw new Error('Must implement parse()');
  }
}

module.exports = MetadataParser;
