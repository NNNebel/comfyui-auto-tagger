// js/metadata-parser/containers/BaseContainerReader.js
// Universal module (Browser + Node.js)
(function(global) {
  'use strict';

  class BaseContainerReader {
    getSupportedMimeTypes() {
      throw new Error(`${this.constructor.name} must implement getSupportedMimeTypes()`);
    }

    extractRawChunks(buffer) {
      throw new Error(`${this.constructor.name} must implement extractRawChunks(buffer)`);
    }

    // Shared helper for WebP/JPEG: extract JSON strings from EXIF binary data
    _extractFromBinary(data, result) {
      const decoder = new TextDecoder('iso-8859-1');
      const binaryString = decoder.decode(data);

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

      extractJsonString('workflow');
      extractJsonString('prompt');
      extractJsonString('eagle_bridge');
    }

    _extractJsonStringFromPos(fullBuffer, startPos) {
      let braceCount = 0;
      let inString = false;
      let escape = false;
      let endPos = -1;

      for (let i = startPos; i < fullBuffer.length; i++) {
        const byte = fullBuffer[i];

        if (escape) { escape = false; continue; }
        if (byte === 0x5c) { escape = true; continue; } // backslash
        if (byte === 0x22) { inString = !inString; continue; } // double quote

        if (!inString) {
          if (byte === 0x7b) { // opening brace
            braceCount++;
          } else if (byte === 0x7d) { // closing brace
            braceCount--;
            if (braceCount === 0) { endPos = i; break; }
          }
        }
      }

      if (endPos !== -1) {
        try {
          const jsonString = new TextDecoder('utf-8').decode(
            fullBuffer.slice(startPos, endPos + 1)
          );
          JSON.parse(jsonString);
          return jsonString;
        } catch (e) {
          return null;
        }
      }

      return null;
    }
  }

  if (typeof window !== 'undefined') window.BaseContainerReader = BaseContainerReader;
  if (typeof module !== 'undefined' && module.exports) module.exports = BaseContainerReader;

})(typeof window !== 'undefined' ? window : global);
