/**
 * Integration tests for dictionary-based metadata extraction
 * 
 * These tests verify that the new dictionary-based extraction logic
 * works correctly with real ComfyUI workflows.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';
import ComfyUIParser from '../../js/metadata-parser/parsers/ComfyUIParser.js';

const require = createRequire(import.meta.url);
const MetadataService = require('../../js/metadata-parser/integration/MetadataService.js');

describe('Dictionary-Based Metadata Extraction', () => {
  let metadataService;

  beforeAll(() => {
    metadataService = new MetadataService();
  });

  describe('Standard KSampler (baseline)', () => {
    it('should extract metadata from standard KSampler', () => {
      // Standard KSampler workflow (baseline test)
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 12345,
            "steps": 20,
            "cfg": 7.5,
            "sampler_name": "euler",
            "scheduler": "normal",
            "positive": ["5", 0],
            "negative": ["6", 0],
            "latent_image": ["8", 0]
          }
        },
        "5": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "a beautiful landscape"
          }
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "ugly, bad quality"
          }
        },
        "8": {
          "class_type": "EmptyLatentImage",
          "inputs": {
            "width": 512,
            "height": 512,
            "batch_size": 1
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["3", 0]
          }
        }
      };

      const parser = new ComfyUIParser();
      const result = parser.parse({ prompt: promptData });

      // Verify metadata was extracted
      expect(result.seed).toBe(12345);
      expect(result.steps).toBe(20);
      expect(result.cfg).toBe(7.5);
      expect(result.sampler).toBe('euler');
      expect(result.scheduler).toBe('normal');
      expect(result.positive).toBe('a beautiful landscape');
      expect(result.negative).toBe('ugly, bad quality');
    });

    it('should handle missing connections gracefully', () => {
      // Standard KSampler with minimal connections
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 99999,
            "steps": 10,
            "cfg": 5.0,
            "sampler_name": "euler",
            "scheduler": "simple",
            "latent_image": ["8", 0]
            // No positive/negative prompts
          }
        },
        "8": {
          "class_type": "EmptyLatentImage",
          "inputs": {
            "width": 512,
            "height": 512
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["3", 0]
          }
        }
      };

      const parser = new ComfyUIParser();
      const result = parser.parse({ prompt: promptData });

      // Should extract what's available
      expect(result.seed).toBe(99999);
      expect(result.steps).toBe(10);
      expect(result.cfg).toBe(5.0);
      expect(result.sampler).toBe('euler');
      expect(result.scheduler).toBe('simple');
      // Missing prompts - can be undefined or empty string
      expect(result.positive === undefined || result.positive === '').toBe(true);
      expect(result.negative === undefined || result.negative === '').toBe(true);
    });
  });

  describe('Dictionary-based extraction with real fixture', () => {
    it('should extract metadata from SamplerCustomAdvanced workflow', () => {
      // Use the real fixture image
      const fixturePath = join(process.cwd(), 'tests/fixtures/comfy-samplerCustomAdvanced.png');
      const buffer = readFileSync(fixturePath);
      
      // Parse using MetadataService
      const results = metadataService.extractMetadata(buffer, 'image/png');
      
      // Load expected output
      const expectedPath = join(process.cwd(), 'tests/expected/comfy-samplerCustomAdvanced.json');
      const expected = JSON.parse(readFileSync(expectedPath, 'utf-8'));
      
      // Should have exactly one result (ComfyUI format)
      expect(results).toHaveLength(1);
      const result = results[0];
      
      // Verify key fields match expected output
      expect(result.format).toBe(expected.format);
      expect(result.sampler_fallback).toBe(expected.sampler_fallback);
      expect(result.seed).toBe(expected.seed);
      expect(result.steps).toBe(expected.steps);
      expect(result.cfg).toBe(expected.cfg);
      expect(result.sampler).toBe(expected.sampler);
      expect(result.scheduler).toBe(expected.scheduler);
      expect(result.checkpoint).toBe(expected.checkpoint);
      
      // Verify generationSteps structure
      expect(result.generationSteps).toBeDefined();
      expect(result.generationSteps.length).toBe(1);
      expect(result.generationSteps[0].nodeType).toBe('SamplerCustomAdvanced');
      expect(result.generationSteps[0].isBase).toBe(true);
      
      // Verify no fallback was used (dictionary-based extraction succeeded)
      expect(result.sampler_fallback).toBe(false);
    });
  });

  describe('Silent_Drop exclusion', () => {
    it('should exclude samplers without latent_image connection', () => {
      const promptData = {
        "5": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 12345,
            "steps": 20,
            "cfg": 7.0,
            "sampler_name": "euler",
            "scheduler": "normal"
            // No latent_image connection!
          }
        },
        "7": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 99999,
            "steps": 30,
            "cfg": 8.0,
            "sampler_name": "dpmpp_2m",
            "scheduler": "karras",
            "latent_image": ["8", 0]
          }
        },
        "8": {
          "class_type": "EmptyLatentImage",
          "inputs": {
            "width": 512,
            "height": 512
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["7", 0]
          }
        }
      };

      const parser = new ComfyUIParser();
      const result = parser.parse({ prompt: promptData });

      // Should use the valid sampler (node 7), not the invalid one (node 5)
      expect(result.seed).toBe(99999);
      expect(result.steps).toBe(30);
      expect(result.sampler).toBe('dpmpp_2m');
    });

    it('should exclude muted samplers', () => {
      const promptData = {
        "5": {
          "class_type": "KSampler",
          "mode": 2, // Muted
          "inputs": {
            "seed": 12345,
            "steps": 20,
            "cfg": 7.0,
            "sampler_name": "euler",
            "scheduler": "normal",
            "latent_image": ["8", 0]
          }
        },
        "7": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 99999,
            "steps": 30,
            "cfg": 8.0,
            "sampler_name": "dpmpp_2m",
            "scheduler": "karras",
            "latent_image": ["8", 0]
          }
        },
        "8": {
          "class_type": "EmptyLatentImage",
          "inputs": {
            "width": 512,
            "height": 512
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["7", 0]
          }
        }
      };

      const parser = new ComfyUIParser();
      const result = parser.parse({ prompt: promptData });

      // Should use the active sampler (node 7), not the muted one (node 5)
      expect(result.seed).toBe(99999);
      expect(result.steps).toBe(30);
    });

    it('should exclude bypassed samplers', () => {
      const promptData = {
        "5": {
          "class_type": "KSampler",
          "mode": 4, // Bypassed
          "inputs": {
            "seed": 12345,
            "steps": 20,
            "cfg": 7.0,
            "sampler_name": "euler",
            "scheduler": "normal",
            "latent_image": ["8", 0]
          }
        },
        "7": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 99999,
            "steps": 30,
            "cfg": 8.0,
            "sampler_name": "dpmpp_2m",
            "scheduler": "karras",
            "latent_image": ["8", 0]
          }
        },
        "8": {
          "class_type": "EmptyLatentImage",
          "inputs": {
            "width": 512,
            "height": 512
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["7", 0]
          }
        }
      };

      const parser = new ComfyUIParser();
      const result = parser.parse({ prompt: promptData });

      // Should use the active sampler (node 7), not the bypassed one (node 5)
      expect(result.seed).toBe(99999);
      expect(result.steps).toBe(30);
    });
  });

  describe('Reporter integration', () => {
    it('should not throw errors when reporter logs events', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 12345,
            "steps": 20,
            "cfg": 7.5,
            "sampler_name": "euler",
            "scheduler": "normal",
            "latent_image": ["8", 0]
          }
        },
        "8": {
          "class_type": "EmptyLatentImage",
          "inputs": {
            "width": 512,
            "height": 512
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["3", 0]
          }
        }
      };

      const parser = new ComfyUIParser();
      
      // Should not throw
      expect(() => {
        parser.parse({ prompt: promptData });
      }).not.toThrow();
    });

    it('should initialize dictionary and reporter correctly', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 12345,
            "steps": 20,
            "cfg": 7.5,
            "sampler_name": "euler",
            "scheduler": "normal",
            "positive": ["5", 0],
            "negative": ["6", 0],
            "latent_image": ["8", 0]
          }
        },
        "5": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test prompt"
          }
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "negative prompt"
          }
        },
        "8": {
          "class_type": "EmptyLatentImage",
          "inputs": {
            "width": 512,
            "height": 512
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["3", 0]
          }
        }
      };

      const parser = new ComfyUIParser();
      const result = parser.parse({ prompt: promptData });
      
      // Should successfully extract metadata
      expect(result.seed).toBe(12345);
      expect(result.format).toBe('comfyui');
      expect(result.positive).toBe('test prompt');
      expect(result.negative).toBe('negative prompt');
    });
  });
});
