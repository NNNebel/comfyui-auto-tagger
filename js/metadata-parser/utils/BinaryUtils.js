/**
 * BinaryUtils - Common binary operations for image metadata extraction
 * 
 * This module provides shared binary operations to eliminate code duplication
 * and ensure consistent behavior across binary extraction code.
 */
(function(global) {
  'use strict';

  class BinaryUtils {
    /**
     * Read 4-byte FourCC code from buffer
     * @param {Uint8Array} buffer - Buffer to read from
     * @param {number} offset - Offset in buffer
     * @returns {string} FourCC code as string
     * @throws {Error} If buffer is too small
     * 
     * @example
     * const fourCC = BinaryUtils.readFourCC(buffer, 0);
     * // Returns: 'PNG\x89' or similar 4-character code
     */
    static readFourCC(buffer, offset) {
      if (offset + 4 > buffer.length) {
        throw new Error(`Buffer too small for FourCC read at offset ${offset}`);
      }
      return String.fromCharCode(
        buffer[offset],
        buffer[offset + 1],
        buffer[offset + 2],
        buffer[offset + 3]
      );
    }

    /**
     * Read 32-bit big-endian unsigned integer
     * @param {Uint8Array} buffer - Buffer to read from
     * @param {number} offset - Offset in buffer
     * @returns {number} 32-bit unsigned integer
     * @throws {Error} If buffer is too small
     * 
     * @example
     * const length = BinaryUtils.readUInt32BE(buffer, 4);
     * // Returns: chunk length as number
     */
    static readUInt32BE(buffer, offset) {
      if (offset + 4 > buffer.length) {
        throw new Error(`Buffer too small for UInt32BE read at offset ${offset}`);
      }
      return (
        (buffer[offset] << 24) |
        (buffer[offset + 1] << 16) |
        (buffer[offset + 2] << 8) |
        buffer[offset + 3]
      ) >>> 0; // Convert to unsigned
    }

    /**
     * Read 32-bit little-endian unsigned integer
     * @param {Uint8Array} buffer - Buffer to read from
     * @param {number} offset - Offset in buffer
     * @returns {number} 32-bit unsigned integer
     * @throws {Error} If buffer is too small
     * 
     * @example
     * const length = BinaryUtils.readUInt32LE(buffer, 4);
     * // Returns: chunk length as number
     */
    static readUInt32LE(buffer, offset) {
      if (offset + 4 > buffer.length) {
        throw new Error(`Buffer too small for UInt32LE read at offset ${offset}`);
      }
      return (
        buffer[offset] |
        (buffer[offset + 1] << 8) |
        (buffer[offset + 2] << 16) |
        (buffer[offset + 3] << 24)
      ) >>> 0; // Convert to unsigned
    }

    /**
     * Calculate CRC32 checksum (used for PNG chunk validation)
     * @param {Uint8Array} data - Data to checksum
     * @returns {number} CRC32 value
     * 
     * @example
     * const crc = BinaryUtils.crc32(chunkData);
     * // Returns: CRC32 checksum as number
     */
    static crc32(data) {
      let crc = 0xffffffff;
      
      for (let i = 0; i < data.length; i++) {
        crc = crc ^ data[i];
        for (let j = 0; j < 8; j++) {
          crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
      }
      
      return (crc ^ 0xffffffff) >>> 0;
    }

    /**
     * Slice buffer safely with bounds checking
     * @param {Uint8Array} buffer - Buffer to slice
     * @param {number} start - Start offset (inclusive)
     * @param {number} end - End offset (exclusive)
     * @returns {Uint8Array} Sliced buffer
     * @throws {Error} If slice range is invalid
     * 
     * @example
     * const chunk = BinaryUtils.slice(buffer, 8, 16);
     * // Returns: new Uint8Array with bytes 8-15
     */
    static slice(buffer, start, end) {
      if (start < 0) {
        throw new Error(`Invalid slice start: ${start} (must be >= 0)`);
      }
      if (end > buffer.length) {
        throw new Error(`Invalid slice end: ${end} (buffer length: ${buffer.length})`);
      }
      if (start > end) {
        throw new Error(`Invalid slice range: start ${start} > end ${end}`);
      }
      return buffer.slice(start, end);
    }

    /**
     * Read null-terminated string from buffer
     * @param {Uint8Array} buffer - Buffer to read from
     * @param {number} offset - Start offset
     * @param {number} maxLength - Maximum length to read
     * @returns {string} Decoded string
     * 
     * @example
     * const text = BinaryUtils.readNullTerminatedString(buffer, 0, 100);
     * // Returns: string up to null byte or maxLength
     */
    static readNullTerminatedString(buffer, offset, maxLength) {
      const end = Math.min(offset + maxLength, buffer.length);
      let nullIndex = offset;
      
      // Find null terminator
      while (nullIndex < end && buffer[nullIndex] !== 0) {
        nullIndex++;
      }
      
      // Decode string
      const bytes = buffer.slice(offset, nullIndex);
      return new TextDecoder('utf-8').decode(bytes);
    }

    /**
     * Read fixed-length string from buffer
     * @param {Uint8Array} buffer - Buffer to read from
     * @param {number} offset - Start offset
     * @param {number} length - Number of bytes to read
     * @returns {string} Decoded string
     * @throws {Error} If buffer is too small
     * 
     * @example
     * const text = BinaryUtils.readString(buffer, 0, 10);
     * // Returns: 10-byte string decoded as UTF-8
     */
    static readString(buffer, offset, length) {
      if (offset + length > buffer.length) {
        throw new Error(`Buffer too small for string read at offset ${offset}, length ${length}`);
      }
      const bytes = buffer.slice(offset, offset + length);
      return new TextDecoder('utf-8').decode(bytes);
    }

    /**
     * Check if buffer starts with magic bytes
     * @param {Uint8Array} buffer - Buffer to check
     * @param {Array<number>} magic - Magic bytes to match
     * @returns {boolean} True if buffer starts with magic bytes
     * 
     * @example
     * const isPNG = BinaryUtils.hasMagicBytes(buffer, [0x89, 0x50, 0x4E, 0x47]);
     * // Returns: true if PNG signature matches
     */
    static hasMagicBytes(buffer, magic) {
      if (buffer.length < magic.length) {
        return false;
      }
      for (let i = 0; i < magic.length; i++) {
        if (buffer[i] !== magic[i]) {
          return false;
        }
      }
      return true;
    }
  }

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.BinaryUtils = BinaryUtils;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BinaryUtils;
  }
})(typeof window !== 'undefined' ? window : global);
