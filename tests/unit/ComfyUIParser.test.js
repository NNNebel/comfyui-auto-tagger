import { describe, it, expect, beforeEach } from 'vitest';
import ComfyUIParser from '../../js/metadata-parser/parsers/ComfyUIParser.js';

describe('ComfyUIParser', () => {
  let parser;

  beforeEach(() => {
    parser = new ComfyUIParser();
  });

  describe('getFormatName', () => {
    it('should return "comfyui"', () => {
      expect(parser.getFormatName()).toBe('comfyui');
    });
  });

  describe('parse', () => {
    it('should return metadata with format "comfyui"', () => {
      const rawChunks = {};
      const result = parser.parse(rawChunks);
      expect(result.format).toBe('comfyui');
    });

    it('should extract checkpoint from prompt data', () => {
      const rawChunks = {
        prompt: {
          "4": { 
            class_type: "CheckpointLoaderSimple", 
            inputs: { ckpt_name: "sd_xl_base_1.0.safetensors" } 
          }
        }
      };
      const result = parser.parse(rawChunks);
      expect(result.checkpoint).toBe("sd_xl_base_1.0.safetensors");
    });

    it('should extract checkpoint from workflow data', () => {
      const rawChunks = {
        workflow: {
          nodes: [
            {
              type: "CheckpointLoaderSimple",
              widgets_values: ["model_name.safetensors"]
            }
          ]
        }
      };
      const result = parser.parse(rawChunks);
      expect(result.checkpoint).toBe("model_name.safetensors");
    });

    it('should handle checkpoint paths with forward slashes', () => {
      const rawChunks = {
        workflow: {
          nodes: [
            {
              type: "CheckpointLoaderSimple",
              widgets_values: ["subfolder/model.safetensors"]
            }
          ]
        }
      };
      const result = parser.parse(rawChunks);
      expect(result.checkpoint).toBe("model.safetensors");
    });

    it('should handle checkpoint paths with backslashes', () => {
      const rawChunks = {
        workflow: {
          nodes: [
            {
              type: "CheckpointLoaderSimple",
              widgets_values: ["subfolder\\model.safetensors"]
            }
          ]
        }
      };
      const result = parser.parse(rawChunks);
      expect(result.checkpoint).toBe("model.safetensors");
    });

    it('should identify base sampler by distance to EmptyLatentImage', () => {
      const rawChunks = {
        prompt: {
          "1": { 
            class_type: "KSampler", 
            inputs: { 
              seed: 111, 
              steps: 20,
              cfg: 7,
              sampler_name: "base", 
              positive: "test positive",
              negative: "test negative",
              latent_image: ["10", 0] 
            } 
          },
          "2": { 
            class_type: "KSampler", 
            inputs: { 
              seed: 222, 
              steps: 30,
              cfg: 8,
              sampler_name: "refiner", 
              positive: "test positive",
              negative: "test negative",
              latent_image: ["1", 0] 
            } 
          },
          "10": { 
            class_type: "EmptyLatentImage", 
            inputs: {} 
          }
        }
      };
      const result = parser.parse(rawChunks);
      expect(result.seed).toBe(111);
      expect(result.sampler).toBe("base");
      expect(result.sampler_fallback).toBe(false);
      
      // Check extra samplers
      expect(result.extra_samplers).toHaveLength(2);
      const base = result.extra_samplers.find(s => s.id === "1");
      expect(base.is_base).toBe(true);
    });

    it('should fallback to smallest ID if source is not found', () => {
      const rawChunks = {
        prompt: {
          "10": { 
            class_type: "KSampler", 
            inputs: { 
              seed: 999, 
              steps: 20,
              cfg: 7,
              sampler_name: "fallback_target",
              latent_image: ["999", 0] // Link to non-existent node
            } 
          },
          "5": { 
            class_type: "KSampler", 
            inputs: { 
              seed: 888, 
              steps: 20,
              cfg: 7,
              sampler_name: "fallback_winner",
              latent_image: ["998", 0] // Link to non-existent node
            } 
          }
        }
      };
      const result = parser.parse(rawChunks);
      expect(result.seed).toBe(888); // ID 5 < ID 10
      expect(result.sampler).toBe("fallback_winner");
      expect(result.sampler_fallback).toBe(true);
    });

    it('should merge prompts from multiple KSamplers', () => {
      const rawChunks = {
        prompt: {
          "1": { 
            class_type: "KSampler", 
            inputs: { 
              seed: 111,
              steps: 20,
              cfg: 7,
              positive: ["10", 0], 
              negative: ["11", 0], 
              sampler_name: "s1" 
            } 
          },
          "2": { 
            class_type: "KSampler", 
            inputs: { 
              seed: 222,
              steps: 20,
              cfg: 7,
              positive: ["12", 0], 
              negative: ["13", 0], 
              sampler_name: "s2" 
            } 
          },
          "10": { 
            class_type: "TextNode", 
            inputs: { text: "cat" } 
          },
          "11": { 
            class_type: "TextNode", 
            inputs: { text: "bad" } 
          },
          "12": { 
            class_type: "TextNode", 
            inputs: { text: "dog" } 
          },
          "13": { 
            class_type: "TextNode", 
            inputs: { text: "worst" } 
          }
        }
      };
      const result = parser.parse(rawChunks);
      
      // Should contain all unique prompts
      expect(result.positive).toContain("cat");
      expect(result.positive).toContain("dog");
      expect(result.negative).toContain("bad");
      expect(result.negative).toContain("worst");
    });

    it('should deduplicate prompts', () => {
      const rawChunks = {
        prompt: {
          "1": { 
            class_type: "KSampler", 
            inputs: { 
              seed: 111,
              steps: 20,
              cfg: 7,
              positive: ["10", 0] 
            } 
          },
          "2": { 
            class_type: "KSampler", 
            inputs: { 
              seed: 222,
              steps: 20,
              cfg: 7,
              positive: ["11", 0] 
            } 
          },
          "10": { 
            class_type: "TextNode", 
            inputs: { text: "cat" } 
          },
          "11": { 
            class_type: "TextNode", 
            inputs: { text: "cat" } 
          }
        }
      };
      const result = parser.parse(rawChunks);
      expect(result.positive.trim()).toBe("cat");
    });

    it('should extract LoRA names', () => {
      const rawChunks = {
        prompt: {
          "1": { 
            class_type: "LoraLoader", 
            inputs: { lora_name: "lora1.safetensors" } 
          },
          "2": { 
            class_type: "LoraLoader", 
            inputs: { lora_name: "lora2.safetensors" } 
          }
        }
      };
      const result = parser.parse(rawChunks);
      expect(result.loras).toEqual(expect.arrayContaining(["lora1.safetensors", "lora2.safetensors"]));
    });

    it('should extract all sampler parameters', () => {
      const rawChunks = {
        prompt: {
          "1": { 
            class_type: "KSampler", 
            inputs: { 
              seed: 12345,
              steps: 20,
              cfg: 7.5,
              sampler_name: "euler_a",
              scheduler: "normal",
              latent_image: ["10", 0]
            } 
          },
          "10": { 
            class_type: "EmptyLatentImage", 
            inputs: {} 
          }
        }
      };
      const result = parser.parse(rawChunks);
      expect(result.seed).toBe(12345);
      expect(result.steps).toBe(20);
      expect(result.cfg).toBe(7.5);
      expect(result.sampler).toBe("euler_a");
      expect(result.scheduler).toBe("normal");
    });

    it('should handle empty rawChunks gracefully', () => {
      const rawChunks = {};
      const result = parser.parse(rawChunks);
      expect(result.format).toBe('comfyui');
      expect(result.checkpoint).toBeUndefined();
      expect(result.loras).toBeUndefined();
    });

    it('should handle malformed prompt data gracefully', () => {
      const rawChunks = {
        prompt: null
      };
      const result = parser.parse(rawChunks);
      expect(result.format).toBe('comfyui');
    });

    it('should handle malformed workflow data gracefully', () => {
      const rawChunks = {
        workflow: { nodes: null }
      };
      const result = parser.parse(rawChunks);
      expect(result.format).toBe('comfyui');
    });
  });
});
