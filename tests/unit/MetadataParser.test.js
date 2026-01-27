import { describe, it, expect } from 'vitest';
import MetadataParser from '../../js/metadata-parser/parsers/MetadataParser.js';

describe('MetadataParser', () => {
  describe('abstract methods', () => {
    it('should throw error when getFormatName is not implemented', () => {
      const parser = new MetadataParser();
      expect(() => parser.getFormatName()).toThrow('Must implement getFormatName()');
    });

    it('should throw error when parse is not implemented', () => {
      const parser = new MetadataParser();
      expect(() => parser.parse({})).toThrow('Must implement parse()');
    });
  });

  describe('subclass implementation', () => {
    it('should allow subclass to implement getFormatName', () => {
      class TestParser extends MetadataParser {
        getFormatName() {
          return 'test-format';
        }
      }

      const parser = new TestParser();
      expect(parser.getFormatName()).toBe('test-format');
    });

    it('should allow subclass to implement parse', () => {
      class TestParser extends MetadataParser {
        parse(rawChunks) {
          return {
            format: 'test-format',
            data: rawChunks
          };
        }
      }

      const parser = new TestParser();
      const result = parser.parse({ test: 'data' });
      expect(result).toEqual({
        format: 'test-format',
        data: { test: 'data' }
      });
    });

    it('should allow subclass to implement both methods', () => {
      class TestParser extends MetadataParser {
        getFormatName() {
          return 'test-format';
        }

        parse(rawChunks) {
          return {
            format: this.getFormatName(),
            checkpoint: rawChunks.checkpoint,
            positive: rawChunks.positive
          };
        }
      }

      const parser = new TestParser();
      expect(parser.getFormatName()).toBe('test-format');
      
      const result = parser.parse({
        checkpoint: 'model.safetensors',
        positive: 'test prompt'
      });
      
      expect(result).toEqual({
        format: 'test-format',
        checkpoint: 'model.safetensors',
        positive: 'test prompt'
      });
    });

    it('should still throw error if subclass only implements getFormatName', () => {
      class PartialParser extends MetadataParser {
        getFormatName() {
          return 'partial-format';
        }
      }

      const parser = new PartialParser();
      expect(parser.getFormatName()).toBe('partial-format');
      expect(() => parser.parse({})).toThrow('Must implement parse()');
    });

    it('should still throw error if subclass only implements parse', () => {
      class PartialParser extends MetadataParser {
        parse(rawChunks) {
          return { format: 'partial', data: rawChunks };
        }
      }

      const parser = new PartialParser();
      expect(() => parser.getFormatName()).toThrow('Must implement getFormatName()');
      expect(parser.parse({ test: 'data' })).toEqual({
        format: 'partial',
        data: { test: 'data' }
      });
    });
  });

  describe('ParsedMetadata structure', () => {
    it('should support all documented ParsedMetadata fields', () => {
      class FullParser extends MetadataParser {
        getFormatName() {
          return 'full-format';
        }

        parse(rawChunks) {
          return {
            format: 'full-format',
            checkpoint: 'model.safetensors',
            loras: ['lora1.safetensors', 'lora2.safetensors'],
            positive: 'positive prompt',
            negative: 'negative prompt',
            seed: 123456,
            steps: 20,
            cfg: 7.5,
            sampler: 'euler_a',
            scheduler: 'normal',
            extra_samplers: [
              { id: '1', seed: 123456, sampler: 'euler', is_base: true }
            ],
            sampler_fallback: false
          };
        }
      }

      const parser = new FullParser();
      const result = parser.parse({});
      
      expect(result).toHaveProperty('format');
      expect(result).toHaveProperty('checkpoint');
      expect(result).toHaveProperty('loras');
      expect(result).toHaveProperty('positive');
      expect(result).toHaveProperty('negative');
      expect(result).toHaveProperty('seed');
      expect(result).toHaveProperty('steps');
      expect(result).toHaveProperty('cfg');
      expect(result).toHaveProperty('sampler');
      expect(result).toHaveProperty('scheduler');
      expect(result).toHaveProperty('extra_samplers');
      expect(result).toHaveProperty('sampler_fallback');
      
      expect(result.format).toBe('full-format');
      expect(result.checkpoint).toBe('model.safetensors');
      expect(result.loras).toEqual(['lora1.safetensors', 'lora2.safetensors']);
      expect(result.positive).toBe('positive prompt');
      expect(result.negative).toBe('negative prompt');
      expect(result.seed).toBe(123456);
      expect(result.steps).toBe(20);
      expect(result.cfg).toBe(7.5);
      expect(result.sampler).toBe('euler_a');
      expect(result.scheduler).toBe('normal');
      expect(result.extra_samplers).toHaveLength(1);
      expect(result.sampler_fallback).toBe(false);
    });

    it('should support minimal ParsedMetadata with only format field', () => {
      class MinimalParser extends MetadataParser {
        getFormatName() {
          return 'minimal-format';
        }

        parse(rawChunks) {
          return {
            format: 'minimal-format'
          };
        }
      }

      const parser = new MinimalParser();
      const result = parser.parse({});
      
      expect(result).toEqual({
        format: 'minimal-format'
      });
    });
  });
});
