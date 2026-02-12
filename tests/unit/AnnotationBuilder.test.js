import { describe, it, expect } from 'vitest';
import AnnotationBuilder from '../../js/metadata-processor/AnnotationBuilder.js';

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

describe('AnnotationBuilder', () => {
  describe('getBaseName', () => {
    it('should extract base name from path', () => {
      expect(AnnotationBuilder.getBaseName('path/to/file.txt')).toBe('file');
    });

    it('should handle Windows paths', () => {
      expect(AnnotationBuilder.getBaseName('path\\to\\file.txt')).toBe('file');
    });

    it('should handle empty string', () => {
      expect(AnnotationBuilder.getBaseName('')).toBe('');
    });
  });

  describe('build', () => {
    it('should return empty string for empty metadata', () => {
      const metadata = {};
      const settings = { checkpoint: true };
      const result = AnnotationBuilder.build(metadata, settings, t);
      
      expect(result).toBe('');
    });

    it('should include header and checkpoint', () => {
      const metadata = {
        checkpoint: 'models/checkpoint.safetensors'
      };
      const settings = { checkpoint: true };
      const result = AnnotationBuilder.build(metadata, settings, t);
      
      expect(result).toContain('[Generation Info]');
      expect(result).toContain('Checkpoint: checkpoint');
    });

    it('should include LoRAs', () => {
      const metadata = {
        loras: ['loras/lora1.safetensors', 'loras/lora2.safetensors']
      };
      const settings = { lora: true };
      const result = AnnotationBuilder.build(metadata, settings, t);
      
      expect(result).toContain('LoRA: lora1, lora2');
    });

    it('should include sampler fallback warning', () => {
      const metadata = {
        sampler_fallback: true,
        checkpoint: 'models/checkpoint.safetensors'
      };
      const settings = { checkpoint: true };
      const result = AnnotationBuilder.build(metadata, settings, t);
      
      expect(result).toContain('[Warning]');
      expect(result).toContain('Base sampler detection may be unreliable');
    });

    it('should handle generationSteps format', () => {
      const metadata = {
        generationSteps: [
          {
            nodeId: '1',
            nodeType: 'KSampler',
            seed: 12345,
            steps: 20,
            cfg: 7.5,
            sampler: 'euler',
            positive: 'beautiful landscape',
            negative: 'bad quality',
            isBase: true
          }
        ]
      };
      const settings = {
        seed: true,
        steps: true,
        cfg: true,
        sampler: true,
        positive: true,
        negative: true
      };
      const result = AnnotationBuilder.build(metadata, settings, t);
      
      expect(result).toContain('[Base Sampler - KSampler (ID: 1)]');
      expect(result).toContain('Seed: 12345');
      expect(result).toContain('Steps: 20');
      expect(result).toContain('CFG: 7.5');
      expect(result).toContain('Sampler: euler');
      expect(result).toContain('Positive: beautiful landscape');
      expect(result).toContain('Negative: bad quality');
    });

    it('should handle multiple generation steps', () => {
      const metadata = {
        generationSteps: [
          {
            nodeId: '1',
            nodeType: 'KSampler',
            seed: 12345,
            isBase: true
          },
          {
            nodeId: '2',
            nodeType: 'KSampler',
            seed: 67890,
            isBase: false
          }
        ]
      };
      const settings = { seed: true };
      const result = AnnotationBuilder.build(metadata, settings, t);
      
      expect(result).toContain('[Base Sampler - KSampler (ID: 1)]');
      expect(result).toContain('[Step 2 - KSampler (ID: 2)]');
    });

    it('should filter content based on settings', () => {
      const metadata = {
        generationSteps: [
          {
            nodeId: '1',
            seed: 12345,
            steps: 20,
            positive: 'test',
            isBase: true
          }
        ]
      };
      const settings = { seed: true, steps: false, positive: false };
      const result = AnnotationBuilder.build(metadata, settings, t);
      
      expect(result).toContain('Seed: 12345');
      expect(result).not.toContain('Steps: 20');
      expect(result).not.toContain('Positive: test');
    });

    it('should handle fallback format with extra_samplers', () => {
      const metadata = {
        seed: 12345,
        steps: 20,
        sampler: 'euler',
        positive: 'test prompt',
        extra_samplers: [
          { seed: 12345, steps: 20 },
          { seed: 67890, steps: 30 }
        ]
      };
      const settings = {
        seed: true,
        steps: true,
        sampler: true,
        positive: true
      };
      const result = AnnotationBuilder.build(metadata, settings, t);
      
      expect(result).toContain('Seed: 12345');
      expect(result).toContain('Steps: 20');
      expect(result).toContain('Sampler: euler');
      expect(result).toContain('[All Samplers]');
      expect(result).toContain('Seed: 12345, 67890');
      expect(result).toContain('Steps: 20, 30');
      expect(result).toContain('[Positive Prompt]');
      expect(result).toContain('test prompt');
    });

    it('should handle node title in step label', () => {
      const metadata = {
        generationSteps: [
          {
            nodeId: '1',
            nodeTitle: 'My Custom Sampler',
            seed: 12345,
            isBase: true
          }
        ]
      };
      const settings = { seed: true };
      const result = AnnotationBuilder.build(metadata, settings, t);
      
      expect(result).toContain('[Base Sampler - My Custom Sampler]');
    });

    it('should handle node group in step label', () => {
      const metadata = {
        generationSteps: [
          {
            nodeId: '1',
            nodeGroup: 'Group A',
            seed: 12345,
            isBase: true
          }
        ]
      };
      const settings = { seed: true };
      const result = AnnotationBuilder.build(metadata, settings, t);
      
      expect(result).toContain('[Base Sampler - Group A (ID: 1)]');
    });
  });
});
