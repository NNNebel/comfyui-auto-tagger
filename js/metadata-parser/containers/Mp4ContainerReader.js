// js/metadata-parser/containers/Mp4ContainerReader.js
// Universal module (Browser + Node.js)
(function(global) {
  'use strict';

  var BaseContainerReader;

  if (typeof window !== 'undefined') {
    // Browser environment
    BaseContainerReader = window.BaseContainerReader;
  } else if (typeof require !== 'undefined') {
    // Node.js environment
    BaseContainerReader = require('./BaseContainerReader');
  } else {
    throw new Error('Required dependencies not found');
  }

  class Mp4ContainerReader extends BaseContainerReader {
    getSupportedMimeTypes() {
      return ['video/mp4'];
    }

    extractRawChunks(buffer) {
      try {
        // Normalize to Uint8Array (works in both Node.js Buffer and Electron Renderer)
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        const metadata = this._parseMP4Metadata(bytes);
        return metadata;
      } catch (e) {
        console.error('[Mp4ContainerReader] Error parsing MP4:', e.message);
        return {};
      }
    }

    /**
     * Parse MP4 container metadata structure
     * MP4 structure: moov > udta > meta > (hdlr) + keys + ilst
     *
     * @param {Buffer} buffer - MP4 file buffer
     * @returns {Object} { prompt?, workflow?, encoder? }
     * @private
     */
    _parseMP4Metadata(bytes) {
      const result = {};
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const decoder = new TextDecoder('utf-8');
      const latin1 = (start, end) => String.fromCharCode(...bytes.slice(start, end));
      const readU32 = (offset) => view.getUint32(offset, false); // big-endian

      // Find moov box
      const moovOffset = this._findBox(bytes, view, latin1, readU32, 'moov', 0);
      if (moovOffset === -1) return result;

      const udtaOffset = this._findBox(bytes, view, latin1, readU32, 'udta', moovOffset);
      if (udtaOffset === -1) return result;

      const metaOffset = this._findBox(bytes, view, latin1, readU32, 'meta', udtaOffset);
      if (metaOffset === -1) return result;

      const keys = this._parseKeys(bytes, view, latin1, readU32, decoder, metaOffset);
      const metadata = this._parseIlst(bytes, view, latin1, readU32, decoder, metaOffset, keys);

      for (const [key, value] of Object.entries(metadata)) {
        if (typeof value === 'string') {
          result[key] = value;
        }
      }

      return result;
    }

    _findBox(bytes, view, latin1, readU32, boxType, searchStart) {
      let offset = searchStart;

      while (offset + 8 <= bytes.length) {
        const size = readU32(offset);
        const type = latin1(offset + 4, offset + 8);

        if (type === boxType) {
          return offset + 8;
        }

        if (size < 8 || size > bytes.length - offset) break;
        offset += size;
      }

      return -1;
    }

    _parseKeys(bytes, view, latin1, readU32, decoder, metaDataStart) {
      const keys = [];
      let offset = metaDataStart + 4; // skip meta version/flags

      while (offset + 8 <= bytes.length) {
        const size = readU32(offset);
        const type = latin1(offset + 4, offset + 8);

        if (type === 'keys') {
          let keysOffset = offset + 8;
          const entryCount = readU32(keysOffset + 4);
          keysOffset += 8;

          for (let i = 0; i < entryCount; i++) {
            if (keysOffset + 8 > bytes.length) break;
            const keySize = readU32(keysOffset);
            const keyValue = decoder.decode(bytes.slice(keysOffset + 8, keysOffset + keySize));
            keys.push(keyValue);
            keysOffset += keySize;
          }

          return keys;
        }

        if (size < 8 || size > bytes.length - offset) break;
        offset += size;
      }

      return keys;
    }

    _parseIlst(bytes, view, latin1, readU32, decoder, metaDataStart, keys) {
      const result = {};
      let offset = metaDataStart + 4; // skip meta version/flags

      while (offset + 8 <= bytes.length) {
        const size = readU32(offset);
        const type = latin1(offset + 4, offset + 8);

        if (type === 'ilst') {
          let itemOffset = offset + 8;
          const ilstEnd = offset + size;
          let itemIndex = 1;

          while (itemOffset + 8 <= ilstEnd) {
            const itemSize = readU32(itemOffset);
            if (itemSize < 8 || itemOffset + itemSize > ilstEnd) break;

            let dataOffset = itemOffset + 8;
            const itemEnd = itemOffset + itemSize;

            while (dataOffset + 8 <= itemEnd) {
              const dataSize = readU32(dataOffset);
              const dataType = latin1(dataOffset + 4, dataOffset + 8);

              if (dataType === 'data') {
                const value = decoder.decode(bytes.slice(dataOffset + 16, dataOffset + dataSize));
                const keyName = keys[itemIndex - 1] || `unknown_${itemIndex}`;
                result[keyName] = value;
                break;
              }

              if (dataSize < 8) break;
              dataOffset += dataSize;
            }

            itemOffset += itemSize;
            itemIndex++;
          }

          break;
        }

        if (size < 8 || size > bytes.length - offset) break;
        offset += size;
      }

      return result;
    }
  }

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.Mp4ContainerReader = Mp4ContainerReader;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Mp4ContainerReader;
  }

})(typeof window !== 'undefined' ? window : global);
