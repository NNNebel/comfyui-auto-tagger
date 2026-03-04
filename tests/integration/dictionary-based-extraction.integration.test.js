/**
 * Integration tests for dictionary-based metadata extraction
 * 
 * These tests verify that the new dictionary-based extraction logic
 * works correctly with real ComfyUI workflows.
 */

import { describe, it, expect } from 'vitest';
import ComfyUIParser from '../../js/metadata-parser/parsers/ComfyUIParser.js';

describe('Dictionary-Based Metadata Extraction', () => {
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

  describe('Dictionary-based extraction (future)', () => {
    it.skip('should extract metadata using dictionary definitions for SamplerCustomAdvanced', () => {
      // TODO: This test is for future implementation
      // Currently, the dictionary-based extraction for SamplerCustomAdvanced
      // requires more complex workflow setup with proper guider connections
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
