/**
 * MetadataCacheService
 * 
 * Manages persistent caching of parsed metadata within the Eagle library.
 * This ensures that heavy parsing operations are performed only once per image.
 */
(function(global) {
  'use strict';

  const fsp = typeof require !== 'undefined' ? require('fs').promises : null;
  const path = typeof require !== 'undefined' ? require('path') : null;

  class MetadataCacheService {
    /**
     * @param {string} libraryPath - Root path of the Eagle library
     */
    constructor(libraryPath) {
      if (!libraryPath) {
        throw new Error('MetadataCacheService: libraryPath is required');
      }
      this.libraryPath = libraryPath;
      
      // Cache location: {LibraryPath}/.eagle/plugins/comfyui-auto-tagger/metadata-cache/
      if (path) {
        this.cacheDir = path.join(
          this.libraryPath, 
          '.eagle', 
          'plugins', 
          'comfyui-auto-tagger', 
          'metadata-cache'
        );
      }
    }

    /**
     * Get cached metadata for an item
     * @param {string} itemId - Eagle Item ID
     * @returns {Promise<Object|null>} Cached metadata or null if not found
     */
    async get(itemId) {
      if (!fsp || !path) return null;
      
      const cachePath = path.join(this.cacheDir, `${itemId}.json`);
      try {
        const data = await fsp.readFile(cachePath, 'utf8');
        return JSON.parse(data);
      } catch (e) {
        // Cache miss or read error
        return null;
      }
    }

    /**
     * Save metadata to cache
     * @param {string} itemId - Eagle Item ID
     * @param {Object} metadata - Parsed metadata object to cache
     * @returns {Promise<boolean>} Success status
     */
    async set(itemId, metadata) {
      if (!fsp || !path || !metadata) return false;

      try {
        await fsp.mkdir(this.cacheDir, { recursive: true });
        const cachePath = path.join(this.cacheDir, `${itemId}.json`);
        await fsp.writeFile(cachePath, JSON.stringify(metadata, null, 2), 'utf8');
        return true;
      } catch (e) {
        console.error('[MetadataCacheService] Failed to save cache:', e);
        return false;
      }
    }

    /**
     * Remove cached metadata for an item
     * @param {string} itemId - Eagle Item ID
     */
    async delete(itemId) {
      if (!fsp || !path) return;

      const cachePath = path.join(this.cacheDir, `${itemId}.json`);
      try {
        await fsp.unlink(cachePath);
      } catch (e) {
        // Ignore if file doesn't exist
      }
    }

    /**
     * Clear all cached metadata
     * @returns {Promise<boolean>} Success status
     */
    async clearAll() {
      if (!fsp || !path) return false;

      try {
        const files = await fsp.readdir(this.cacheDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            await fsp.unlink(path.join(this.cacheDir, file));
          }
        }
        return true;
      } catch (e) {
        console.error('[MetadataCacheService] Failed to clear cache:', e);
        return false;
      }
    }

    /**
     * Utility to resolve library path from an image file path
     * @param {string} filePath - Absolute path to an image within an Eagle library
     * @returns {string|null} Library root path or null
     */
    static resolveLibraryPath(filePath) {
      if (!filePath || !path) return null;
      
      // Eagle structure: Library/images/ITEM_ID.info/file.png
      const parts = filePath.split(path.sep);
      const imagesIdx = parts.lastIndexOf('images');
      if (imagesIdx !== -1) {
        return parts.slice(0, imagesIdx).join(path.sep);
      }
      return null;
    }
  }

  // Export for both environments
  if (typeof window !== 'undefined') {
    window.MetadataCacheService = MetadataCacheService;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetadataCacheService;
  }

})(typeof window !== 'undefined' ? window : global);
