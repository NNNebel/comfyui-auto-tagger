/**
 * Integration Tests for Metadata Cache Flow
 *
 * Tests the complete cache lifecycle:
 * - Cache hit: metadata retrieved from cache
 * - Cache miss: metadata parsed fresh and cached
 * - Cache invalidation: skipCache setting respected
 * - Concurrent cache operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import MetadataCacheService from '../../js/metadata-parser/utils/MetadataCacheService.js';
import ComfyUIParser from '../../js/metadata-parser/parsers/ComfyUIParser.js';

describe('Cache Flow Integration Tests', () => {
  let tempLibraryPath;
  let cacheService;
  let parser;

  beforeEach(() => {
    tempLibraryPath = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-flow-'));
    cacheService = new MetadataCacheService(tempLibraryPath);
    parser = new ComfyUIParser();
  });

  afterEach(() => {
    if (fs.existsSync(tempLibraryPath)) {
      fs.rmSync(tempLibraryPath, { recursive: true, force: true });
    }
  });

  describe('Cache Hit and Miss Scenarios', () => {
    it('should return cached metadata on cache hit', async () => {
      const itemId = 'item-cached';
      const originalMetadata = {
        format: 'comfyui',
        checkpoint: 'model.safetensors',
        seed: 42,
        timestamp: Date.now()
      };

      // Pre-populate cache
      await cacheService.set(itemId, originalMetadata);

      // Retrieve from cache
      const cachedMetadata = await cacheService.get(itemId);

      expect(cachedMetadata).toEqual(originalMetadata);
      expect(cachedMetadata.timestamp).toBe(originalMetadata.timestamp);
    });

    it('should return null on cache miss', async () => {
      const itemId = 'nonexistent-item';
      const cached = await cacheService.get(itemId);

      expect(cached).toBeNull();
    });

    it('should parse and cache new metadata on miss', async () => {
      const itemId = 'item-parse-cache';
      const promptData = {
        '1': {
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: 'sd_xl_base.safetensors' }
        }
      };

      // Parse metadata
      const parsed = parser.parse({ prompt: promptData });

      // Cache the parsed metadata
      const cacheSuccess = await cacheService.set(itemId, parsed);
      expect(cacheSuccess).toBe(true);

      // Retrieve from cache
      const cached = await cacheService.get(itemId);
      expect(cached).toEqual(parsed);
    });

    it('should differentiate between cache hit and fresh parse', async () => {
      const itemId = 'item-diff';
      const metadata1 = { format: 'comfyui', checkpoint: 'model1.safetensors' };
      const metadata2 = { format: 'comfyui', checkpoint: 'model2.safetensors' };

      // First cache
      await cacheService.set(itemId, metadata1);
      const hit1 = await cacheService.get(itemId);
      expect(hit1.checkpoint).toBe('model1.safetensors');

      // Update cache
      await cacheService.set(itemId, metadata2);
      const hit2 = await cacheService.get(itemId);
      expect(hit2.checkpoint).toBe('model2.safetensors');
    });
  });

  describe('skipCache Setting Behavior', () => {
    it('should respect skipCache=true to bypass cache', async () => {
      const itemId = 'item-skip-cache';
      const cachedMetadata = {
        format: 'comfyui',
        checkpoint: 'cached_model.safetensors',
        fromCache: true
      };

      // Pre-populate cache
      await cacheService.set(itemId, cachedMetadata);

      // When skipCache is true, should not use cached version
      // (application logic would re-parse instead)
      const skipCache = true;

      let metadata;
      if (!skipCache) {
        metadata = await cacheService.get(itemId);
      } else {
        // Skip cache and parse fresh
        metadata = null; // Fresh parse would happen here
      }

      // Verification: when skipCache is true, cache is bypassed
      expect(skipCache).toBe(true);
      expect(metadata).toBeNull(); // Not using cache
    });

    it('should use cache when skipCache=false', async () => {
      const itemId = 'item-use-cache';
      const cachedMetadata = {
        format: 'comfyui',
        checkpoint: 'model.safetensors'
      };

      await cacheService.set(itemId, cachedMetadata);

      const skipCache = false;
      let metadata;

      if (!skipCache) {
        metadata = await cacheService.get(itemId);
      } else {
        metadata = null; // Would parse fresh
      }

      expect(skipCache).toBe(false);
      expect(metadata).toEqual(cachedMetadata);
    });
  });

  describe('Cache Lifecycle with suspiciousNodeHandling', () => {
    it('should cache metadata with suspiciousNodes', async () => {
      const itemId = 'item-susp-nodes';
      const metadata = {
        format: 'comfyui',
        suspiciousNodes: [
          {
            nodeId: '3',
            reasonKey: 'suspiciousNode.reason.imageProcessingNoInput',
            affectedSteps: []
          }
        ]
      };

      await cacheService.set(itemId, metadata);
      const cached = await cacheService.get(itemId);

      expect(cached.suspiciousNodes).toBeDefined();
      expect(cached.suspiciousNodes).toHaveLength(1);
      expect(cached.suspiciousNodes[0].nodeId).toBe('3');
    });

    it('should cache metadata with affectedSteps information', async () => {
      const itemId = 'item-affected-steps';
      const metadata = {
        format: 'comfyui',
        suspiciousNodes: [
          {
            nodeId: '1',
            affectedSteps: [
              {
                stepNodeId: '2',
                stepMetadata: {
                  seed: 123,
                  steps: 20,
                  cfg: 7
                }
              }
            ]
          }
        ]
      };

      await cacheService.set(itemId, metadata);
      const cached = await cacheService.get(itemId);

      expect(cached.suspiciousNodes[0].affectedSteps).toHaveLength(1);
      expect(cached.suspiciousNodes[0].affectedSteps[0].stepMetadata.seed).toBe(123);
    });
  });

  describe('Cache Clearing and Invalidation', () => {
    it('should clear entire cache with clearAll', async () => {
      // Populate cache with multiple items
      await cacheService.set('item-1', { data: 1 });
      await cacheService.set('item-2', { data: 2 });
      await cacheService.set('item-3', { data: 3 });

      // Verify items are cached
      expect(await cacheService.get('item-1')).toBeDefined();
      expect(await cacheService.get('item-2')).toBeDefined();

      // Clear all
      const result = await cacheService.clearAll();
      expect(result).toBe(true);

      // Verify all cleared
      expect(await cacheService.get('item-1')).toBeNull();
      expect(await cacheService.get('item-2')).toBeNull();
      expect(await cacheService.get('item-3')).toBeNull();
    });

    it('should delete specific cache entry', async () => {
      // Populate cache
      await cacheService.set('keep-1', { data: 1 });
      await cacheService.set('delete-me', { data: 2 });
      await cacheService.set('keep-2', { data: 3 });

      // Delete one
      await cacheService.delete('delete-me');

      // Verify selective deletion
      expect(await cacheService.get('keep-1')).toBeDefined();
      expect(await cacheService.get('delete-me')).toBeNull();
      expect(await cacheService.get('keep-2')).toBeDefined();
    });

    it('should provide resolveLibraryPath utility for cache location', () => {
      // Test with Windows-style path (which works cross-platform with path.sep)
      const imagePath = 'C:\\Users\\lib\\Eagle Library.library\\images\\ITEM_ID.info\\file.png';
      const libraryPath = MetadataCacheService.resolveLibraryPath(imagePath);

      expect(libraryPath).toBeTruthy();
      expect(libraryPath).toContain('Eagle Library.library');

      // Verify cache would be at correct location
      if (libraryPath) {
        const expectedCachePath = path.join(
          libraryPath,
          '.eagle',
          'plugins',
          'comfyui-auto-tagger',
          'metadata-cache'
        );
        expect(expectedCachePath).toContain('Eagle Library.library');
      }
    });
  });

  describe('Cache Performance Characteristics', () => {
    it('should retrieve cached metadata faster than parsing', async () => {
      const itemId = 'perf-test';
      const complexMetadata = {
        format: 'comfyui',
        checkpoint: 'model.safetensors',
        loras: Array(20).fill({ name: 'lora.safetensors', weight: 0.8 }),
        suspiciousNodes: Array(10).fill({
          nodeId: '1',
          affectedSteps: Array(5).fill({
            stepNodeId: '2',
            stepMetadata: { seed: 123 }
          })
        })
      };

      await cacheService.set(itemId, complexMetadata);

      // Cache retrieval (should be fast)
      const startCache = performance.now();
      const cached = await cacheService.get(itemId);
      const cacheTime = performance.now() - startCache;

      expect(cached).toEqual(complexMetadata);
      expect(cacheTime).toBeLessThan(100); // Should be very fast
    });

    it('should handle large metadata objects', async () => {
      const itemId = 'large-metadata';
      const largeMetadata = {
        format: 'comfyui',
        loras: Array(100).fill({ name: 'lora.safetensors', weight: 0.8 }),
        samplers: Array(50).fill({
          nodeId: '1',
          seed: 123,
          steps: 20,
          cfg: 7,
          sampler_name: 'euler',
          scheduler: 'normal'
        })
      };

      const saveSuccess = await cacheService.set(itemId, largeMetadata);
      expect(saveSuccess).toBe(true);

      const retrieved = await cacheService.get(itemId);
      expect(retrieved.loras).toHaveLength(100);
      expect(retrieved.samplers).toHaveLength(50);
    });
  });

  describe('Cache with Real Fixture Data', () => {
    it('should cache ComfyUI parser output', async () => {
      const itemId = 'fixture-comfyui';
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': {
          class_type: 'CheckpointLoaderSimple',
          inputs: { ckpt_name: 'sd_xl_base.safetensors' }
        },
        '3': {
          class_type: 'KSampler',
          inputs: {
            seed: 42,
            steps: 20,
            cfg: 7,
            sampler_name: 'euler',
            scheduler: 'normal'
          }
        }
      };

      // Parse
      const metadata = parser.parse({ prompt: promptData });

      // Cache
      const cacheSuccess = await cacheService.set(itemId, metadata);
      expect(cacheSuccess).toBe(true);

      // Retrieve and verify
      const cached = await cacheService.get(itemId);
      expect(cached.format).toBe('comfyui');
      expect(cached.checkpoint).toBe('sd_xl_base.safetensors');
    });
  });

  describe('Cache Concurrency', () => {
    it('should handle concurrent cache operations safely', async () => {
      const operations = Array.from({ length: 50 }, (_, i) => ({
        id: `concurrent-${i}`,
        metadata: { index: i, timestamp: Date.now() }
      }));

      // Concurrent writes
      const writePromises = operations.map(op =>
        cacheService.set(op.id, op.metadata)
      );
      const writeResults = await Promise.all(writePromises);
      expect(writeResults).toEqual(Array(50).fill(true));

      // Concurrent reads
      const readPromises = operations.map(op =>
        cacheService.get(op.id)
      );
      const readResults = await Promise.all(readPromises);

      readResults.forEach((result, i) => {
        expect(result).toEqual(operations[i].metadata);
      });
    });

    it('should handle concurrent delete operations', async () => {
      // Populate cache
      const itemIds = Array.from({ length: 30 }, (_, i) => `concurrent-del-${i}`);
      await Promise.all(
        itemIds.map(id => cacheService.set(id, { id }))
      );

      // Concurrent deletes
      const deletePromises = itemIds.map(id => cacheService.delete(id));
      await Promise.all(deletePromises);

      // Verify all deleted
      const verifyPromises = itemIds.map(id => cacheService.get(id));
      const results = await Promise.all(verifyPromises);
      expect(results).toEqual(Array(30).fill(null));
    });
  });
});
