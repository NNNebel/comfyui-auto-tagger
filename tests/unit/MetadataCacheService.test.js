import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import MetadataCacheService from '../../js/metadata-parser/utils/MetadataCacheService.js';

describe('MetadataCacheService', () => {
  let tempDir;
  let cacheService;

  beforeEach(() => {
    // Create a temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-'));
    cacheService = new MetadataCacheService(tempDir);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should initialize with a valid library path', () => {
      expect(cacheService.libraryPath).toBe(tempDir);
    });

    it('should throw error when libraryPath is not provided', () => {
      expect(() => new MetadataCacheService()).toThrow('libraryPath is required');
    });

    it('should throw error when libraryPath is empty string', () => {
      expect(() => new MetadataCacheService('')).toThrow('libraryPath is required');
    });

    it('should throw error when libraryPath is null', () => {
      expect(() => new MetadataCacheService(null)).toThrow('libraryPath is required');
    });

    it('should construct proper cache directory path', () => {
      const expectedCachePath = path.join(
        tempDir,
        '.eagle',
        'plugins',
        'comfyui-auto-tagger',
        'metadata-cache'
      );
      expect(cacheService.cacheDir).toBe(expectedCachePath);
    });
  });

  describe('set', () => {
    it('should create cache directory and save metadata', async () => {
      const itemId = 'item-123';
      const metadata = {
        format: 'comfyui',
        checkpoint: 'model.safetensors',
        seed: 42
      };

      const result = await cacheService.set(itemId, metadata);
      expect(result).toBe(true);

      // Verify cache file exists
      const cachePath = path.join(cacheService.cacheDir, `${itemId}.json`);
      expect(fs.existsSync(cachePath)).toBe(true);

      // Verify content
      const saved = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      expect(saved).toEqual(metadata);
    });

    it('should return false when metadata is null', async () => {
      const result = await cacheService.set('item-123', null);
      expect(result).toBe(false);
    });

    it('should return false when metadata is undefined', async () => {
      const result = await cacheService.set('item-123', undefined);
      expect(result).toBe(false);
    });

    it('should overwrite existing cache file', async () => {
      const itemId = 'item-456';
      const metadata1 = { version: 1, data: 'original' };
      const metadata2 = { version: 2, data: 'updated' };

      await cacheService.set(itemId, metadata1);
      await cacheService.set(itemId, metadata2);

      const cachePath = path.join(cacheService.cacheDir, `${itemId}.json`);
      const saved = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      expect(saved.version).toBe(2);
      expect(saved.data).toBe('updated');
    });

    it('should handle complex nested metadata objects', async () => {
      const itemId = 'item-complex';
      const metadata = {
        format: 'comfyui',
        suspiciousNodes: [
          {
            nodeId: '1',
            reasonKey: 'test.reason',
            affectedSteps: [
              { stepNodeId: '2', stepMetadata: { seed: 123 } }
            ]
          }
        ],
        checkpoints: ['model1.safetensors', 'model2.safetensors']
      };

      const result = await cacheService.set(itemId, metadata);
      expect(result).toBe(true);

      const cachePath = path.join(cacheService.cacheDir, `${itemId}.json`);
      const saved = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      expect(saved).toEqual(metadata);
    });
  });

  describe('get', () => {
    it('should retrieve cached metadata', async () => {
      const itemId = 'item-789';
      const metadata = { format: 'comfyui', seed: 123 };

      await cacheService.set(itemId, metadata);
      const retrieved = await cacheService.get(itemId);

      expect(retrieved).toEqual(metadata);
    });

    it('should return null when cache file does not exist', async () => {
      const result = await cacheService.get('nonexistent-id');
      expect(result).toBeNull();
    });

    it('should return null when cache directory does not exist', async () => {
      const cacheService2 = new MetadataCacheService(path.join(tempDir, 'nonexistent'));
      const result = await cacheService2.get('any-id');
      expect(result).toBeNull();
    });

    it('should return null for corrupted cache file', async () => {
      const itemId = 'item-corrupted';
      const cachePath = path.join(cacheService.cacheDir, `${itemId}.json`);

      // Create cache directory and write invalid JSON
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, 'invalid json {', 'utf8');

      const result = await cacheService.get(itemId);
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete cached metadata file', async () => {
      const itemId = 'item-delete';
      const metadata = { format: 'comfyui' };

      await cacheService.set(itemId, metadata);
      const cachePath = path.join(cacheService.cacheDir, `${itemId}.json`);
      expect(fs.existsSync(cachePath)).toBe(true);

      await cacheService.delete(itemId);
      expect(fs.existsSync(cachePath)).toBe(false);
    });

    it('should not throw error when deleting nonexistent file', async () => {
      expect(async () => {
        await cacheService.delete('nonexistent-id');
      }).not.toThrow();
    });

    it('should only delete specified item', async () => {
      const itemId1 = 'item-1';
      const itemId2 = 'item-2';
      const metadata = { format: 'comfyui' };

      await cacheService.set(itemId1, metadata);
      await cacheService.set(itemId2, metadata);

      await cacheService.delete(itemId1);

      const cachePath1 = path.join(cacheService.cacheDir, `${itemId1}.json`);
      const cachePath2 = path.join(cacheService.cacheDir, `${itemId2}.json`);

      expect(fs.existsSync(cachePath1)).toBe(false);
      expect(fs.existsSync(cachePath2)).toBe(true);
    });
  });

  describe('clearAll', () => {
    it('should delete all cache files', async () => {
      const metadata = { format: 'comfyui' };
      await cacheService.set('item-1', metadata);
      await cacheService.set('item-2', metadata);
      await cacheService.set('item-3', metadata);

      const result = await cacheService.clearAll();
      expect(result).toBe(true);

      // Verify all cache files are deleted
      const files = fs.readdirSync(cacheService.cacheDir);
      expect(files).toHaveLength(0);
    });

    it('should return false when cache directory does not exist', async () => {
      const cacheService2 = new MetadataCacheService(path.join(tempDir, 'nonexistent'));
      const result = await cacheService2.clearAll();
      // clearAll returns false when directory doesn't exist
      expect(result).toBe(false);
    });

    it('should only delete .json files', async () => {
      // Create cache directory with mixed files
      fs.mkdirSync(cacheService.cacheDir, { recursive: true });
      fs.writeFileSync(path.join(cacheService.cacheDir, 'cache-1.json'), '{}');
      fs.writeFileSync(path.join(cacheService.cacheDir, 'readme.txt'), 'text');

      const result = await cacheService.clearAll();
      expect(result).toBe(true);

      const files = fs.readdirSync(cacheService.cacheDir);
      expect(files).toContain('readme.txt');
      expect(files).not.toContain('cache-1.json');
    });

    it('should return false when clearing nonexistent directory', async () => {
      const cacheService2 = new MetadataCacheService(
        path.join(tempDir, 'nonexistent')
      );
      const result = await cacheService2.clearAll();
      expect(result).toBe(false);
    });
  });

  describe('resolveLibraryPath', () => {
    it('should extract library path from Windows image path', () => {
      const filePath = 'C:\\Users\\lib\\Eagle Library.library\\images\\ITEM_ID.info\\file.png';
      const result = MetadataCacheService.resolveLibraryPath(filePath);
      expect(result).toBeTruthy();
      expect(result).toContain('Eagle Library.library');
      // Check that it contains both parent directories (platform-independent)
      expect(result).toMatch(/Users.*lib.*Eagle Library\.library/);
    });

    it('should return null when no images directory found', () => {
      const filePath = 'C:\\Users\\lib\\random\\path\\file.png';
      const result = MetadataCacheService.resolveLibraryPath(filePath);
      expect(result).toBeNull();
    });

    it('should return null for null input', () => {
      const result = MetadataCacheService.resolveLibraryPath(null);
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = MetadataCacheService.resolveLibraryPath('');
      expect(result).toBeNull();
    });

    it('should extract library path from relative Windows path', () => {
      const filePath = '.\\Eagle Library.library\\images\\ITEM.info\\img.png';
      const result = MetadataCacheService.resolveLibraryPath(filePath);
      expect(result).toBeTruthy();
      expect(result).toContain('Eagle Library.library');
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent get/set operations', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        id: `item-${i}`,
        metadata: { index: i, timestamp: Date.now() }
      }));

      // Write all items concurrently
      await Promise.all(
        items.map(item => cacheService.set(item.id, item.metadata))
      );

      // Read all items concurrently
      const results = await Promise.all(
        items.map(item => cacheService.get(item.id))
      );

      results.forEach((result, index) => {
        expect(result).toEqual(items[index].metadata);
      });
    });

    it('should handle concurrent delete operations', async () => {
      const itemIds = ['item-a', 'item-b', 'item-c'];
      const metadata = { format: 'comfyui' };

      // Write items
      await Promise.all(itemIds.map(id => cacheService.set(id, metadata)));

      // Delete concurrently
      await Promise.all(itemIds.map(id => cacheService.delete(id)));

      // Verify all deleted
      const results = await Promise.all(
        itemIds.map(id => cacheService.get(id))
      );
      expect(results).toEqual([null, null, null]);
    });
  });
});
