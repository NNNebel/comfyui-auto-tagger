import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const LoraHashHandler = require('../../js/metadata-parser/parameters/LoraHashHandler.js');

describe('LoraHashHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new LoraHashHandler();
  });

  describe('canHandle', () => {
    it('should handle "Lora hashes" parameter', () => {
      expect(handler.canHandle('Lora hashes')).toBe(true);
    });

    it('should not handle other parameters', () => {
      expect(handler.canHandle('Steps')).toBe(false);
      expect(handler.canHandle('Lora')).toBe(false);
      expect(handler.canHandle('lora hashes')).toBe(false);
    });
  });

  describe('handle', () => {
    it('should parse single LoRA hash', () => {
      const result = handler.handle('Lora hashes', 'myLora: abc123', {});
      expect(result).toEqual({
        lora_hashes: { myLora: 'abc123' },
        loras: ['myLora']
      });
    });

    it('should parse multiple LoRA hashes', () => {
      const result = handler.handle('Lora hashes', 'lora1: hash1, lora2: hash2, lora3: hash3', {});
      expect(result).toEqual({
        lora_hashes: {
          lora1: 'hash1',
          lora2: 'hash2',
          lora3: 'hash3'
        },
        loras: ['lora1', 'lora2', 'lora3']
      });
    });

    it('should handle LoRA names with spaces', () => {
      const result = handler.handle('Lora hashes', 'my lora: abc123, another lora: def456', {});
      expect(result).toEqual({
        lora_hashes: {
          'my lora': 'abc123',
          'another lora': 'def456'
        },
        loras: ['my lora', 'another lora']
      });
    });

    it('should handle hashes with special characters', () => {
      const result = handler.handle('Lora hashes', 'lora1: abc-123_xyz, lora2: def.456', {});
      expect(result).toEqual({
        lora_hashes: {
          lora1: 'abc-123_xyz',
          lora2: 'def.456'
        },
        loras: ['lora1', 'lora2']
      });
    });

    it('should trim whitespace from names and hashes', () => {
      const result = handler.handle('Lora hashes', '  lora1  :  hash1  ,  lora2  :  hash2  ', {});
      expect(result).toEqual({
        lora_hashes: {
          lora1: 'hash1',
          lora2: 'hash2'
        },
        loras: ['lora1', 'lora2']
      });
    });

    it('should return empty object for empty value', () => {
      const result = handler.handle('Lora hashes', '', {});
      expect(result).toEqual({});
    });

    it('should skip invalid entries', () => {
      const result = handler.handle('Lora hashes', 'valid: hash1, invalid, another: hash2', {});
      expect(result).toEqual({
        lora_hashes: {
          valid: 'hash1',
          another: 'hash2'
        },
        loras: ['valid', 'another']
      });
    });
  });

  describe('getPriority', () => {
    it('should return medium-high priority', () => {
      expect(handler.getPriority()).toBe(20);
    });
  });
});
