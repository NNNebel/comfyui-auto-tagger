// js/metadata-parser/binary-extraction/ImageMetadataReader.js
// Universal module (Browser + Node.js)
(function(global) {
  'use strict';

  // Get dependencies for both environments
  var BinaryUtils, ErrorHandler;

  if (typeof window !== 'undefined') {
    // Browser environment
    BinaryUtils = window.BinaryUtils;
    ErrorHandler = window.ErrorHandler;
  } else if (typeof require !== 'undefined') {
    // Node.js environment (testing)
    BinaryUtils = require('../utils/BinaryUtils');
    ErrorHandler = require('../utils/ErrorHandler').ErrorHandler;
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
        if (mimeType === 'image/jpeg') {
          return this.extractJpegChunks(buffer);
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
      
      // Process tEXt chunks - return raw text
      if (type === 'tEXt') {
        const chunkData = BinaryUtils.slice(buffer, offset, offset + length);
        const { keyword, text } = this._decodePngText(chunkData);
        result[keyword] = text;
      }

      // Process comf chunks (ComfyUI custom chunk) - return raw text
      if (type === 'comf') {
        const chunkData = BinaryUtils.slice(buffer, offset, offset + length);
        const { keyword, text } = this._decodeComfChunk(chunkData);
        result[keyword] = text;
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
   * Extract JPEG APP1 EXIF metadata
   * @param {Uint8Array} buffer - JPEG image buffer
   * @returns {Object} { workflow: json, prompt: json, eagle_bridge: json, ... }
   */
  static extractJpegChunks(buffer) {
    const result = {};

    // Verify JPEG signature: FFD8
    if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
      return result;
    }

    let offset = 2;
    while (offset < buffer.length - 3) {
      if (buffer[offset] !== 0xFF) break;
      const marker = buffer[offset + 1];

      // SOI has no length field
      if (marker === 0xD8) { offset += 2; continue; }
      // EOI or SOS — stop scanning
      if (marker === 0xD9 || marker === 0xDA) break;

      const segLength = (buffer[offset + 2] << 8) | buffer[offset + 3];
      if (segLength < 2 || offset + 2 + segLength > buffer.length) break;

      // APP1 = 0xE1: may contain Exif
      if (marker === 0xE1 && segLength > 6) {
        const segData = BinaryUtils.slice(buffer, offset + 4, offset + 2 + segLength);
        // Exif header: "Exif\0\0"
        if (segData[0] === 0x45 && segData[1] === 0x78 && segData[2] === 0x69 &&
            segData[3] === 0x66 && segData[4] === 0x00 && segData[5] === 0x00) {
          const tiff = BinaryUtils.slice(segData, 6);
          const strings = this._extractTiffAsciiStrings(tiff);
          if (strings.length > 0) {
            const combined = strings.join('\n');
            const encoder = new TextEncoder();
            this._extractFromBinary(encoder.encode(combined), result);
          }
        }
      }

      offset += 2 + segLength;
    }

    return result;
  }

  /**
   * Extract all ASCII string values from a TIFF IFD
   * @private
   * @param {Uint8Array} tiff - TIFF data (starting from byte-order marker)
   * @returns {string[]} Array of non-empty ASCII tag values
   */
  static _extractTiffAsciiStrings(tiff) {
    const strings = [];
    if (tiff.length < 8) return strings;

    const isBE = tiff[0] === 0x4D && tiff[1] === 0x4D; // 'MM' = big-endian
    const u16 = (o) => isBE ? (tiff[o] << 8) | tiff[o + 1]
                             : tiff[o] | (tiff[o + 1] << 8);
    const u32 = (o) => isBE
      ? ((tiff[o] << 24) | (tiff[o+1] << 16) | (tiff[o+2] << 8) | tiff[o+3]) >>> 0
      : (tiff[o] | (tiff[o+1] << 8) | (tiff[o+2] << 16) | (tiff[o+3] << 24)) >>> 0;

    const ifdOffset = u32(4);
    if (ifdOffset + 2 > tiff.length) return strings;

    const numEntries = u16(ifdOffset);
    const decoder = new TextDecoder('utf-8');

    for (let i = 0; i < numEntries; i++) {
      const e = ifdOffset + 2 + i * 12;
      if (e + 12 > tiff.length) break;

      const type = u16(e + 2);
      if (type !== 2) continue; // ASCII only

      const count = u32(e + 4);
      const valOrOffset = u32(e + 8);
      const strStart = count > 4 ? valOrOffset : e + 8;

      if (strStart + count > tiff.length) continue;

      const str = decoder.decode(tiff.slice(strStart, strStart + count)).replace(/\0/g, '').trim();
      if (str) strings.push(str);
    }

    return strings;
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

    // Helper to extract JSON string from binary data
    const extractJsonString = (key) => {
      const match = binaryString.match(new RegExp(`${key}:\\s*(\\{)`, 'i'));
      if (match) {
        const jsonStart = match.index + match[0].lastIndexOf('{');
        const jsonString = this._extractJsonStringFromPos(data, jsonStart);
        if (jsonString) {
          result[key.toLowerCase()] = jsonString;
        }
      }
    };

    // Extract workflow and prompt as JSON strings
    extractJsonString('workflow');
    extractJsonString('prompt');
    extractJsonString('eagle_bridge');
  }

  /**
   * Extract JSON string from a specific position in a buffer
   * @private
   * @param {Uint8Array} fullBuffer - Full buffer containing JSON
   * @param {number} startPos - Starting position of JSON
   * @returns {string|null} JSON string or null if extraction fails
   */
  static _extractJsonStringFromPos(fullBuffer, startPos) {
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
        // Validate it's valid JSON by attempting to parse
        JSON.parse(jsonString);
        return jsonString;
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  /**
   * @private
   * @deprecated Use _extractJsonStringFromPos instead
   */
  static _parseJsonFromPos(fullBuffer, startPos) {
    const jsonString = this._extractJsonStringFromPos(fullBuffer, startPos);
    if (jsonString) {
      try {
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
