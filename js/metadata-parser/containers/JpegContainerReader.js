// js/metadata-parser/containers/JpegContainerReader.js
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

  class JpegContainerReader extends BaseContainerReader {
    getSupportedMimeTypes() {
      return ['image/jpeg', 'image/jpg'];
    }

    extractRawChunks(buffer) {
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

    _extractTiffAsciiStrings(tiff) {
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
  }

  if (typeof window !== 'undefined') window.JpegContainerReader = JpegContainerReader;
  if (typeof module !== 'undefined' && module.exports) module.exports = JpegContainerReader;

})(typeof window !== 'undefined' ? window : global);
