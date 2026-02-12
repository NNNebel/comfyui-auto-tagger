import { describe, it, expect } from 'vitest';
import MetadataProcessor from '../../js/metadata-processor/MetadataProcessor.js';

// Mock translation function
const t = (key) => {
  const translations = {
    'log.caution.sampler_fallback': 'Base sampler detection may be unreliable',
    'ui.option.checkpoint': 'Checkpoint',
    'ui.option.lora': 'LoRA',
    'ui.option.seed': 'Seed',
    'ui.option.steps': 'Steps',
    'ui.option.sampler': 'Sampler'
  };
  return translations[key] || key;
};

describe('MetadataProcessor', () => {
  describe('process', () => {
    it('should process metadata with tags and annotation', () => {
      const metadata = {
        checkpoint: 'models/checkpoint.safetensors',
        positive: 'beautiful, landscape',
        seed: 12345,
        steps: 20
      };
      const settings = {
        checkpoint: true,
        positive: true,
        seed: true,
        steps: true
      };
      
      const result = MetadataProcessor.process(metadata, settings, t);
      
      expect(result.tags.has('checkpoint')).toBe(true);
      expect(result.tags.has('beautiful')).toBe(true);
      expect(result.tags.has('landscape')).toBe(true);
      expect(result.tags.has('seed:12345')).toBe(true);
      expect(result.tags.has('steps:20')).toBe(true);
      expect(result.annotation).toContain('[Generation Info]');
      expect(result.annotation).toContain('Checkpoint: checkpoint');
      expect(result.annotation).toContain('Seed: 12345');
    });

    it('should return categorized tags', () => {
      const metadata = {
        checkpoint: 'models/checkpoint.safetensors',
        loras: ['loras/lora1.safetensors'],
        positive: 'beautiful',
        negative: 'bad',
        seed: 12345
      };
      const settings = {
        checkpoint: true,
        lora: true,
        positive: true,
        negative: true,
        seed: true
      };
      
      const result = MetadataProcessor.process(metadata, settings, t);
      
      expect(result.cats.cp.has('checkpoint')).toBe(true);
      expect(result.cats.lora.has('lora1')).toBe(true);
      expect(result.cats.pos.has('beautiful')).toBe(true);
      expect(result.cats.neg.has('neg:bad')).toBe(true);
      expect(result.cats.param.has('seed:12345')).toBe(true);
    });

    it('should handle sampler_fallback flag', () => {
      const metadata = {
        sampler_fallback: true,
        checkpoint: 'models/checkpoint.safetensors'
      };
      const settings = { checkpoint: true };
      
      const result = MetadataProcessor.process(metadata, settings, t);
      
      expect(result.sampler_fallback).toBe(true);
      expect(result.annotation).toContain('[Warning]');
    });

    it('should calculate stepCount from generationSteps', () => {
      const metadata = {
        generationSteps: [
          { nodeId: '1', seed: 12345, isBase: true },
          { nodeId: '2', seed: 67890, isBase: false }
        ]
      };
      const settings = { seed: true };
      
      const result = MetadataProcessor.process(metadata, settings, t);
      
      expect(result.stepCount).toBe(2);
    });

    it('should calculate stepCount from extra_samplers', () => {
      const metadata = {
        extra_samplers: [
          { seed: 12345 },
          { seed: 67890 },
          { seed: 11111 }
        ]
      };
      const settings = {};
      
      const result = MetadataProcessor.process(metadata, settings, t);
      
      expect(result.stepCount).toBe(3);
    });

    it('should default stepCount to 1 when no steps', () => {
      const metadata = {
        checkpoint: 'models/checkpoint.safetensors'
      };
      const settings = { checkpoint: true };
      
      const result = MetadataProcessor.process(metadata, settings, t);
      
      expect(result.stepCount).toBe(1);
    });

    it('should handle empty metadata', () => {
      const metadata = {};
      const settings = { checkpoint: true };
      
      const result = MetadataProcessor.process(metadata, settings, t);
      
      expect(result.tags.size).toBe(0);
      expect(result.annotation).toBe('');
      expect(result.stepCount).toBe(1);
    });

    it('should handle null metadata', () => {
      const result = MetadataProcessor.process(null, {}, t);
      
      expect(result.tags.size).toBe(0);
      expect(result.annotation).toBe('');
      expect(result.stepCount).toBe(1);
    });

    it('should filter based on settings', () => {
      const metadata = {
        checkpoint: 'models/checkpoint.safetensors',
        positive: 'beautiful',
        seed: 12345
      };
      const settings = {
        checkpoint: false,
        positive: true,
        seed: false
      };
      
      const result = MetadataProcessor.process(metadata, settings, t);
      
      expect(result.tags.has('checkpoint')).toBe(false);
      expect(result.tags.has('beautiful')).toBe(true);
      expect(result.tags.has('seed:12345')).toBe(false);
      expect(result.annotation).not.toContain('Checkpoint');
      expect(result.annotation).not.toContain('Seed');
    });

    it('should process with buffer and mimeType using MetadataService', () => {
      // Note: This test verifies the code path exists, but creating a valid PNG buffer
      // with proper CRC32 checksums is complex. The actual parsing is tested in
      // integration tests with real image files.
      
      // Create a minimal PNG buffer (just signature, will fail parsing but test the path)
      const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
      const settings = { checkpoint: true };
      
      const result = MetadataProcessor.process(null, settings, t, pngSignature, 'image/png');
      
      // Should not crash, returns empty result when parsing fails
      expect(result.tags).toBeDefined();
      expect(result.annotation).toBeDefined();
      expect(result.stepCount).toBe(1);
    });

    it('should handle MetadataService parsing errors gracefully', () => {
      // Invalid PNG buffer
      const invalidBuffer = new Uint8Array([1, 2, 3, 4]);
      const settings = { checkpoint: true };
      
      const result = MetadataProcessor.process(null, settings, t, invalidBuffer, 'image/png');
      
      // Should return empty result without crashing
      expect(result.tags.size).toBe(0);
      expect(result.annotation).toBe('');
      expect(result.stepCount).toBe(1);
    });

    it('should prioritize parsedMeta over buffer when both provided', () => {
      const metadata = {
        checkpoint: 'explicit-model.safetensors',
        positive: 'explicit prompt'
      };
      const buffer = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG signature
      const settings = { checkpoint: true, positive: true };
      
      const result = MetadataProcessor.process(metadata, settings, t, buffer, 'image/png');
      
      // Should use parsedMeta, not buffer
      expect(result.tags.has('explicit-model')).toBe(true);
      // PromptTokenizer treats "explicit prompt" as a single token (no comma separator)
      expect(result.tags.has('explicit prompt')).toBe(true);
      // Annotation uses getBaseName which removes extension
      expect(result.annotation).toContain('Checkpoint: explicit-model');
    });

    it('should handle buffer without mimeType', () => {
      const buffer = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
      const settings = { checkpoint: true };
      
      const result = MetadataProcessor.process(null, settings, t, buffer, null);
      
      // Should not attempt parsing without mimeType
      expect(result.tags.size).toBe(0);
      expect(result.stepCount).toBe(1);
    });

    it('should handle mimeType without buffer', () => {
      const settings = { checkpoint: true };
      
      const result = MetadataProcessor.process(null, settings, t, null, 'image/png');
      
      // Should not attempt parsing without buffer
      expect(result.tags.size).toBe(0);
      expect(result.stepCount).toBe(1);
    });
  });
});
