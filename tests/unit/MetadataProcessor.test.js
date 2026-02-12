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
  });
});
