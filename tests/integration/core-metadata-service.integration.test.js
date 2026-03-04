/**
 * Integration test for core.js processMetadata with MetadataService
 * 
 * This test ensures that processMetadata correctly handles metadata
 * from MetadataService without causing infinite loops or double parsing.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Import the modules
const MetadataService = require('../../js/metadata-parser/integration/MetadataService.js');
const { processMetadata } = require('../../js/core.js');

describe('core.js + MetadataService Integration', () => {
  const mockT = (key) => key; // Simple translation mock
  const allSettings = {
    checkpoint: true,
    lora: true,
    positive: true,
    negative: true,
    seed: true,
    sampler: true,
    steps: true,
    cfg: true,
    addTags: true,
    writeNotes: true
  };

  describe('processMetadata with parsed metadata object', () => {
    it('should accept pre-parsed metadata object (mode 1)', () => {
      const parsedMeta = {
        checkpoint: 'test_model.safetensors',
        loras: ['lora1.safetensors'],
        positive: 'test prompt',
        negative: 'bad quality',
        seed: 12345,
        steps: 20,
        cfg: 7.0,
        sampler: 'euler'
      };

      const result = processMetadata(parsedMeta, allSettings, mockT);

      expect(result).toBeDefined();
      expect(result.tags).toBeInstanceOf(Set);
      expect(result.annotation).toBeDefined();
      expect(result.tags.has('test_model')).toBe(true);
      expect(result.tags.has('seed:12345')).toBe(true);
    });

    it('should not cause infinite loop with null metadata and no buffer', () => {
      // This should return empty result, not hang
      const result = processMetadata(null, allSettings, mockT);

      expect(result).toBeDefined();
      expect(result.tags).toBeInstanceOf(Set);
      expect(result.tags.size).toBe(0);
    });
  });

  describe('processMetadata with buffer and mimeType (mode 2)', () => {
    it('should parse ComfyUI PNG using MetadataService internally', () => {
      const samplePath = join(__dirname, '../fixtures/comfyui_simple.png');
      let buffer;
      try {
        buffer = readFileSync(samplePath);
      } catch (e) {
        console.warn('Sample file not found, skipping test');
        return;
      }

      const result = processMetadata(null, allSettings, mockT, buffer, 'image/png');

      expect(result).toBeDefined();
      expect(result.tags).toBeInstanceOf(Set);
      expect(result.annotation).toBeDefined();
      // Should have extracted some metadata
      expect(result.tags.size).toBeGreaterThan(0);
    });

    it('should not cause double parsing when buffer is provided', () => {
      const samplePath = join(__dirname, '../fixtures/comfyui_simple.png');
      let buffer;
      try {
        buffer = readFileSync(samplePath);
      } catch (e) {
        console.warn('Sample file not found, skipping test');
        return;
      }

      // This should complete quickly without hanging
      const startTime = Date.now();
      const result = processMetadata(null, allSettings, mockT, buffer, 'image/png');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
      expect(result).toBeDefined();
    });
  });

  describe('Correct usage pattern (as in plugin.js)', () => {
    it('should work with MetadataService -> processMetadata flow', () => {
      const samplePath = join(__dirname, '../fixtures/comfyui_simple.png');
      let buffer;
      try {
        buffer = readFileSync(samplePath);
      } catch (e) {
        console.warn('Sample file not found, skipping test');
        return;
      }

      // Step 1: Extract metadata using MetadataService (as in plugin.js)
      const metadataService = new MetadataService();
      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/png', 'comfyui');

      expect(metadata).toBeDefined();

      // Step 2: Pass parsed metadata to processMetadata (CORRECT way)
      const result = processMetadata(metadata, allSettings, mockT);

      expect(result).toBeDefined();
      expect(result.tags).toBeInstanceOf(Set);
      expect(result.annotation).toBeDefined();
      expect(result.tags.size).toBeGreaterThan(0);
    });

    it('should NOT pass null + buffer to processMetadata (INCORRECT way)', () => {
      const samplePath = join(__dirname, '../fixtures/comfyui_simple.png');
      let buffer;
      try {
        buffer = readFileSync(samplePath);
      } catch (e) {
        console.warn('Sample file not found, skipping test');
        return;
      }

      // Step 1: Extract metadata using MetadataService
      const metadataService = new MetadataService();
      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/png', 'comfyui');

      expect(metadata).toBeDefined();

      // Step 2: INCORRECT - passing null + buffer causes double parsing
      // This test documents the bug we fixed
      const startTime = Date.now();
      const result = processMetadata(null, allSettings, mockT, buffer, 'image/png');
      const duration = Date.now() - startTime;

      // Should still work but is inefficient (double parsing)
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(1000); // Should not hang
    });
  });

  describe('Performance regression test', () => {
    it('should process metadata in reasonable time', () => {
      const samplePath = join(__dirname, '../fixtures/comfyui_simple.png');
      let buffer;
      try {
        buffer = readFileSync(samplePath);
      } catch (e) {
        console.warn('Sample file not found, skipping test');
        return;
      }

      const metadataService = new MetadataService();
      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/png', 'comfyui');

      const startTime = Date.now();
      const result = processMetadata(metadata, allSettings, mockT);
      const duration = Date.now() - startTime;

      // processMetadata should be very fast (just formatting)
      expect(duration).toBeLessThan(100); // Should complete in less than 100ms
      expect(result).toBeDefined();
    });
  });
});
