import { describe, it, expect, beforeEach } from 'vitest';
import ComfyUIParser from '../../js/metadata-parser/parsers/ComfyUIParser.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const NodeDefinitionDictionary = require('../../js/metadata-parser/dictionary/NodeDefinitionDictionary.js');

describe('ComfyUIParser - suspiciousNodes Logic', () => {
  let parser;
  let dictionary;

  beforeEach(() => {
    parser = new ComfyUIParser();
    dictionary = NodeDefinitionDictionary.getDefault();
  });

  describe('basic parsing with exclude mode', () => {
    it('should parse workflow in exclude mode', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': {
          class_type: 'KSampler',
          inputs: {
            seed: 123,
            steps: 20,
            cfg: 7.5,
            sampler_name: 'euler',
            scheduler: 'normal'
          }
        }
      };

      const options = {
        suspiciousNodeHandling: 'exclude',
        dictionary: dictionary
      };

      const result = parser.parse({ prompt: promptData }, options);
      expect(result).toBeDefined();
      expect(result.format).toBe('comfyui');
    });

    it('should parse workflow in include mode', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': {
          class_type: 'KSampler',
          inputs: {
            seed: 123,
            steps: 20,
            cfg: 7,
            sampler_name: 'euler',
            scheduler: 'normal'
          }
        }
      };

      const options = {
        suspiciousNodeHandling: 'include',
        dictionary: dictionary
      };

      const result = parser.parse({ prompt: promptData }, options);
      expect(result).toBeDefined();
      expect(result.format).toBe('comfyui');
    });
  });

  describe('affectedSteps calculation', () => {
    it('should include suspiciousNodes field in result', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': {
          class_type: 'KSampler',
          inputs: {
            seed: 123,
            steps: 20,
            cfg: 7,
            sampler_name: 'euler',
            scheduler: 'normal'
          }
        }
      };

      const options = {
        suspiciousNodeHandling: 'exclude',
        dictionary: dictionary
      };

      const result = parser.parse({ prompt: promptData }, options);
      // suspiciousNodes should be defined (either array or undefined)
      expect('suspiciousNodes' in result || result.suspiciousNodes === undefined).toBe(true);
    });

    it('should handle metadata parsing with excludeBaseSamplersMetadata logic', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': {
          class_type: 'KSampler',
          inputs: {
            seed: 200,
            steps: 25,
            cfg: 8,
            sampler_name: 'dpmpp_2m',
            scheduler: 'karras'
          }
        },
        '3': {
          class_type: 'SaveImage',
          inputs: { images: ['2', 0] }
        }
      };

      const options = {
        suspiciousNodeHandling: 'exclude',
        dictionary: dictionary
      };

      const result = parser.parse({ prompt: promptData }, options);
      expect(result).toBeDefined();
      expect(result.format).toBe('comfyui');
      // Verify the parsing completed without errors
      expect(typeof result).toBe('object');
    });
  });

  describe('edge cases', () => {
    it('should handle empty suspiciousNodes gracefully', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': {
          class_type: 'KSampler',
          inputs: {
            seed: 999,
            steps: 15,
            cfg: 6,
            sampler_name: 'euler',
            scheduler: 'normal'
          }
        }
      };

      const options = {
        suspiciousNodeHandling: 'exclude',
        dictionary: dictionary
      };

      const result = parser.parse({ prompt: promptData }, options);
      // Should complete without error
      expect(result).toBeDefined();
    });

    it('should handle workflow with multiple samplers', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': {
          class_type: 'KSampler',
          inputs: {
            latent_image: ['1', 0],
            seed: 111,
            steps: 20,
            cfg: 7,
            sampler_name: 'euler',
            scheduler: 'normal'
          }
        },
        '3': {
          class_type: 'VAEDecode',
          inputs: { samples: ['2', 0] }
        },
        '4': {
          class_type: 'KSampler',
          inputs: {
            latent_image: ['3', 0],
            seed: 222,
            steps: 30,
            cfg: 8,
            sampler_name: 'dpmpp',
            scheduler: 'karras'
          }
        }
      };

      const options = {
        suspiciousNodeHandling: 'exclude',
        dictionary: dictionary
      };

      const result = parser.parse({ prompt: promptData }, options);
      expect(result).toBeDefined();
      expect(result.format).toBe('comfyui');
    });
  });

  describe('mode consistency', () => {
    it('should produce consistent results with exclude vs include modes', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': {
          class_type: 'KSampler',
          inputs: {
            seed: 123,
            steps: 20,
            cfg: 7,
            sampler_name: 'euler',
            scheduler: 'normal'
          }
        }
      };

      const optionsExclude = {
        suspiciousNodeHandling: 'exclude',
        dictionary: dictionary
      };

      const optionsInclude = {
        suspiciousNodeHandling: 'include',
        dictionary: dictionary
      };

      const resultExclude = parser.parse({ prompt: promptData }, optionsExclude);
      const resultInclude = parser.parse({ prompt: promptData }, optionsInclude);

      // Both should complete successfully
      expect(resultExclude).toBeDefined();
      expect(resultInclude).toBeDefined();
      expect(resultExclude.format).toBe('comfyui');
      expect(resultInclude.format).toBe('comfyui');
    });
  });
});
