// js/metadata-parser/binary-extraction/ImageMetadataReader.js
// Universal module (Browser + Node.js)
// Thin facade over ContainerReaderRegistry for backward compatibility
(function(global) {
  'use strict';

  var ErrorHandler, ContainerReaderRegistry;

  if (typeof window !== 'undefined') {
    ErrorHandler = window.ErrorHandler;
    ContainerReaderRegistry = window.ContainerReaderRegistry;
  } else if (typeof require !== 'undefined') {
    ErrorHandler = require('../utils/ErrorHandler').ErrorHandler;
    ContainerReaderRegistry = require('../containers/ContainerReaderRegistry');
  } else {
    throw new Error('Required dependencies not found');
  }

  // Singleton registry initialized on first use
  var _registry;

  function getRegistry() {
    if (!_registry) {
      _registry = ContainerReaderRegistry.createDefault();
    }
    return _registry;
  }

  class ImageMetadataReader {
    static extractRawMetadata(buffer, mimeType) {
      return ErrorHandler.safeExecute(
        () => {
          const reader = getRegistry().getReader(mimeType);
          if (!reader) {
            ErrorHandler.logWarning('ImageMetadataReader', `Unsupported MIME type: ${mimeType}`);
            return {};
          }
          return reader.extractRawChunks(buffer);
        },
        {},
        'ImageMetadataReader',
        { mimeType, bufferSize: buffer.length }
      );
    }

    // Backward compatibility: delegate to PNG reader
    static extractPngChunks(buffer) {
      return getRegistry().getReader('image/png').extractRawChunks(buffer);
    }

    // Backward compatibility: delegate to WebP reader
    static extractWebpChunks(buffer) {
      return getRegistry().getReader('image/webp').extractRawChunks(buffer);
    }

    // Backward compatibility: delegate to JPEG reader
    static extractJpegChunks(buffer) {
      return getRegistry().getReader('image/jpeg').extractRawChunks(buffer);
    }

    // Private methods for backward compatibility with tests
    static _decodePngText(data) {
      return getRegistry().getReader('image/png')._decodePngText(data);
    }

    static _decodeComfChunk(data) {
      return getRegistry().getReader('image/png')._decodeComfChunk(data);
    }

    static _extractFromBinary(data, result) {
      return getRegistry().getReader('image/webp')._extractFromBinary(data, result);
    }

    static _extractJsonStringFromPos(fullBuffer, startPos) {
      return getRegistry().getReader('image/webp')._extractJsonStringFromPos(fullBuffer, startPos);
    }

    static _extractTiffAsciiStrings(tiff) {
      return getRegistry().getReader('image/jpeg')._extractTiffAsciiStrings(tiff);
    }

    static _parseJsonFromPos(fullBuffer, startPos) {
      return getRegistry().getReader('image/webp')._parseJsonFromPos(fullBuffer, startPos);
    }
  }

  if (typeof window !== 'undefined') {
    window.ImageMetadataReader = ImageMetadataReader;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageMetadataReader;
  }

})(typeof window !== 'undefined' ? window : global);
