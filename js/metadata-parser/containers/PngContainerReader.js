// js/metadata-parser/containers/PngContainerReader.js
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

  class PngContainerReader extends BaseContainerReader {
    getSupportedMimeTypes() {
      return ['image/png'];
    }

    extractRawChunks(buffer) {
      const result = {};

      // Check minimum buffer size for PNG signature
      if (buffer.byteLength < 8) {
        return result;
      }

      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

      if (view.getUint32(0) !== 0x89504e47) {
        return result;
      }

      let offset = 8;

      while (offset < view.byteLength) {
        if (offset + 4 > view.byteLength) break;

        const length = BinaryUtils.readUInt32BE(buffer, offset);
        offset += 4;

        if (offset + 4 > view.byteLength) break;

        const type = BinaryUtils.readFourCC(buffer, offset);
        offset += 4;

        if (type === 'tEXt') {
          const chunkData = BinaryUtils.slice(buffer, offset, offset + length);
          const { keyword, text } = this._decodePngText(chunkData);
          result[keyword] = text;
        }

        if (type === 'comf') {
          const chunkData = BinaryUtils.slice(buffer, offset, offset + length);
          const { keyword, text } = this._decodeComfChunk(chunkData);
          result[keyword] = text;
        }

        offset += length + 4;
      }

      return result;
    }

    _decodePngText(data) {
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

    _decodeComfChunk(data) {
      const decoder = new TextDecoder('utf-8');
      const fullText = decoder.decode(data);

      const jsonStart = fullText.indexOf('{');
      if (jsonStart === -1) {
        return { keyword: '', text: fullText };
      }

      const keyword = fullText.substring(0, jsonStart).replace(/\0/g, '').trim();
      return {
        keyword: keyword,
        text: fullText.substring(jsonStart)
      };
    }
  }

  if (typeof window !== 'undefined') window.PngContainerReader = PngContainerReader;
  if (typeof module !== 'undefined' && module.exports) module.exports = PngContainerReader;

})(typeof window !== 'undefined' ? window : global);
