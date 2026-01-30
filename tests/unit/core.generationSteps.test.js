// tests/unit/core.generationSteps.test.js
/**
 * Tests for Generation Steps annotation format
 * 
 * This test suite validates the new annotation structure that groups
 * metadata by generation steps (samplers) instead of by parameter type.
 */

import { describe, it, expect } from 'vitest';
import { processMetadata } from '../../js/core.js';

// Mock translation function
const t = (key, replacements = {}) => {
  const translations = {
    'ui.option.checkpoint': 'Checkpoint',
    'ui.option.lora': 'LoRA',
    'ui.option.seed': 'Seed',
    'ui.option.steps': 'Steps',
    'ui.option.cfg': 'CFG',
    'ui.option.sampler': 'Sampler',
    'log.caution.sampler_fallback': 'Base sampler detection may be unreliable'
  };
  let result = translations[key] || key;
  for (const [k, v] of Object.entries(replacements)) {
    result = result.replace(`{${k}}`, v);
  }
  return result;
};

const allSettingsOn = {
  checkpoint: true,
  lora: true,
  positive: true,
  negative: true,
  seed: true,
  sampler: true,
  scheduler: true,
  steps: true,
  cfg: true
};

describe('Generation Steps Annotation Format', () => {
  describe('Single Step (Base Sampler Only)', () => {
    it('should format annotation with single generation step', () => {
      const metadata = {
        format: 'comfyui',
        checkpoint: 'model.safetensors',
        seed: 12345,
        steps: 20,
        cfg: 7.0,
        sampler: 'euler',
        scheduler: 'normal',
        generationSteps: [
          {
            nodeId: '3',
            nodeName: 'KSampler',
            nodeType: 'KSampler',
            seed: 12345,
            steps: 20,
            cfg: 7.0,
            sampler: 'euler',
            scheduler: 'normal',
            positive: 'masterpiece, best quality',
            negative: 'worst quality',
            isBase: true,
            stepIndex: 1,
            distance: 1
          }
        ]
      };

      const result = processMetadata(metadata, allSettingsOn, t);

      expect(result.annotation).toContain('[Base Sampler - KSampler (ID: 3)]');
      expect(result.annotation).toContain('Seed: 12345');
      expect(result.annotation).toContain('Steps: 20');
      expect(result.annotation).toContain('CFG: 7.0');
      expect(result.annotation).toContain('Sampler: euler');
      expect(result.annotation).toContain('Scheduler: normal');
      expect(result.annotation).toContain('Positive: masterpiece, best quality');
      expect(result.annotation).toContain('Negative: worst quality');
      expect(result.stepCount).toBe(1);
    });

    it('should use node title if available', () => {
      const metadata = {
        format: 'comfyui',
        generationSteps: [
          {
            nodeId: '3',
            nodeName: 'KSampler',
            nodeType: 'KSampler',
            nodeTitle: 'My Custom Sampler',
            seed: 12345,
            steps: 20,
            cfg: 7.0,
            sampler: 'euler',
            positive: 'test prompt',
            negative: '',
            isBase: true,
            stepIndex: 1
          }
        ]
      };

      const result = processMetadata(metadata, allSettingsOn, t);

      expect(result.annotation).toContain('[Base Sampler - My Custom Sampler]');
      expect(result.annotation).not.toContain('(ID: 3)');
    });

    it('should use group name if available but no title', () => {
      const metadata = {
        format: 'comfyui',
        generationSteps: [
          {
            nodeId: '3',
            nodeName: 'KSampler',
            nodeType: 'KSampler',
            nodeGroup: 'Base Generation',
            seed: 12345,
            steps: 20,
            cfg: 7.0,
            sampler: 'euler',
            positive: 'test prompt',
            negative: '',
            isBase: true,
            stepIndex: 1
          }
        ]
      };

      const result = processMetadata(metadata, allSettingsOn, t);

      expect(result.annotation).toContain('[Base Sampler - Base Generation (ID: 3)]');
    });
  });

  describe('Multiple Steps', () => {
    it('should format annotation with multiple generation steps', () => {
      const metadata = {
        format: 'comfyui',
        checkpoint: 'model.safetensors',
        generationSteps: [
          {
            nodeId: '3',
            nodeName: 'KSampler',
            nodeType: 'KSampler',
            seed: 111111,
            steps: 30,
            cfg: 6.0,
            sampler: 'dpmpp_2m',
            scheduler: 'normal',
            positive: 'masterpiece, best quality, 1girl',
            negative: 'worst quality',
            isBase: true,
            stepIndex: 1,
            distance: 1
          },
          {
            nodeId: '32',
            nodeName: 'KSampler',
            nodeType: 'KSampler',
            seed: 222222,
            steps: 20,
            cfg: 6.0,
            sampler: 'dpmpp_2m',
            scheduler: 'normal',
            positive: 'masterpiece, best quality, 1girl, super resolution',
            negative: 'character sheet, worst quality',
            isBase: false,
            stepIndex: 2,
            distance: 2
          },
          {
            nodeId: '325',
            nodeName: 'DetailerForEachDebug',
            nodeType: 'DetailerForEachDebug',
            seed: 333333,
            steps: 30,
            cfg: 7.0,
            sampler: 'dpmpp_2m',
            scheduler: 'normal',
            positive: 'masterpiece, amazing quality, beautiful face',
            negative: 'curvy, worst quality',
            isBase: false,
            stepIndex: 3,
            distance: null
          }
        ]
      };

      const result = processMetadata(metadata, allSettingsOn, t);

      // Check that all steps are present
      expect(result.annotation).toContain('[Base Sampler - KSampler (ID: 3)]');
      expect(result.annotation).toContain('[Step 2 - KSampler (ID: 32)]');
      expect(result.annotation).toContain('[Step 3 - DetailerForEachDebug (ID: 325)]');

      // Check step 1 content
      expect(result.annotation).toContain('Seed: 111111');
      expect(result.annotation).toContain('Positive: masterpiece, best quality, 1girl');

      // Check step 2 content
      expect(result.annotation).toContain('Seed: 222222');
      expect(result.annotation).toContain('Positive: masterpiece, best quality, 1girl, super resolution');

      // Check step 3 content
      expect(result.annotation).toContain('Seed: 333333');
      expect(result.annotation).toContain('Positive: masterpiece, amazing quality, beautiful face');

      expect(result.stepCount).toBe(3);
    });

    it('should show prompts without deduplication in annotation', () => {
      const metadata = {
        format: 'comfyui',
        generationSteps: [
          {
            nodeId: '3',
            nodeName: 'KSampler',
            nodeType: 'KSampler',
            seed: 111111,
            steps: 30,
            cfg: 6.0,
            sampler: 'euler',
            positive: 'masterpiece, best quality, 1girl',
            negative: 'worst quality',
            isBase: true,
            stepIndex: 1
          },
          {
            nodeId: '32',
            nodeName: 'KSampler',
            nodeType: 'KSampler',
            seed: 222222,
            steps: 20,
            cfg: 6.0,
            sampler: 'euler',
            positive: 'masterpiece, best quality, 1girl, detailed face',
            negative: 'worst quality, blurry',
            isBase: false,
            stepIndex: 2
          }
        ]
      };

      const result = processMetadata(metadata, allSettingsOn, t);

      // Annotation should show full prompts for each step (no deduplication)
      expect(result.annotation).toContain('Positive: masterpiece, best quality, 1girl');
      expect(result.annotation).toContain('Positive: masterpiece, best quality, 1girl, detailed face');
      expect(result.annotation).toContain('Negative: worst quality');
      expect(result.annotation).toContain('Negative: worst quality, blurry');
    });

    it('should separate steps with empty lines', () => {
      const metadata = {
        format: 'comfyui',
        generationSteps: [
          {
            nodeId: '3',
            nodeName: 'KSampler',
            nodeType: 'KSampler',
            seed: 111111,
            steps: 30,
            cfg: 6.0,
            sampler: 'euler',
            positive: 'prompt1',
            negative: '',
            isBase: true,
            stepIndex: 1
          },
          {
            nodeId: '32',
            nodeName: 'KSampler',
            nodeType: 'KSampler',
            seed: 222222,
            steps: 20,
            cfg: 6.0,
            sampler: 'euler',
            positive: 'prompt2',
            negative: '',
            isBase: false,
            stepIndex: 2
          }
        ]
      };

      const result = processMetadata(metadata, allSettingsOn, t);

      const lines = result.annotation.split('\n');
      
      // Find the index of the first step header
      const step1Index = lines.findIndex(line => line.includes('[Base Sampler'));
      const step2Index = lines.findIndex(line => line.includes('[Step 2'));
      
      // There should be an empty line between steps
      expect(step2Index).toBeGreaterThan(step1Index);
      const linesBetween = lines.slice(step1Index, step2Index);
      expect(linesBetween.some(line => line.trim() === '')).toBe(true);
    });
  });

  describe('Tag Generation with Deduplication', () => {
    it('should deduplicate prompts across all steps for tags', () => {
      const metadata = {
        format: 'comfyui',
        generationSteps: [
          {
            nodeId: '3',
            nodeName: 'KSampler',
            nodeType: 'KSampler',
            seed: 111111,
            steps: 30,
            cfg: 6.0,
            sampler: 'euler',
            positive: 'masterpiece, best quality, 1girl',
            negative: 'worst quality',
            isBase: true,
            stepIndex: 1
          },
          {
            nodeId: '32',
            nodeName: 'KSampler',
            nodeType: 'KSampler',
            seed: 222222,
            steps: 20,
            cfg: 6.0,
            sampler: 'euler',
            positive: 'masterpiece, best quality, 1girl, detailed face',
            negative: 'worst quality, blurry',
            isBase: false,
            stepIndex: 2
          }
        ]
      };

      const result = processMetadata(metadata, allSettingsOn, t);

      // Tags should be deduplicated
      const tags = Array.from(result.tags);
      const masterpieceCount = tags.filter(t => t === 'masterpiece').length;
      const bestQualityCount = tags.filter(t => t === 'best quality').length;
      const girlCount = tags.filter(t => t === '1girl').length;
      const worstQualityCount = tags.filter(t => t === 'neg:worst quality').length;

      expect(masterpieceCount).toBe(1);
      expect(bestQualityCount).toBe(1);
      expect(girlCount).toBe(1);
      expect(worstQualityCount).toBe(1);

      // But should include unique tags from all steps
      expect(tags).toContain('detailed face');
      expect(tags).toContain('neg:blurry');
    });
  });

  describe('Settings Filtering', () => {
    it('should respect settings for which parameters to show', () => {
      const metadata = {
        format: 'comfyui',
        generationSteps: [
          {
            nodeId: '3',
            nodeName: 'KSampler',
            nodeType: 'KSampler',
            seed: 12345,
            steps: 20,
            cfg: 7.0,
            sampler: 'euler',
            scheduler: 'normal',
            positive: 'test prompt',
            negative: 'test negative',
            isBase: true,
            stepIndex: 1
          }
        ]
      };

      const minimalSettings = {
        checkpoint: false,
        lora: false,
        positive: true,
        negative: false,
        seed: false,
        sampler: false,
        scheduler: false,
        steps: false,
        cfg: false
      };

      const result = processMetadata(metadata, minimalSettings, t);

      // Should show positive prompt
      expect(result.annotation).toContain('Positive: test prompt');

      // Should NOT show these
      expect(result.annotation).not.toContain('Seed:');
      expect(result.annotation).not.toContain('Steps:');
      expect(result.annotation).not.toContain('CFG:');
      expect(result.annotation).not.toContain('Sampler:');
      expect(result.annotation).not.toContain('Scheduler:');
      expect(result.annotation).not.toContain('Negative:');
    });

    it('should not show empty prompts when settings are off', () => {
      const metadata = {
        format: 'comfyui',
        generationSteps: [
          {
            nodeId: '3',
            nodeName: 'KSampler',
            nodeType: 'KSampler',
            seed: 12345,
            steps: 20,
            cfg: 7.0,
            sampler: 'euler',
            positive: '',
            negative: '',
            isBase: true,
            stepIndex: 1
          }
        ]
      };

      const settings = {
        positive: true,
        negative: true,
        seed: true,
        steps: true,
        cfg: true,
        sampler: true
      };

      const result = processMetadata(metadata, settings, t);

      // Should not show "Positive:" or "Negative:" lines if prompts are empty
      const lines = result.annotation.split('\n');
      const hasEmptyPositive = lines.some(line => line.trim() === 'Positive:');
      const hasEmptyNegative = lines.some(line => line.trim() === 'Negative:');

      expect(hasEmptyPositive).toBe(false);
      expect(hasEmptyNegative).toBe(false);
    });
  });

  describe('Backward Compatibility', () => {
    it('should fall back to old format when generationSteps is not available', () => {
      const metadata = {
        format: 'comfyui',
        checkpoint: 'model.safetensors',
        seed: 12345,
        steps: 20,
        cfg: 7.0,
        sampler: 'euler',
        scheduler: 'normal',
        positive: 'masterpiece, best quality',
        negative: 'worst quality',
        extra_samplers: [
          {
            id: '3',
            seed: 12345,
            steps: 20,
            cfg: 7.0,
            sampler: 'euler',
            scheduler: 'normal',
            is_base: true
          },
          {
            id: '32',
            seed: 22222,
            steps: 15,
            cfg: 6.0,
            sampler: 'dpmpp_2m',
            scheduler: 'karras',
            is_base: false
          }
        ]
      };

      const result = processMetadata(metadata, allSettingsOn, t);

      // Should use old format with [All Samplers] section
      expect(result.annotation).toContain('[All Samplers]');
      expect(result.annotation).toContain('Seed: 12345, 22222');
      expect(result.annotation).toContain('[Positive Prompt]');
      expect(result.annotation).toContain('masterpiece, best quality');
    });

    it('should handle metadata without generationSteps or extra_samplers', () => {
      const metadata = {
        format: 'comfyui',
        checkpoint: 'model.safetensors',
        seed: 12345,
        steps: 20,
        cfg: 7.0,
        sampler: 'euler',
        positive: 'test prompt',
        negative: 'test negative'
      };

      const result = processMetadata(metadata, allSettingsOn, t);

      expect(result.annotation).toContain('Checkpoint: model');
      expect(result.annotation).toContain('Seed: 12345');
      expect(result.annotation).toContain('[Positive Prompt]');
      expect(result.annotation).toContain('test prompt');
      expect(result.stepCount).toBe(1);
    });
  });

  describe('Step Count', () => {
    it('should return correct step count for single step', () => {
      const metadata = {
        format: 'comfyui',
        generationSteps: [
          {
            nodeId: '3',
            nodeName: 'KSampler',
            nodeType: 'KSampler',
            seed: 12345,
            steps: 20,
            cfg: 7.0,
            sampler: 'euler',
            positive: 'test',
            negative: '',
            isBase: true,
            stepIndex: 1
          }
        ]
      };

      const result = processMetadata(metadata, allSettingsOn, t);
      expect(result.stepCount).toBe(1);
    });

    it('should return correct step count for multiple steps', () => {
      const metadata = {
        format: 'comfyui',
        generationSteps: [
          { nodeId: '3', nodeName: 'KSampler', nodeType: 'KSampler', seed: 1, steps: 20, cfg: 7, sampler: 'euler', positive: 'a', negative: '', isBase: true, stepIndex: 1 },
          { nodeId: '32', nodeName: 'KSampler', nodeType: 'KSampler', seed: 2, steps: 20, cfg: 7, sampler: 'euler', positive: 'b', negative: '', isBase: false, stepIndex: 2 },
          { nodeId: '325', nodeName: 'KSampler', nodeType: 'KSampler', seed: 3, steps: 20, cfg: 7, sampler: 'euler', positive: 'c', negative: '', isBase: false, stepIndex: 3 },
          { nodeId: '430', nodeName: 'KSampler', nodeType: 'KSampler', seed: 4, steps: 20, cfg: 7, sampler: 'euler', positive: 'd', negative: '', isBase: false, stepIndex: 4 }
        ]
      };

      const result = processMetadata(metadata, allSettingsOn, t);
      expect(result.stepCount).toBe(4);
    });

    it('should return step count from extra_samplers when generationSteps not available', () => {
      const metadata = {
        format: 'comfyui',
        seed: 12345,
        steps: 20,
        cfg: 7.0,
        sampler: 'euler',
        extra_samplers: [
          { id: '3', seed: 12345, steps: 20, cfg: 7, sampler: 'euler', is_base: true },
          { id: '32', seed: 22222, steps: 15, cfg: 6, sampler: 'dpmpp_2m', is_base: false }
        ]
      };

      const result = processMetadata(metadata, allSettingsOn, t);
      expect(result.stepCount).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty generationSteps array', () => {
      const metadata = {
        format: 'comfyui',
        checkpoint: 'model.safetensors',
        generationSteps: []
      };

      const result = processMetadata(metadata, allSettingsOn, t);

      expect(result.annotation).toContain('[Generation Info]');
      expect(result.annotation).toContain('Checkpoint: model');
      expect(result.stepCount).toBe(1);
    });

    it('should handle missing optional fields in generation steps', () => {
      const metadata = {
        format: 'comfyui',
        generationSteps: [
          {
            nodeId: '3',
            nodeName: 'KSampler',
            nodeType: 'KSampler',
            seed: 12345,
            // Missing: steps, cfg, sampler, scheduler
            positive: 'test prompt',
            negative: '',
            isBase: true,
            stepIndex: 1
          }
        ]
      };

      const result = processMetadata(metadata, allSettingsOn, t);

      expect(result.annotation).toContain('[Base Sampler - KSampler (ID: 3)]');
      expect(result.annotation).toContain('Seed: 12345');
      expect(result.annotation).toContain('Positive: test prompt');
      // Should not crash or show undefined values
      expect(result.annotation).not.toContain('undefined');
    });

    it('should handle very long prompts', () => {
      const longPrompt = 'masterpiece, '.repeat(100) + 'best quality';
      
      const metadata = {
        format: 'comfyui',
        generationSteps: [
          {
            nodeId: '3',
            nodeName: 'KSampler',
            nodeType: 'KSampler',
            seed: 12345,
            steps: 20,
            cfg: 7.0,
            sampler: 'euler',
            positive: longPrompt,
            negative: '',
            isBase: true,
            stepIndex: 1
          }
        ]
      };

      const result = processMetadata(metadata, allSettingsOn, t);

      expect(result.annotation).toContain('Positive: ' + longPrompt);
      expect(result.annotation.length).toBeGreaterThan(1000);
    });
  });
});
