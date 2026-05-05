import { describe, it, expect, beforeEach } from 'vitest';
import ContainerReaderRegistry from '../../../js/metadata-parser/containers/ContainerReaderRegistry.js';
import BaseContainerReader from '../../../js/metadata-parser/containers/BaseContainerReader.js';

describe('ContainerReaderRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new ContainerReaderRegistry();
  });

  describe('register', () => {
    it('registers a reader and enables chaining', () => {
      const mockReader = new TestReader();
      const result = registry.register(mockReader);
      expect(result).toBe(registry);
    });

    it('registers reader for all its supported MIME types', () => {
      const mockReader = new TestReader();
      registry.register(mockReader);
      expect(registry.getReader('test/type1')).toBe(mockReader);
      expect(registry.getReader('test/type2')).toBe(mockReader);
    });

    it('allows registering multiple readers', () => {
      const reader1 = new TestReader();
      const reader2 = new AnotherTestReader();
      registry.register(reader1).register(reader2);
      expect(registry.getReader('test/type1')).toBe(reader1);
      expect(registry.getReader('other/type')).toBe(reader2);
    });

    it('overwrites previous reader for same MIME type', () => {
      const reader1 = new TestReader();
      const reader2 = new TestReader();
      registry.register(reader1);
      registry.register(reader2);
      expect(registry.getReader('test/type1')).toBe(reader2);
    });
  });

  describe('getReader', () => {
    it('returns registered reader for known MIME type', () => {
      const mockReader = new TestReader();
      registry.register(mockReader);
      expect(registry.getReader('test/type1')).toBe(mockReader);
    });

    it('returns null for unknown MIME type', () => {
      expect(registry.getReader('unknown/type')).toBeNull();
    });

    it('is case-sensitive for MIME type', () => {
      const mockReader = new TestReader();
      registry.register(mockReader);
      expect(registry.getReader('TEST/type1')).toBeNull();
    });
  });

  describe('getSupportedMimeTypes', () => {
    it('returns empty array for empty registry', () => {
      expect(registry.getSupportedMimeTypes()).toEqual([]);
    });

    it('returns all supported MIME types', () => {
      const reader1 = new TestReader();
      const reader2 = new AnotherTestReader();
      registry.register(reader1).register(reader2);
      const types = registry.getSupportedMimeTypes();
      expect(types).toContain('test/type1');
      expect(types).toContain('test/type2');
      expect(types).toContain('other/type');
    });
  });

  describe('createDefault', () => {
    it('creates registry with PNG, WebP, JPEG readers', () => {
      const defaultRegistry = ContainerReaderRegistry.createDefault();
      expect(defaultRegistry.getReader('image/png')).toBeDefined();
      expect(defaultRegistry.getReader('image/webp')).toBeDefined();
      expect(defaultRegistry.getReader('image/jpeg')).toBeDefined();
      expect(defaultRegistry.getReader('image/jpg')).toBeDefined();
    });

    it('default registry supports 5 MIME types', () => {
      const defaultRegistry = ContainerReaderRegistry.createDefault();
      const types = defaultRegistry.getSupportedMimeTypes();
      expect(types.length).toBe(5);
    });

    it('all default readers are not null', () => {
      const defaultRegistry = ContainerReaderRegistry.createDefault();
      expect(defaultRegistry.getReader('image/png')).not.toBeNull();
      expect(defaultRegistry.getReader('image/webp')).not.toBeNull();
      expect(defaultRegistry.getReader('image/jpeg')).not.toBeNull();
      expect(defaultRegistry.getReader('image/jpg')).not.toBeNull();
      expect(defaultRegistry.getReader('video/mp4')).not.toBeNull();
    });
  });
});

// Test helpers
class TestReader extends BaseContainerReader {
  getSupportedMimeTypes() {
    return ['test/type1', 'test/type2'];
  }

  extractRawChunks(buffer) {
    return {};
  }
}

class AnotherTestReader extends BaseContainerReader {
  getSupportedMimeTypes() {
    return ['other/type'];
  }

  extractRawChunks(buffer) {
    return {};
  }
}
