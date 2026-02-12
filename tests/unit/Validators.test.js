import { describe, it, expect } from 'vitest';
import Validators from '../../js/metadata-parser/utils/Validators.js';

describe('Validators', () => {
  describe('validateRawChunks', () => {
    it('should accept valid raw chunks object', () => {
      const chunks = { workflow: {}, prompt: {} };
      expect(Validators.validateRawChunks(chunks)).toBe(true);
    });

    it('should accept empty object', () => {
      expect(Validators.validateRawChunks({})).toBe(true);
    });

    it('should throw error for null', () => {
      expect(() => Validators.validateRawChunks(null)).toThrow('Raw chunks must be an object');
    });

    it('should throw error for undefined', () => {
      expect(() => Validators.validateRawChunks(undefined)).toThrow('Raw chunks must be an object');
    });

    it('should throw error for array', () => {
      expect(() => Validators.validateRawChunks([])).toThrow('Raw chunks must be an object, not an array');
    });

    it('should throw error for string', () => {
      expect(() => Validators.validateRawChunks('chunks')).toThrow('Raw chunks must be an object');
    });

    it('should throw error for number', () => {
      expect(() => Validators.validateRawChunks(123)).toThrow('Raw chunks must be an object');
    });
  });

  describe('validateParsedMetadata', () => {
    it('should accept valid metadata', () => {
      const metadata = {
        format: 'comfyui',
        checkpoint: 'model.safetensors',
        loras: ['lora1.safetensors'],
        positive: 'cat',
        negative: 'ugly',
        seed: 123456,
        steps: 20,
        cfg: 7.0,
        sampler: 'euler',
        scheduler: 'normal'
      };
      expect(Validators.validateParsedMetadata(metadata)).toBe(true);
    });

    it('should accept minimal valid metadata', () => {
      const metadata = { format: 'a1111' };
      expect(Validators.validateParsedMetadata(metadata)).toBe(true);
    });

    it('should accept null values for optional fields', () => {
      const metadata = {
        format: 'comfyui',
        checkpoint: null,
        loras: null,
        positive: null,
        negative: null,
        seed: null,
        steps: null,
        cfg: null,
        sampler: null,
        scheduler: null
      };
      expect(Validators.validateParsedMetadata(metadata)).toBe(true);
    });

    it('should throw error for missing format', () => {
      const metadata = { checkpoint: 'model.safetensors' };
      expect(() => Validators.validateParsedMetadata(metadata)).toThrow('Parsed metadata must have a format string');
    });

    it('should throw error for null format', () => {
      const metadata = { format: null };
      expect(() => Validators.validateParsedMetadata(metadata)).toThrow('Parsed metadata must have a format string');
    });

    it('should throw error for non-string format', () => {
      const metadata = { format: 123 };
      expect(() => Validators.validateParsedMetadata(metadata)).toThrow('Parsed metadata must have a format string');
    });

    it('should throw error for null input', () => {
      expect(() => Validators.validateParsedMetadata(null)).toThrow('Parsed metadata must be an object');
    });

    it('should throw error for array input', () => {
      expect(() => Validators.validateParsedMetadata([])).toThrow('Parsed metadata must be an object, not an array');
    });

    it('should throw error for non-string checkpoint', () => {
      const metadata = { format: 'comfyui', checkpoint: 123 };
      expect(() => Validators.validateParsedMetadata(metadata)).toThrow('Checkpoint must be a string or null');
    });

    it('should throw error for non-array loras', () => {
      const metadata = { format: 'comfyui', loras: 'not-array' };
      expect(() => Validators.validateParsedMetadata(metadata)).toThrow('LoRAs must be an array or null');
    });

    it('should throw error for non-string positive', () => {
      const metadata = { format: 'comfyui', positive: 123 };
      expect(() => Validators.validateParsedMetadata(metadata)).toThrow('Positive prompt must be a string or null');
    });

    it('should throw error for non-string negative', () => {
      const metadata = { format: 'comfyui', negative: 123 };
      expect(() => Validators.validateParsedMetadata(metadata)).toThrow('Negative prompt must be a string or null');
    });

    it('should throw error for non-number seed', () => {
      const metadata = { format: 'comfyui', seed: '123' };
      expect(() => Validators.validateParsedMetadata(metadata)).toThrow('Seed must be a number or null');
    });

    it('should throw error for non-number steps', () => {
      const metadata = { format: 'comfyui', steps: '20' };
      expect(() => Validators.validateParsedMetadata(metadata)).toThrow('Steps must be a number or null');
    });

    it('should throw error for non-number cfg', () => {
      const metadata = { format: 'comfyui', cfg: '7.0' };
      expect(() => Validators.validateParsedMetadata(metadata)).toThrow('CFG must be a number or null');
    });

    it('should throw error for non-string sampler', () => {
      const metadata = { format: 'comfyui', sampler: 123 };
      expect(() => Validators.validateParsedMetadata(metadata)).toThrow('Sampler must be a string or null');
    });

    it('should throw error for non-string scheduler', () => {
      const metadata = { format: 'comfyui', scheduler: 123 };
      expect(() => Validators.validateParsedMetadata(metadata)).toThrow('Scheduler must be a string or null');
    });
  });

  describe('validateSettings', () => {
    it('should accept valid settings', () => {
      const settings = {
        checkpoint: true,
        lora: true,
        positive: true,
        negative: true,
        seed: true,
        sampler: true,
        steps: true,
        cfg: true,
        addTags: true,
        writeNotes: true,
        debug: false,
        chunkSize: 5
      };
      expect(Validators.validateSettings(settings)).toBe(true);
    });

    it('should accept empty settings', () => {
      expect(Validators.validateSettings({})).toBe(true);
    });

    it('should accept partial settings', () => {
      const settings = { checkpoint: true, chunkSize: 10 };
      expect(Validators.validateSettings(settings)).toBe(true);
    });

    it('should throw error for null', () => {
      expect(() => Validators.validateSettings(null)).toThrow('Settings must be an object');
    });

    it('should throw error for array', () => {
      expect(() => Validators.validateSettings([])).toThrow('Settings must be an object, not an array');
    });

    it('should throw error for non-boolean checkpoint', () => {
      const settings = { checkpoint: 'true' };
      expect(() => Validators.validateSettings(settings)).toThrow('checkpoint must be a boolean');
    });

    it('should throw error for non-boolean lora', () => {
      const settings = { lora: 1 };
      expect(() => Validators.validateSettings(settings)).toThrow('lora must be a boolean');
    });

    it('should throw error for non-boolean positive', () => {
      const settings = { positive: 'yes' };
      expect(() => Validators.validateSettings(settings)).toThrow('positive must be a boolean');
    });

    it('should throw error for non-boolean negative', () => {
      const settings = { negative: 0 };
      expect(() => Validators.validateSettings(settings)).toThrow('negative must be a boolean');
    });

    it('should throw error for non-boolean seed', () => {
      const settings = { seed: null };
      expect(() => Validators.validateSettings(settings)).toThrow('seed must be a boolean');
    });

    it('should throw error for non-boolean sampler', () => {
      const settings = { sampler: [] };
      expect(() => Validators.validateSettings(settings)).toThrow('sampler must be a boolean');
    });

    it('should throw error for non-boolean steps', () => {
      const settings = { steps: {} };
      expect(() => Validators.validateSettings(settings)).toThrow('steps must be a boolean');
    });

    it('should throw error for non-boolean cfg', () => {
      const settings = { cfg: undefined };
      expect(() => Validators.validateSettings(settings)).toThrow('cfg must be a boolean');
    });

    it('should throw error for non-boolean addTags', () => {
      const settings = { addTags: 1 };
      expect(() => Validators.validateSettings(settings)).toThrow('addTags must be a boolean');
    });

    it('should throw error for non-boolean writeNotes', () => {
      const settings = { writeNotes: 'false' };
      expect(() => Validators.validateSettings(settings)).toThrow('writeNotes must be a boolean');
    });

    it('should throw error for non-boolean debug', () => {
      const settings = { debug: null };
      expect(() => Validators.validateSettings(settings)).toThrow('debug must be a boolean');
    });

    it('should throw error for non-number chunkSize', () => {
      const settings = { chunkSize: '5' };
      expect(() => Validators.validateSettings(settings)).toThrow('chunkSize must be a number');
    });

    it('should throw error for chunkSize less than 1', () => {
      const settings = { chunkSize: 0 };
      expect(() => Validators.validateSettings(settings)).toThrow('chunkSize must be at least 1');
    });

    it('should throw error for negative chunkSize', () => {
      const settings = { chunkSize: -5 };
      expect(() => Validators.validateSettings(settings)).toThrow('chunkSize must be at least 1');
    });
  });

  describe('validateBuffer', () => {
    it('should accept valid buffer', () => {
      const buffer = new Uint8Array([1, 2, 3, 4]);
      expect(Validators.validateBuffer(buffer)).toBe(true);
    });

    it('should accept empty buffer', () => {
      const buffer = new Uint8Array([]);
      expect(Validators.validateBuffer(buffer)).toBe(true);
    });

    it('should accept buffer with minimum size', () => {
      const buffer = new Uint8Array([1, 2, 3, 4]);
      expect(Validators.validateBuffer(buffer, 4)).toBe(true);
    });

    it('should throw error for buffer smaller than minimum', () => {
      const buffer = new Uint8Array([1, 2, 3]);
      expect(() => Validators.validateBuffer(buffer, 4)).toThrow('Buffer too small: 3 bytes (minimum: 4 bytes)');
    });

    it('should throw error for non-Uint8Array', () => {
      expect(() => Validators.validateBuffer([1, 2, 3])).toThrow('Buffer must be a Uint8Array');
    });

    it('should throw error for null', () => {
      expect(() => Validators.validateBuffer(null)).toThrow('Buffer must be a Uint8Array');
    });

    it('should throw error for string', () => {
      expect(() => Validators.validateBuffer('buffer')).toThrow('Buffer must be a Uint8Array');
    });
  });

  describe('validateMimeType', () => {
    it('should accept image/png', () => {
      expect(Validators.validateMimeType('image/png')).toBe(true);
    });

    it('should accept image/webp', () => {
      expect(Validators.validateMimeType('image/webp')).toBe(true);
    });

    it('should throw error for unsupported MIME type', () => {
      expect(() => Validators.validateMimeType('image/jpeg')).toThrow('Unsupported MIME type: image/jpeg');
    });

    it('should throw error for empty string', () => {
      expect(() => Validators.validateMimeType('')).toThrow('MIME type must be a non-empty string');
    });

    it('should throw error for null', () => {
      expect(() => Validators.validateMimeType(null)).toThrow('MIME type must be a non-empty string');
    });

    it('should throw error for non-string', () => {
      expect(() => Validators.validateMimeType(123)).toThrow('MIME type must be a non-empty string');
    });
  });

  describe('validateFormat', () => {
    it('should accept comfyui format', () => {
      expect(Validators.validateFormat('comfyui')).toBe(true);
    });

    it('should accept a1111 format', () => {
      expect(Validators.validateFormat('a1111')).toBe(true);
    });

    it('should throw error for unknown format', () => {
      expect(() => Validators.validateFormat('unknown')).toThrow('Unknown format: unknown');
    });

    it('should throw error for empty string', () => {
      expect(() => Validators.validateFormat('')).toThrow('Format must be a non-empty string');
    });

    it('should throw error for null', () => {
      expect(() => Validators.validateFormat(null)).toThrow('Format must be a non-empty string');
    });

    it('should throw error for non-string', () => {
      expect(() => Validators.validateFormat(123)).toThrow('Format must be a non-empty string');
    });
  });
});
