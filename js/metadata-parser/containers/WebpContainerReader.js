// js/metadata-parser/containers/WebpContainerReader.js
// Universal module (Browser + Node.js)
(function(global) {
  'use strict';

  var BaseContainerReader, BinaryUtils;

  if (typeof window !== 'undefined') {
    BaseContainerReader = window.BaseContainerReader;
    BinaryUtils = window.BinaryUtils;
  } else if (typeof require !== 'undefined') {
    BaseContainerReader = require('./BaseContainerReader');
    BinaryUtils = require('../utils/BinaryUtils');
  } else {
    throw new Error('Required dependencies not found');
  }

  class WebpContainerReader extends BaseContainerReader {
    getSupportedMimeTypes() {
      return ['image/webp'];
    }

    extractRawChunks(buffer) {
      const result = {};

      // Check minimum buffer size for WebP header (RIFF + size + WEBP)
      if (buffer.byteLength < 12) {
        return result;
      }

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
  }

  if (typeof window !== 'undefined') window.WebpContainerReader = WebpContainerReader;
  if (typeof module !== 'undefined' && module.exports) module.exports = WebpContainerReader;

})(typeof window !== 'undefined' ? window : global);
