// js/metadata-parser/containers/ContainerReaderRegistry.js
// Universal module (Browser + Node.js)
(function(global) {
  'use strict';

  var PngContainerReader, WebpContainerReader, JpegContainerReader, Mp4ContainerReader;

  if (typeof window !== 'undefined') {
    PngContainerReader = window.PngContainerReader;
    WebpContainerReader = window.WebpContainerReader;
    JpegContainerReader = window.JpegContainerReader;
    Mp4ContainerReader = window.Mp4ContainerReader;
  } else if (typeof require !== 'undefined') {
    PngContainerReader = require('./PngContainerReader');
    WebpContainerReader = require('./WebpContainerReader');
    JpegContainerReader = require('./JpegContainerReader');
    Mp4ContainerReader = require('./Mp4ContainerReader');
  } else {
    throw new Error('Required dependencies not found');
  }

  class ContainerReaderRegistry {
    constructor() {
      this._readers = new Map(); // MIME type → Reader instance
    }

    register(reader) {
      const mimeTypes = reader.getSupportedMimeTypes();
      mimeTypes.forEach(mimeType => {
        this._readers.set(mimeType, reader);
      });
      return this; // Enable chaining
    }

    getReader(mimeType) {
      return this._readers.get(mimeType) || null;
    }

    getSupportedMimeTypes() {
      return Array.from(this._readers.keys());
    }

    static createDefault() {
      const registry = new ContainerReaderRegistry();
      registry
        .register(new PngContainerReader())
        .register(new WebpContainerReader())
        .register(new JpegContainerReader())
        .register(new Mp4ContainerReader());
      return registry;
    }
  }

  if (typeof window !== 'undefined') window.ContainerReaderRegistry = ContainerReaderRegistry;
  if (typeof module !== 'undefined' && module.exports) module.exports = ContainerReaderRegistry;

})(typeof window !== 'undefined' ? window : global);
