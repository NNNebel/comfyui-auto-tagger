// js/metadata-parser/binary-extraction/FormatDetector.js

/**
 * FormatDetector
 * 
 * Identifies which metadata formats are present in raw metadata chunks.
 * Supports detection of ComfyUI and Automatic1111 (A1111) metadata formats.
 */
class FormatDetector {
  /**
   * Detect metadata formats present in raw chunks
   * @param {Object} rawChunks - Raw metadata from ImageMetadataReader
   * @returns {Array<string>} Array of detected format names ['comfyui', 'a1111']
   */
  static detectFormats(rawChunks) {
    const formats = [];
    
    // ComfyUI detection: has 'workflow' or 'prompt' keys with JSON
    if (this._isComfyUIMetadata(rawChunks)) {
      formats.push('comfyui');
    }
    
    // A1111 detection: has 'parameters' key with text
    if (this._isA1111Metadata(rawChunks)) {
      formats.push('a1111');
    }
    
    return formats;
  }

  /**
   * Check if raw chunks contain ComfyUI metadata
   * @private
   * @param {Object} rawChunks - Raw metadata chunks
   * @returns {boolean} True if ComfyUI metadata is detected
   */
  static _isComfyUIMetadata(rawChunks) {
    // ComfyUI metadata is identified by the presence of 'workflow' or 'prompt' keys
    // These should be objects (JSON parsed) not strings
    const hasWorkflow = rawChunks.workflow && typeof rawChunks.workflow === 'object';
    const hasPrompt = rawChunks.prompt && typeof rawChunks.prompt === 'object';
    
    return hasWorkflow || hasPrompt;
  }

  /**
   * Check if raw chunks contain A1111 metadata
   * @private
   * @param {Object} rawChunks - Raw metadata chunks
   * @returns {boolean} True if A1111 metadata is detected
   */
  static _isA1111Metadata(rawChunks) {
    // A1111 metadata is identified by the presence of 'parameters' key with text content
    // The parameters field should be a non-empty string containing the A1111 format
    return rawChunks.parameters && typeof rawChunks.parameters === 'string' && rawChunks.parameters.length > 0;
  }
}

// Node.js/CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FormatDetector;
}

// ES Module export
if (typeof exports !== 'undefined') {
  exports.FormatDetector = FormatDetector;
}
