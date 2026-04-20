// js/metadata-parser/binary-extraction/ImageMetadataReader.js
// Universal module (Browser + Node.js)
(function(global) {
  'use strict';

  // Get dependencies for both environments
  var BinaryUtils, ErrorHandler, ParsingUtils;
  
  if (typeof window !== 'undefined') {
    // Browser environment
    BinaryUtils = window.BinaryUtils;
    ErrorHandler = window.ErrorHandler;
    ParsingUtils = window.ParsingUtils;
  } else if (typeof require !== 'undefined') {
    // Node.js environment (testing)
    BinaryUtils = require('../utils/BinaryUtils');
    ErrorHandler = require('../utils/ErrorHandler').ErrorHandler;
    ParsingUtils = require('../utils/ParsingUtils');
  } else {
    throw new Error('Required dependencies not found');
  }

/**
 * ImageMetadataReader
 * 
 * Responsible for reading raw metadata from image files without interpretation.
 * Extracts raw metadata chunks from PNG and WebP image formats.
 */
class ImageMetadataReader {
  /**
   * Extract raw metadata chunks from image buffer
   * @param {Uint8Array} buffer - Image file buffer
   * @param {string} mimeType - 'image/png' or 'image/webp'
   * @returns {Object} Raw metadata chunks keyed by chunk name
   */
  static extractRawMetadata(buffer, mimeType) {
    return ErrorHandler.safeExecute(
      () => {
        if (mimeType === 'image/png') {
          return this.extractPngChunks(buffer);
        }
        if (mimeType === 'image/webp') {
          return this.extractWebpChunks(buffer);
        }
        ErrorHandler.logWarning('ImageMetadataReader', `Unsupported MIME type: ${mimeType}`);
        return {};
      },
      {},
      'ImageMetadataReader',
      { mimeType, bufferSize: buffer.length }
    );
  }

  /**
   * Extract PNG tEXt chunks
   * @param {Uint8Array} buffer - PNG image buffer
   * @returns {Object} { keyword: text, ... }
   */
  static extractPngChunks(buffer) {
    const result = {};
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    
    // Verify PNG signature
    if (view.getUint32(0) !== 0x89504e47) {
      return result;
    }
    
    let offset = 8; // Skip PNG signature
    
    while (offset < view.byteLength) {
      // Check if we have enough bytes for chunk length
      if (offset + 4 > view.byteLength) break;
      
      const length = BinaryUtils.readUInt32BE(buffer, offset);
      offset += 4;
      
      // Check if we have enough bytes for chunk type
      if (offset + 4 > view.byteLength) break;
      
      const type = BinaryUtils.readFourCC(buffer, offset);
      offset += 4;
      
      // Process tEXt chunks
      if (type === 'tEXt') {
        const chunkData = BinaryUtils.slice(buffer, offset, offset + length);
        const { keyword, text } = this._decodePngText(chunkData);

        // Try to parse all tEXt chunks as JSON; fall back to raw string
        const parsed = ParsingUtils.parseJsonSafely(text, null);
        result[keyword] = parsed !== null ? parsed : text;
      }
      
      // Process comf chunks (ComfyUI custom chunk)
      if (type === 'comf') {
        const chunkData = BinaryUtils.slice(buffer, offset, offset + length);
        const { keyword, text } = this._decodeComfChunk(chunkData);

        // Try to parse all comf chunks as JSON; fall back to raw string
        const parsed = ParsingUtils.parseJsonSafely(text, null);
        result[keyword] = parsed !== null ? parsed : text;
      }
      
      // Move to next chunk (data + CRC)
      offset += length + 4;
    }
    
    return result;
  }

  /**
   * Extract WebP EXIF/XMP chunks
   * @param {Uint8Array} buffer - WebP image buffer
   * @returns {Object} { workflow: json, prompt: json, parameters: text, ... }
   */
  static extractWebpChunks(buffer) {
    const result = {};
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    
    // Verify WebP signature
    if (BinaryUtils.readFourCC(buffer, 0) !== 'RIFF' || BinaryUtils.readFourCC(buffer, 8) !== 'WEBP') {
      return result;
    }
    
    let offset = 12; // Skip RIFF header
    
    while (offset < view.byteLength) {
      // Check if we have enough bytes for chunk header
      if (offset + 8 > view.byteLength) break;
      
      const chunkType = BinaryUtils.readFourCC(buffer, offset);
      const chunkSize = BinaryUtils.readUInt32LE(buffer, offset + 4);
      const chunkDataOffset = offset + 8;
      
      // Process EXIF and XMP chunks
      if (chunkType === 'EXIF' || chunkType === 'XMP ') {
        this._extractFromBinary(
          BinaryUtils.slice(buffer, chunkDataOffset, chunkDataOffset + chunkSize),
          result
        );
      }
      
      // Move to next chunk (aligned to even byte boundary)
      offset += 8 + chunkSize + (chunkSize % 2);
    }
    
    return result;
  }

  /**
   * Decode PNG tEXt chunk data
   * @private
   * @param {Uint8Array} data - tEXt chunk data
   * @returns {Object} { keyword: string, text: string }
   */
  static _decodePngText(data) {
    const nullIndex = data.indexOf(0x00);
    if (nullIndex === -1) {
      return { keyword: '', text: '' };
    }
    
    const decoder = new TextDecoder('utf-8');
    return {
      keyword: decoder.decode(data.slice(0, nullIndex)),
      text: decoder.decode(data.slice(nullIndex + 1))
    };
  }

  /**
   * Decode PNG comf chunk data (ComfyUI custom chunk)
   * Format: keyword immediately followed by JSON data (no null separator)
   * @private
   * @param {Uint8Array} data - comf chunk data
   * @returns {Object} { keyword: string, text: string }
   */
  static _decodeComfChunk(data) {
    const decoder = new TextDecoder('utf-8');
    const fullText = decoder.decode(data);
    
    // Find where JSON starts (first '{' character)
    const jsonStart = fullText.indexOf('{');
    if (jsonStart === -1) {
      return { keyword: '', text: fullText };
    }
    
    // Extract keyword and trim any whitespace or null characters
    const keyword = fullText.substring(0, jsonStart).replace(/\0/g, '').trim();
    
    return {
      keyword: keyword,
      text: fullText.substring(jsonStart)
    };
  }

  /**
   * Extract metadata from binary data (EXIF/XMP)
   * @private
   * @param {Uint8Array} data - Binary chunk data
   * @param {Object} result - Result object to populate
   */
  static _extractFromBinary(data, result) {
    const decoder = new TextDecoder('iso-8859-1');
    const binaryString = decoder.decode(data);

    // Helper to parse JSON from binary string
    const parseJson = (key) => {
      const match = binaryString.match(new RegExp(`${key}:\\s*(\\{)`, 'i'));
      if (match) {
        const jsonStart = match.index + match[0].lastIndexOf('{');
        const json = this._parseJsonFromPos(data, jsonStart);
        if (json) {
          result[key.toLowerCase()] = json;
        }
      }
    };

    // Extract workflow and prompt JSON
    parseJson('workflow');
    parseJson('prompt');
    parseJson('eagle_bridge');
  }

  /**
   * Parse JSON from a specific position in a buffer
   * @private
   * @param {Uint8Array} fullBuffer - Full buffer containing JSON
   * @param {number} startPos - Starting position of JSON
   * @returns {Object|null} Parsed JSON object or null if parsing fails
   */
  static _parseJsonFromPos(fullBuffer, startPos) {
    let braceCount = 0;
    let inString = false;
    let escape = false;
    let endPos = -1;

    for (let i = startPos; i < fullBuffer.length; i++) {
      const byte = fullBuffer[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (byte === 0x5c) { // Backslash
        escape = true;
        continue;
      }

      if (byte === 0x22) { // Double quote
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (byte === 0x7b) { // Opening brace
          braceCount++;
        } else if (byte === 0x7d) { // Closing brace
          braceCount--;
          if (braceCount === 0) {
            endPos = i;
            break;
          }
        }
      }
    }

    if (endPos !== -1) {
      try {
        const jsonString = new TextDecoder('utf-8').decode(
          fullBuffer.slice(startPos, endPos + 1)
        );
        return JSON.parse(jsonString);
      } catch (e) {
        return null;
      }
    }

    return null;
  }

}

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.ImageMetadataReader = ImageMetadataReader;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageMetadataReader;
  }

})(typeof window !== 'undefined' ? window : global);
