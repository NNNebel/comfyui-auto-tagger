// tests/unit/ComfyUISamplerAnalyzer.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import ComfyUIGraph from '../../js/metadata-parser/graph/ComfyUIGraph.js';
import ComfyUISamplerAnalyzer from '../../js/metadata-parser/graph/ComfyUISamplerAnalyzer.js';

describe('ComfyUISamplerAnalyzer', () => {
  describe('Constructor', () => {
    it('should create analyzer with valid graph', () => {
      const graph = new ComfyUIGraph({});
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      
      expect(analyzer).toBeInstanceOf(ComfyUISamplerAnalyzer);
      expect(analyzer.graph).toBe(graph);
    });
    
    it('should throw error if graph is not provided', () => {
      expect(() => new ComfyUISamplerAnalyzer()).toThrow('requires a valid ComfyUIGraph');
    });
    
    it('should throw error if graph is not a ComfyUIGraph instance', () => {
      expect(() => new ComfyUISamplerAnalyzer({})).toThrow('requires a valid ComfyUIGraph');
    });
  });
  
  describe('findBaseSampler', () => {
    it('should return null if no samplers exist', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const result = analyzer.findBaseSampler();
      
      expect(result.baseSampler).toBeNull();
      expect(result.allSamplers).toEqual([]);
      expect(result.isFallback).toBe(false);
    });
    
    it('should find single sampler as base', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 123, 
            steps: 20, 
            cfg: 7, 
            positive: ['3', 0], 
            negative: ['4', 0] 
          } 
        },
        '3': { class_type: 'CLIPTextEncode', inputs: {} },
        '4': { class_type: 'CLIPTextEncode', inputs: {} },
        '5': { class_type: 'SaveImage', inputs: { images: ['2', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const result = analyzer.findBaseSampler();
      
      expect(result.baseSampler).toBe('2');
      expect(result.allSamplers).toHaveLength(1);
      expect(result.allSamplers[0].id).toBe('2');
      expect(result.allSamplers[0].distance).toBe(1);
      expect(result.isFallback).toBe(false);
    });
    
    it('should select sampler closest to latent source', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 1, 
            steps: 20, 
            cfg: 7, 
            positive: ['3', 0], 
            negative: ['4', 0] 
          } 
        },
        '3': { class_type: 'CLIPTextEncode', inputs: {} },
        '4': { class_type: 'CLIPTextEncode', inputs: {} },
        '5': { class_type: 'VAEDecode', inputs: { samples: ['2', 0] } },
        '6': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['5', 0],
            seed: 2, 
            steps: 20, 
            cfg: 7, 
            positive: ['7', 0], 
            negative: ['8', 0] 
          } 
        },
        '7': { class_type: 'CLIPTextEncode', inputs: {} },
        '8': { class_type: 'CLIPTextEncode', inputs: {} },
        '9': { class_type: 'SaveImage', inputs: { images: ['6', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const result = analyzer.findBaseSampler();
      
      // Sampler '2' is at distance 1, sampler '6' is at distance 3
      expect(result.baseSampler).toBe('2');
      expect(result.allSamplers).toHaveLength(2);
      expect(result.allSamplers[0].distance).toBe(1);
      expect(result.allSamplers[1].distance).toBe(3);
    });
    
    it('should use smallest ID as tiebreaker for same distance', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '5': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 1, 
            steps: 20, 
            cfg: 7, 
            positive: ['2', 0], 
            negative: ['3', 0] 
          } 
        },
        '2': { class_type: 'CLIPTextEncode', inputs: {} },
        '3': { class_type: 'CLIPTextEncode', inputs: {} },
        '10': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 2, 
            steps: 20, 
            cfg: 7, 
            positive: ['4', 0], 
            negative: ['6', 0] 
          } 
        },
        '4': { class_type: 'CLIPTextEncode', inputs: {} },
        '6': { class_type: 'CLIPTextEncode', inputs: {} },
        '7': { class_type: 'SaveImage', inputs: { images: ['5', 0] } },
        '8': { class_type: 'SaveImage', inputs: { images: ['10', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const result = analyzer.findBaseSampler();
      
      // Both samplers at distance 1, should select '5' (smaller ID)
      expect(result.baseSampler).toBe('5');
      expect(result.allSamplers[0].id).toBe('5');
      expect(result.allSamplers[1].id).toBe('10');
    });
    
    it('should handle VAEEncode as img2img source', () => {
      const promptData = {
        '1': { class_type: 'LoadImage', inputs: {} },
        '2': { class_type: 'VAEEncode', inputs: { pixels: ['1', 0] } },
        '3': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['2', 0],
            seed: 123, 
            steps: 20, 
            cfg: 7, 
            positive: ['4', 0], 
            negative: ['5', 0] 
          } 
        },
        '4': { class_type: 'CLIPTextEncode', inputs: {} },
        '5': { class_type: 'CLIPTextEncode', inputs: {} },
        '6': { class_type: 'SaveImage', inputs: { images: ['3', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const result = analyzer.findBaseSampler();
      
      // VAEEncode is a source, so distance should be 1
      expect(result.baseSampler).toBe('3');
      expect(result.allSamplers[0].distance).toBe(1);
    });
    
    it('should use fallback if no output nodes exist', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 123, 
            steps: 20, 
            cfg: 7, 
            positive: ['3', 0], 
            negative: ['4', 0] 
          } 
        },
        '3': { class_type: 'CLIPTextEncode', inputs: {} },
        '4': { class_type: 'CLIPTextEncode', inputs: {} }
        // No SaveImage or PreviewImage
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const result = analyzer.findBaseSampler();
      
      expect(result.baseSampler).toBe('2');
      expect(result.isFallback).toBe(true);
    });
    
    it('should use fallback if samplers not reachable from output nodes', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 123, 
            steps: 20, 
            cfg: 7, 
            positive: ['3', 0], 
            negative: ['4', 0] 
          } 
        },
        '3': { class_type: 'CLIPTextEncode', inputs: {} },
        '4': { class_type: 'CLIPTextEncode', inputs: {} },
        '5': { class_type: 'SaveImage', inputs: {} } // Not connected to sampler
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const result = analyzer.findBaseSampler();
      
      expect(result.baseSampler).toBe('2');
      expect(result.isFallback).toBe(true);
    });
  });
  
  describe('extractSamplerMetadata', () => {
    it('should extract basic sampler metadata', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 123456, 
            steps: 20, 
            cfg: 7.5, 
            sampler_name: 'euler',
            scheduler: 'normal',
            positive: ['3', 0], 
            negative: ['4', 0] 
          } 
        },
        '3': { class_type: 'CLIPTextEncode', inputs: { text: 'beautiful landscape' } },
        '4': { class_type: 'CLIPTextEncode', inputs: { text: 'ugly' } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const metadata = analyzer.extractSamplerMetadata('2', true);
      
      expect(metadata.nodeId).toBe('2');
      expect(metadata.nodeType).toBe('KSampler');
      expect(metadata.isBase).toBe(true);
      expect(metadata.seed).toBe(123456);
      expect(metadata.steps).toBe(20);
      expect(metadata.cfg).toBe(7.5);
      expect(metadata.sampler).toBe('euler');
      expect(metadata.scheduler).toBe('normal');
      expect(metadata.positive).toBe('beautiful landscape');
      expect(metadata.negative).toBe('ugly');
    });
    
    it('should find checkpoint from loader', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'models/model.safetensors' } },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            model: ['1', 0],
            latent_image: ['3', 0],
            seed: 123, 
            steps: 20, 
            cfg: 7, 
            positive: ['4', 0], 
            negative: ['5', 0] 
          } 
        },
        '3': { class_type: 'EmptyLatentImage', inputs: {} },
        '4': { class_type: 'CLIPTextEncode', inputs: {} },
        '5': { class_type: 'CLIPTextEncode', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const metadata = analyzer.extractSamplerMetadata('2');
      
      expect(metadata.checkpoint).toBe('model.safetensors');
    });
    
    it('should return null for non-existent sampler', () => {
      const graph = new ComfyUIGraph({});
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const metadata = analyzer.extractSamplerMetadata('999');
      
      expect(metadata).toBeNull();
    });
    
    it('should handle sampler with no checkpoint', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 123, 
            steps: 20, 
            cfg: 7, 
            positive: ['3', 0], 
            negative: ['4', 0] 
          } 
        },
        '3': { class_type: 'CLIPTextEncode', inputs: {} },
        '4': { class_type: 'CLIPTextEncode', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const metadata = analyzer.extractSamplerMetadata('2');
      
      expect(metadata.checkpoint).toBeNull();
    });
    
    it('should resolve inputs through primitive nodes', () => {
      const promptData = {
        '1': { class_type: 'PrimitiveNode', inputs: { value: 999 } },
        '2': { class_type: 'PrimitiveNode', inputs: { value: 30 } },
        '3': { class_type: 'EmptyLatentImage', inputs: {} },
        '4': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['3', 0],
            seed: ['1', 0],
            steps: ['2', 0],
            cfg: 8.0,
            positive: ['5', 0], 
            negative: ['6', 0] 
          } 
        },
        '5': { class_type: 'CLIPTextEncode', inputs: {} },
        '6': { class_type: 'CLIPTextEncode', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const metadata = analyzer.extractSamplerMetadata('4');
      
      expect(metadata.seed).toBe(999);
      expect(metadata.steps).toBe(30);
    });
  });
  
  describe('extractAllSamplersMetadata', () => {
    it('should extract metadata from all samplers', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 111, 
            steps: 20, 
            cfg: 7, 
            positive: ['3', 0], 
            negative: ['4', 0] 
          } 
        },
        '3': { class_type: 'CLIPTextEncode', inputs: {} },
        '4': { class_type: 'CLIPTextEncode', inputs: {} },
        '5': { class_type: 'VAEDecode', inputs: { samples: ['2', 0] } },
        '6': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['5', 0],
            seed: 222, 
            steps: 30, 
            cfg: 8, 
            positive: ['7', 0], 
            negative: ['8', 0] 
          } 
        },
        '7': { class_type: 'CLIPTextEncode', inputs: {} },
        '8': { class_type: 'CLIPTextEncode', inputs: {} },
        '9': { class_type: 'SaveImage', inputs: { images: ['6', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const allMetadata = analyzer.extractAllSamplersMetadata();
      
      expect(allMetadata).toHaveLength(2);
      
      // First sampler (base)
      expect(allMetadata[0].nodeId).toBe('2');
      expect(allMetadata[0].isBase).toBe(true);
      expect(allMetadata[0].seed).toBe(111);
      expect(allMetadata[0].distance).toBe(1);
      
      // Second sampler
      expect(allMetadata[1].nodeId).toBe('6');
      expect(allMetadata[1].isBase).toBe(false);
      expect(allMetadata[1].seed).toBe(222);
      expect(allMetadata[1].distance).toBe(3);
    });
    
    it('should return empty array if no samplers', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const allMetadata = analyzer.extractAllSamplersMetadata();
      
      expect(allMetadata).toEqual([]);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle sampler with no latent input', () => {
      const promptData = {
        '1': { 
          class_type: 'KSampler', 
          inputs: { 
            seed: 123, 
            steps: 20, 
            cfg: 7, 
            positive: ['2', 0], 
            negative: ['3', 0] 
          } 
        },
        '2': { class_type: 'CLIPTextEncode', inputs: {} },
        '3': { class_type: 'CLIPTextEncode', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const result = analyzer.findBaseSampler();
      
      // Sampler with no latent input is considered a source (distance 0)
      expect(result.baseSampler).toBe('1');
      expect(result.allSamplers[0].distance).toBe(0);
    });
    
    it('should handle complex workflow with multiple paths', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'model1.safetensors' } },
        '2': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'model2.safetensors' } },
        '3': { class_type: 'EmptyLatentImage', inputs: {} },
        '4': { 
          class_type: 'KSampler', 
          inputs: { 
            model: ['1', 0],
            latent_image: ['3', 0],
            seed: 111, 
            steps: 20, 
            cfg: 7, 
            positive: ['5', 0], 
            negative: ['6', 0] 
          } 
        },
        '5': { class_type: 'CLIPTextEncode', inputs: {} },
        '6': { class_type: 'CLIPTextEncode', inputs: {} },
        '7': { 
          class_type: 'KSampler', 
          inputs: { 
            model: ['2', 0],
            latent_image: ['3', 0],
            seed: 222, 
            steps: 20, 
            cfg: 7, 
            positive: ['8', 0], 
            negative: ['9', 0] 
          } 
        },
        '8': { class_type: 'CLIPTextEncode', inputs: {} },
        '9': { class_type: 'CLIPTextEncode', inputs: {} },
        '10': { class_type: 'SaveImage', inputs: { images: ['4', 0] } },
        '11': { class_type: 'SaveImage', inputs: { images: ['7', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const allMetadata = analyzer.extractAllSamplersMetadata();
      
      expect(allMetadata).toHaveLength(2);
      
      // Both samplers should find their respective checkpoints
      const sampler4 = allMetadata.find(m => m.nodeId === '4');
      const sampler7 = allMetadata.find(m => m.nodeId === '7');
      
      expect(sampler4.checkpoint).toBe('model1.safetensors');
      expect(sampler7.checkpoint).toBe('model2.safetensors');
    });
  });
});
