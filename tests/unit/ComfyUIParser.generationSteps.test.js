// tests/unit/ComfyUIParser.generationSteps.test.js
/**
 * Tests for ComfyUIParser generationSteps extraction
 * 
 * This test suite validates that the parser correctly extracts
 * generation steps with individual prompts for each sampler.
 */

import { describe, it, expect, beforeEach } from 'vitest';
const ComfyUIParser = require('../../js/metadata-parser/parsers/ComfyUIParser');

describe('ComfyUIParser - Generation Steps Extraction', () => {
  let parser;

  beforeEach(() => {
    parser = new ComfyUIParser();
  });

  describe('generationSteps Array Structure', () => {
    it('should create generationSteps array with correct structure', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "scheduler": "normal",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0]
          }
        },
        "4": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["3", 0]
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {
            "width": 512,
            "height": 512
          }
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "masterpiece, best quality"
          }
        },
        "7": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "worst quality"
          }
        },
        "8": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["4", 0]
          }
        }
      };

      const rawChunks = {
        prompt: promptData
      };

      const result = parser.parse(rawChunks);

      expect(result.generationSteps).toBeDefined();
      expect(Array.isArray(result.generationSteps)).toBe(true);
      expect(result.generationSteps.length).toBe(1);

      const step = result.generationSteps[0];
      expect(step).toHaveProperty('nodeId');
      expect(step).toHaveProperty('nodeName');
      expect(step).toHaveProperty('nodeType');
      expect(step).toHaveProperty('seed');
      expect(step).toHaveProperty('steps');
      expect(step).toHaveProperty('cfg');
      expect(step).toHaveProperty('sampler');
      expect(step).toHaveProperty('scheduler');
      expect(step).toHaveProperty('positive');
      expect(step).toHaveProperty('negative');
      expect(step).toHaveProperty('isBase');
      expect(step).toHaveProperty('stepIndex');
      expect(step).toHaveProperty('distance');
    });

    it('should extract individual prompts for each sampler', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0]
          }
        },
        "32": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 222222,
            "steps": 20,
            "cfg": 7.0,
            "sampler_name": "dpmpp_2m",
            "positive": ["33", 0],
            "negative": ["34", 0],
            "latent_image": ["3", 0]
          }
        },
        "4": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["32", 0]
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {}
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "masterpiece, 1girl"
          }
        },
        "7": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "worst quality"
          }
        },
        "33": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "masterpiece, 1girl, detailed face"
          }
        },
        "34": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "worst quality, blurry"
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["4", 0]
          }
        }
      };

      const rawChunks = {
        prompt: promptData
      };

      const result = parser.parse(rawChunks);

      expect(result.generationSteps.length).toBe(2);

      // First sampler
      const step1 = result.generationSteps.find(s => s.nodeId === '3');
      expect(step1.positive).toBe('masterpiece, 1girl');
      expect(step1.negative).toBe('worst quality');
      expect(step1.isBase).toBe(true);

      // Second sampler
      const step2 = result.generationSteps.find(s => s.nodeId === '32');
      expect(step2.positive).toBe('masterpiece, 1girl, detailed face');
      expect(step2.negative).toBe('worst quality, blurry');
      expect(step2.isBase).toBe(false);
    });

    it('should maintain backward compatibility with extra_samplers', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0]
          }
        },
        "4": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["3", 0]
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {}
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test prompt"
          }
        },
        "7": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test negative"
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["4", 0]
          }
        }
      };

      const rawChunks = {
        prompt: promptData
      };

      const result = parser.parse(rawChunks);

      // Should have both generationSteps and extra_samplers
      expect(result.generationSteps).toBeDefined();
      expect(result.extra_samplers).toBeDefined();

      // extra_samplers should have same length as generationSteps
      expect(result.extra_samplers.length).toBe(result.generationSteps.length);

      // extra_samplers should have correct structure
      const extraSampler = result.extra_samplers[0];
      expect(extraSampler).toHaveProperty('id');
      expect(extraSampler).toHaveProperty('seed');
      expect(extraSampler).toHaveProperty('steps');
      expect(extraSampler).toHaveProperty('cfg');
      expect(extraSampler).toHaveProperty('sampler');
      expect(extraSampler).toHaveProperty('is_base');
    });
  });

  describe('Node Title and Group Extraction', () => {
    it('should extract node title from workflow', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0]
          }
        },
        "4": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["3", 0]
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {}
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "7": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["4", 0]
          }
        }
      };

      const workflowData = {
        "nodes": [
          {
            "id": 3,
            "type": "KSampler",
            "title": "My Custom Sampler"
          },
          {
            "id": 5,
            "type": "EmptyLatentImage"
          }
        ]
      };

      const rawChunks = {
        prompt: promptData,
        workflow: workflowData
      };

      const result = parser.parse(rawChunks);

      const step = result.generationSteps.find(s => s.nodeId === '3');
      expect(step.nodeTitle).toBe('My Custom Sampler');
    });

    it('should extract node group from workflow', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0]
          }
        },
        "4": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["3", 0]
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {}
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "7": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["4", 0]
          }
        }
      };

      const workflowData = {
        "nodes": [
          {
            "id": 3,
            "type": "KSampler",
            "group": 0
          }
        ],
        "groups": [
          {
            "id": 0,
            "title": "Base Generation"
          }
        ]
      };

      const rawChunks = {
        prompt: promptData,
        workflow: workflowData
      };

      const result = parser.parse(rawChunks);

      const step = result.generationSteps.find(s => s.nodeId === '3');
      expect(step.nodeGroup).toBe('Base Generation');
    });

    it('should handle workflow without titles or groups', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0]
          }
        },
        "4": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["3", 0]
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {}
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "7": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["4", 0]
          }
        }
      };

      const workflowData = {
        "nodes": [
          {
            "id": 3,
            "type": "KSampler"
          }
        ]
      };

      const rawChunks = {
        prompt: promptData,
        workflow: workflowData
      };

      const result = parser.parse(rawChunks);

      const step = result.generationSteps.find(s => s.nodeId === '3');
      expect(step.nodeTitle).toBeUndefined();
      expect(step.nodeGroup).toBeUndefined();
      expect(step.nodeName).toBe('KSampler');
      expect(step.nodeType).toBe('KSampler');
    });
  });

  describe('Base Sampler Identification', () => {
    it('should mark the base sampler correctly', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0]
          }
        },
        "32": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 222222,
            "steps": 20,
            "cfg": 7.0,
            "sampler_name": "dpmpp_2m",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["3", 0]
          }
        },
        "4": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["32", 0]
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {}
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "7": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["4", 0]
          }
        }
      };

      const rawChunks = {
        prompt: promptData
      };

      const result = parser.parse(rawChunks);

      expect(result.generationSteps.length).toBe(2);

      // Node 3 should be base (closest to latent source)
      const step1 = result.generationSteps.find(s => s.nodeId === '3');
      expect(step1.isBase).toBe(true);

      // Node 32 should not be base
      const step2 = result.generationSteps.find(s => s.nodeId === '32');
      expect(step2.isBase).toBe(false);
    });

    it('should assign stepIndex correctly', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0]
          }
        },
        "32": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 222222,
            "steps": 20,
            "cfg": 7.0,
            "sampler_name": "dpmpp_2m",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["3", 0]
          }
        },
        "325": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 333333,
            "steps": 15,
            "cfg": 8.0,
            "sampler_name": "euler_a",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["32", 0]
          }
        },
        "4": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["325", 0]
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {}
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "7": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["4", 0]
          }
        }
      };

      const rawChunks = {
        prompt: promptData
      };

      const result = parser.parse(rawChunks);

      expect(result.generationSteps.length).toBe(3);

      // Check that stepIndex is assigned (1, 2, 3)
      const stepIndices = result.generationSteps.map(s => s.stepIndex).sort();
      expect(stepIndices).toEqual([1, 2, 3]);
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate distance to latent source', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0]
          }
        },
        "32": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 222222,
            "steps": 20,
            "cfg": 7.0,
            "sampler_name": "dpmpp_2m",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["3", 0]
          }
        },
        "4": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["32", 0]
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {}
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "7": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["4", 0]
          }
        }
      };

      const rawChunks = {
        prompt: promptData
      };

      const result = parser.parse(rawChunks);

      const step1 = result.generationSteps.find(s => s.nodeId === '3');
      const step2 = result.generationSteps.find(s => s.nodeId === '32');

      // Node 3 is directly connected to EmptyLatentImage (distance 1)
      expect(step1.distance).toBe(1);

      // Node 32 is connected through Node 3 (distance 2)
      expect(step2.distance).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle samplers without prompts', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "latent_image": ["5", 0]
            // No positive or negative
          }
        },
        "4": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["3", 0]
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {}
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["4", 0]
          }
        }
      };

      const rawChunks = {
        prompt: promptData
      };

      const result = parser.parse(rawChunks);

      expect(result.generationSteps.length).toBe(1);
      const step = result.generationSteps[0];
      expect(step.positive).toBe('');
      expect(step.negative).toBe('');
    });

    it('should handle empty prompt text', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0]
          }
        },
        "4": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["3", 0]
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {}
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": ""
          }
        },
        "7": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": ""
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["4", 0]
          }
        }
      };

      const rawChunks = {
        prompt: promptData
      };

      const result = parser.parse(rawChunks);

      const step = result.generationSteps[0];
      expect(step.positive).toBe('');
      expect(step.negative).toBe('');
    });

    it('should trim whitespace from prompts', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0]
          }
        },
        "4": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["3", 0]
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {}
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "  masterpiece, best quality  "
          }
        },
        "7": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "  worst quality  "
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["4", 0]
          }
        }
      };

      const rawChunks = {
        prompt: promptData
      };

      const result = parser.parse(rawChunks);

      const step = result.generationSteps[0];
      expect(step.positive).toBe('masterpiece, best quality');
      expect(step.negative).toBe('worst quality');
    });
  });

  describe('Checkpoint Tracking', () => {
    it('should track checkpoint for each sampler', () => {
      const promptData = {
        "1": {
          "class_type": "CheckpointLoaderSimple",
          "inputs": {
            "ckpt_name": "models/checkpoints/v1-5-pruned.safetensors"
          }
        },
        "2": {
          "class_type": "CheckpointLoaderSimple",
          "inputs": {
            "ckpt_name": "models/checkpoints/sd_xl_base.safetensors"
          }
        },
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0],
            "model": ["1", 0]
          }
        },
        "32": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 222222,
            "steps": 20,
            "cfg": 7.0,
            "sampler_name": "dpmpp_2m",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["3", 0],
            "model": ["2", 0]
          }
        },
        "4": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["32", 0]
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {}
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "7": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["4", 0]
          }
        }
      };

      const rawChunks = {
        prompt: promptData
      };

      const result = parser.parse(rawChunks);

      expect(result.generationSteps.length).toBe(2);

      // First sampler should use v1-5-pruned
      const step1 = result.generationSteps.find(s => s.nodeId === '3');
      expect(step1.checkpoint).toBe('v1-5-pruned.safetensors');

      // Second sampler should use sd_xl_base
      const step2 = result.generationSteps.find(s => s.nodeId === '32');
      expect(step2.checkpoint).toBe('sd_xl_base.safetensors');

      // Global checkpoint should be from base sampler
      expect(result.checkpoint).toBe('v1-5-pruned.safetensors');
    });

    it('should handle samplers without checkpoint', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0]
            // No model input
          }
        },
        "4": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["3", 0]
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {}
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "7": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["4", 0]
          }
        }
      };

      const rawChunks = {
        prompt: promptData
      };

      const result = parser.parse(rawChunks);

      const step = result.generationSteps[0];
      expect(step.checkpoint).toBeNull();
    });

    it('should fallback to workflow checkpoint if not found in prompt', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0]
          }
        },
        "4": {
          "class_type": "VAEDecode",
          "inputs": {
            "samples": ["3", 0]
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {}
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "7": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "9": {
          "class_type": "SaveImage",
          "inputs": {
            "images": ["4", 0]
          }
        }
      };

      const workflowData = {
        "nodes": [
          {
            "id": 1,
            "type": "CheckpointLoaderSimple",
            "widgets_values": ["v1-5-pruned.safetensors"]
          }
        ]
      };

      const rawChunks = {
        prompt: promptData,
        workflow: workflowData
      };

      const result = parser.parse(rawChunks);

      // Should have fallback checkpoint from workflow
      expect(result.checkpoint).toBe('v1-5-pruned.safetensors');
    });
  });

  describe('Exception Cases', () => {
    it('should handle workflow with no KSampler nodes', () => {
      const promptData = {
        "1": {
          "class_type": "CheckpointLoaderSimple",
          "inputs": {
            "ckpt_name": "v1-5-pruned.safetensors"
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {}
        }
      };

      const rawChunks = {
        prompt: promptData
      };

      const result = parser.parse(rawChunks);

      expect(result.generationSteps).toEqual([]);
      expect(result.extra_samplers).toEqual([]);
      expect(result.seed).toBeUndefined();
      expect(result.steps).toBeUndefined();
      expect(result.sampler).toBeUndefined();
    });

    it('should handle workflow with no SaveImage node (fallback mode)', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["5", 0]
          }
        },
        "5": {
          "class_type": "EmptyLatentImage",
          "inputs": {}
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "7": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        }
        // No SaveImage node
      };

      const rawChunks = {
        prompt: promptData
      };

      const result = parser.parse(rawChunks);

      // Should still find the sampler (no sink nodes, so uses all samplers)
      expect(result.generationSteps.length).toBe(1);
      // Note: sampler_fallback may or may not be true depending on whether
      // the algorithm considers "no sink nodes" as a fallback condition
      // The important thing is that the sampler is found
      expect(result.seed).toBe(111111);
    });

    it('should handle circular references in workflow', () => {
      const promptData = {
        "3": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 111111,
            "steps": 30,
            "cfg": 6.0,
            "sampler_name": "euler",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["32", 0]  // Circular reference
          }
        },
        "32": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 222222,
            "steps": 20,
            "cfg": 7.0,
            "sampler_name": "dpmpp_2m",
            "positive": ["6", 0],
            "negative": ["7", 0],
            "latent_image": ["3", 0]  // Circular reference
          }
        },
        "6": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        },
        "7": {
          "class_type": "CLIPTextEncode",
          "inputs": {
            "text": "test"
          }
        }
      };

      const rawChunks = {
        prompt: promptData
      };

      // Should not crash or hang
      expect(() => {
        const result = parser.parse(rawChunks);
        expect(result.generationSteps.length).toBe(2);
      }).not.toThrow();
    });

    it('should handle malformed prompt data', () => {
      const rawChunks = {
        prompt: "not a valid json"
      };

      // Should not crash
      expect(() => {
        const result = parser.parse(rawChunks);
        expect(result.format).toBe('comfyui');
      }).not.toThrow();
    });
  });
});

