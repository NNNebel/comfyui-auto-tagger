// tests/unit/ComfyUISamplerAnalyzer.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ComfyUIGraph from '../../js/metadata-parser/graph/ComfyUIGraph.js';
import ComfyUISamplerAnalyzer from '../../js/metadata-parser/graph/ComfyUISamplerAnalyzer.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const NodeDefinitionDictionary = require('../../js/metadata-parser/dictionary/NodeDefinitionDictionary.js');

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
            model: ['1', 1],
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
      
      // VAEEncode is a source, and we add +2 when tracing through VAEEncode
      expect(result.baseSampler).toBe('3');
      expect(result.allSamplers[0].distance).toBe(2);
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

  describe('Suspicious Node Detection', () => {
    it('should detect suspicious nodes with missing inputs', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 123, 
            steps: 20, 
            cfg: 7
          } 
        },
        '3': { class_type: 'VAEDecode', inputs: { samples: ['2', 0] } },
        '171': { 
          class_type: 'ImageUpscaleWithModel', 
          inputs: { 
            upscale_model: ['170', 0]
            // Missing 'image' input - this is suspicious
          } 
        },
        '175': { class_type: 'ImageScale', inputs: { image: ['171', 0] } },
        '170': { class_type: 'VAEEncode', inputs: { pixels: ['175', 0] } },
        '32': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['170', 0],
            seed: 456, 
            steps: 20, 
            cfg: 7
          } 
        },
        '100': { class_type: 'SaveImage', inputs: { images: ['32', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const result = analyzer.findBaseSampler();
      
      // Should detect node 171 as suspicious
      expect(result.suspiciousNodes).toBeDefined();
      expect(result.suspiciousNodes.length).toBeGreaterThan(0);
      
      const suspiciousNode = result.suspiciousNodes.find(n => n.nodeId === '171');
      expect(suspiciousNode).toBeDefined();
      expect(suspiciousNode.nodeType).toBe('ImageUpscaleWithModel');
      expect(suspiciousNode.reasonKey).toBe('suspiciousNode.reason.imageProcessingNoInput');
    });
    
    it('should detect KSampler without latent_image input when connected to output', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 123, 
            steps: 20, 
            cfg: 7
          } 
        },
        '3': { class_type: 'VAEDecode', inputs: { samples: ['2', 0] } },
        '32': { 
          class_type: 'KSampler', 
          inputs: { 
            // Missing latent_image input - this is suspicious
            seed: 456, 
            steps: 20, 
            cfg: 7
          } 
        },
        '33': { class_type: 'VAEDecode', inputs: { samples: ['32', 0] } },
        '100': { class_type: 'SaveImage', inputs: { images: ['33', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const result = analyzer.findBaseSampler();
      
      // Should detect node 32 as suspicious
      expect(result.suspiciousNodes).toBeDefined();
      expect(result.suspiciousNodes.length).toBeGreaterThan(0);
      
      const suspiciousNode = result.suspiciousNodes.find(n => n.nodeId === '32');
      expect(suspiciousNode).toBeDefined();
      expect(suspiciousNode.nodeType).toBe('KSampler');
      expect(suspiciousNode.reasonKey).toBe('suspiciousNode.reason.samplerNoInput');
    });
    
    it('should return empty suspiciousNodes array when all nodes are valid', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 123, 
            steps: 20, 
            cfg: 7
          } 
        },
        '3': { class_type: 'VAEDecode', inputs: { samples: ['2', 0] } },
        '100': { class_type: 'SaveImage', inputs: { images: ['3', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const result = analyzer.findBaseSampler();
      
      // Should have no suspicious nodes
      expect(result.suspiciousNodes).toBeDefined();
      expect(result.suspiciousNodes).toEqual([]);
    });
    
    it('should deduplicate suspicious nodes from multiple output traces', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 123, 
            steps: 20, 
            cfg: 7
          } 
        },
        '3': { class_type: 'VAEDecode', inputs: { samples: ['2', 0] } },
        '171': { 
          class_type: 'ImageUpscaleWithModel', 
          inputs: { 
            upscale_model: ['170', 0]
            // Missing 'image' input
          } 
        },
        '100': { class_type: 'SaveImage', inputs: { images: ['3', 0] } },
        '101': { class_type: 'PreviewImage', inputs: { images: ['3', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const result = analyzer.findBaseSampler();
      
      // Should have suspicious nodes but deduplicated
      expect(result.suspiciousNodes).toBeDefined();
      
      // Count occurrences of each nodeId
      const nodeIdCounts = {};
      result.suspiciousNodes.forEach(node => {
        nodeIdCounts[node.nodeId] = (nodeIdCounts[node.nodeId] || 0) + 1;
      });
      
      // Each nodeId should appear only once
      Object.values(nodeIdCounts).forEach(count => {
        expect(count).toBe(1);
      });
    });

    it('should detect VAEEncode without pixels/image input', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 123, 
            steps: 20, 
            cfg: 7
          } 
        },
        '3': { class_type: 'VAEDecode', inputs: { samples: ['2', 0] } },
        '170': { 
          class_type: 'VAEEncode', 
          inputs: { 
            vae: ['4', 0]
            // Missing 'pixels' input - this is suspicious
          } 
        },
        '4': { class_type: 'VAELoader', inputs: {} },
        '100': { class_type: 'SaveImage', inputs: { images: ['170', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const result = analyzer.findBaseSampler();
      
      // Should detect node 170 as suspicious
      expect(result.suspiciousNodes).toBeDefined();
      const suspiciousNode = result.suspiciousNodes.find(n => n.nodeId === '170');
      expect(suspiciousNode).toBeDefined();
      expect(suspiciousNode.nodeType).toBe('VAEEncode');
      expect(suspiciousNode.reasonKey).toBe('suspiciousNode.reason.vaeEncodeNoInput');
    });

    it('should detect VAEDecode without samples/latent input', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 123, 
            steps: 20, 
            cfg: 7
          } 
        },
        '3': { 
          class_type: 'VAEDecode', 
          inputs: { 
            vae: ['4', 0]
            // Missing 'samples' input - this is suspicious
          } 
        },
        '4': { class_type: 'VAELoader', inputs: {} },
        '100': { class_type: 'SaveImage', inputs: { images: ['3', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const result = analyzer.findBaseSampler();
      
      // Should detect node 3 as suspicious
      expect(result.suspiciousNodes).toBeDefined();
      const suspiciousNode = result.suspiciousNodes.find(n => n.nodeId === '3');
      expect(suspiciousNode).toBeDefined();
      expect(suspiciousNode.nodeType).toBe('VAEDecode');
      expect(suspiciousNode.reasonKey).toBe('suspiciousNode.reason.vaeDecodeNoInput');
    });

    it('should detect ImageScale without image input', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 123, 
            steps: 20, 
            cfg: 7
          } 
        },
        '3': { class_type: 'VAEDecode', inputs: { samples: ['2', 0] } },
        '175': { 
          class_type: 'ImageScale', 
          inputs: { 
            upscale_method: 'lanczos',
            scale_by: 0.5
            // Missing 'image' input - this is suspicious
          } 
        },
        '100': { class_type: 'SaveImage', inputs: { images: ['175', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const result = analyzer.findBaseSampler();
      
      // Should detect node 175 as suspicious
      expect(result.suspiciousNodes).toBeDefined();
      const suspiciousNode = result.suspiciousNodes.find(n => n.nodeId === '175');
      expect(suspiciousNode).toBeDefined();
      expect(suspiciousNode.nodeType).toBe('ImageScale');
      expect(suspiciousNode.reasonKey).toBe('suspiciousNode.reason.imageProcessingNoInput');
    });

    it('should detect multiple suspicious nodes of different types', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            latent_image: ['1', 0],
            seed: 123, 
            steps: 20, 
            cfg: 7
          } 
        },
        '3': { 
          class_type: 'VAEDecode', 
          inputs: { 
            vae: ['4', 0]
            // Missing 'samples' input
          } 
        },
        '4': { class_type: 'VAELoader', inputs: {} },
        '170': { 
          class_type: 'VAEEncode', 
          inputs: { 
            vae: ['4', 0]
            // Missing 'pixels' input
          } 
        },
        '175': { 
          class_type: 'ImageScale', 
          inputs: { 
            upscale_method: 'lanczos'
            // Missing 'image' input
          } 
        },
        '100': { class_type: 'SaveImage', inputs: { images: ['3', 0] } },
        '101': { class_type: 'PreviewImage', inputs: { images: ['170', 0] } },
        '102': { class_type: 'PreviewImage', inputs: { images: ['175', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const result = analyzer.findBaseSampler();
      
      // Should detect all three suspicious nodes
      expect(result.suspiciousNodes).toBeDefined();
      expect(result.suspiciousNodes.length).toBe(3);
      
      const nodeIds = result.suspiciousNodes.map(n => n.nodeId).sort();
      expect(nodeIds).toEqual(['170', '175', '3']);
      
      // Verify each node has correct reason
      const vaeDecodeNode = result.suspiciousNodes.find(n => n.nodeId === '3');
      expect(vaeDecodeNode.reasonKey).toBe('suspiciousNode.reason.vaeDecodeNoInput');
      
      const vaeEncodeNode = result.suspiciousNodes.find(n => n.nodeId === '170');
      expect(vaeEncodeNode.reasonKey).toBe('suspiciousNode.reason.vaeEncodeNoInput');
      
      const imageScaleNode = result.suspiciousNodes.find(n => n.nodeId === '175');
      expect(imageScaleNode.reasonKey).toBe('suspiciousNode.reason.imageProcessingNoInput');
    });
  });

  // ---------------------------------------------------------------------------
  // _traceConditioningText
  // ---------------------------------------------------------------------------
  describe('_traceConditioningText (via extractSamplerMetadata)', () => {
    // Helper to build a minimal prompt with a KSampler
    function makePrompt(extra) {
      return Object.assign({
        '99': { class_type: 'EmptyLatentImage', inputs: {} },
        '10': {
          class_type: 'KSampler',
          inputs: {
            latent_image: ['99', 0],
            seed: 1, steps: 20, cfg: 7,
            positive: ['20', 0],
            negative: ['30', 0],
          }
        }
      }, extra);
    }

    it('should extract positive and negative text from direct CLIPTextEncode', () => {
      const prompt = makePrompt({
        '20': { class_type: 'CLIPTextEncode', inputs: { text: 'beautiful landscape' } },
        '30': { class_type: 'CLIPTextEncode', inputs: { text: 'ugly' } },
      });
      const graph = new ComfyUIGraph(prompt);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const meta = analyzer.extractSamplerMetadata('10');
      expect(meta.positive).toBe('beautiful landscape');
      expect(meta.negative).toBe('ugly');
    });

    it('should collect and join texts from ConditioningCombine (positive)', () => {
      const prompt = makePrompt({
        '21': { class_type: 'CLIPTextEncode', inputs: { text: 'beautiful landscape' } },
        '22': { class_type: 'CLIPTextEncode', inputs: { text: 'cinematic lighting' } },
        '20': { class_type: 'ConditioningCombine', inputs: { conditioning_1: ['21', 0], conditioning_2: ['22', 0] } },
        '30': { class_type: 'CLIPTextEncode', inputs: { text: 'ugly' } },
      });
      const graph = new ComfyUIGraph(prompt);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      analyzer.setDictionary(NodeDefinitionDictionary.getDefault());
      const meta = analyzer.extractSamplerMetadata('10');
      expect(meta.positive).toContain('beautiful landscape');
      expect(meta.positive).toContain('cinematic lighting');
    });

    it('should collect and join texts from ConditioningCombine (negative)', () => {
      const prompt = makePrompt({
        '20': { class_type: 'CLIPTextEncode', inputs: { text: 'masterpiece' } },
        '31': { class_type: 'CLIPTextEncode', inputs: { text: 'ugly' } },
        '32': { class_type: 'CLIPTextEncode', inputs: { text: 'blurry' } },
        '30': { class_type: 'ConditioningCombine', inputs: { conditioning_1: ['31', 0], conditioning_2: ['32', 0] } },
      });
      const graph = new ComfyUIGraph(prompt);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      analyzer.setDictionary(NodeDefinitionDictionary.getDefault());
      const meta = analyzer.extractSamplerMetadata('10');
      expect(meta.negative).toContain('ugly');
      expect(meta.negative).toContain('blurry');
    });

    it('should pass through ConditioningSetArea to reach CLIPTextEncode', () => {
      const prompt = makePrompt({
        '21': { class_type: 'CLIPTextEncode', inputs: { text: 'area prompt' } },
        '20': { class_type: 'ConditioningSetArea', inputs: { conditioning: ['21', 0], width: 512, height: 512, x: 0, y: 0, strength: 1.0 } },
        '30': { class_type: 'CLIPTextEncode', inputs: { text: 'ugly' } },
      });
      const graph = new ComfyUIGraph(prompt);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      analyzer.setDictionary(NodeDefinitionDictionary.getDefault());
      const meta = analyzer.extractSamplerMetadata('10');
      expect(meta.positive).toBe('area prompt');
    });

    it('should stop at unknown conditioning node and return empty string', () => {
      const prompt = makePrompt({
        '21': { class_type: 'CLIPTextEncode', inputs: { text: 'some text' } },
        // UnknownConditioner is not in the dictionary — traversal stops here
        '20': { class_type: 'UnknownConditioner', inputs: { conditioning: ['21', 0] } },
        '30': { class_type: 'CLIPTextEncode', inputs: { text: 'ugly' } },
      });
      const graph = new ComfyUIGraph(prompt);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const meta = analyzer.extractSamplerMetadata('10');
      expect(meta.positive).toBe('');
    });

    it('should extract text_g from CLIPTextEncodeSDXL', () => {
      const prompt = makePrompt({
        '20': { class_type: 'CLIPTextEncodeSDXL', inputs: { text_g: 'sdxl positive', text_l: 'local text' } },
        '30': { class_type: 'CLIPTextEncodeSDXL', inputs: { text_g: 'sdxl negative', text_l: 'local neg' } },
      });
      const graph = new ComfyUIGraph(prompt);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const meta = analyzer.extractSamplerMetadata('10');
      expect(meta.positive).toBe('sdxl positive');
      expect(meta.negative).toBe('sdxl negative');
    });

    it('should return empty string when positive port has no connection', () => {
      const prompt = {
        '99': { class_type: 'EmptyLatentImage', inputs: {} },
        '10': {
          class_type: 'KSampler',
          inputs: { latent_image: ['99', 0], seed: 1, steps: 20, cfg: 7 }
          // no positive / negative inputs
        }
      };
      const graph = new ComfyUIGraph(prompt);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const meta = analyzer.extractSamplerMetadata('10');
      expect(meta.positive).toBe('');
      expect(meta.negative).toBe('');
    });

    it('should skip empty text values when combining', () => {
      const prompt = makePrompt({
        '21': { class_type: 'CLIPTextEncode', inputs: { text: 'valid text' } },
        '22': { class_type: 'CLIPTextEncode', inputs: { text: '   ' } }, // whitespace only
        '20': { class_type: 'ConditioningCombine', inputs: { conditioning_1: ['21', 0], conditioning_2: ['22', 0] } },
        '30': { class_type: 'CLIPTextEncode', inputs: { text: 'ugly' } },
      });
      const graph = new ComfyUIGraph(prompt);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      analyzer.setDictionary(NodeDefinitionDictionary.getDefault());
      const meta = analyzer.extractSamplerMetadata('10');
      expect(meta.positive).toBe('valid text');
    });
  });

  describe('setReporter', () => {
    it('should store reporter instance', () => {
      const graph = new ComfyUIGraph({});
      const analyzer = new ComfyUISamplerAnalyzer(graph);

      const mockReporter = {
        log: vi.fn(),
        warn: vi.fn()
      };

      analyzer.setReporter(mockReporter);
      expect(analyzer.reporter).toBe(mockReporter);
    });

    it('should initialize with null reporter', () => {
      const graph = new ComfyUIGraph({});
      const analyzer = new ComfyUISamplerAnalyzer(graph);

      expect(analyzer.reporter).toBeNull();
    });

    it('should accept null to clear reporter', () => {
      const graph = new ComfyUIGraph({});
      const analyzer = new ComfyUISamplerAnalyzer(graph);

      const mockReporter = { log: vi.fn() };
      analyzer.setReporter(mockReporter);
      expect(analyzer.reporter).toBe(mockReporter);

      analyzer.setReporter(null);
      expect(analyzer.reporter).toBeNull();
    });

    it('should allow setting different reporter instances', () => {
      const graph = new ComfyUIGraph({});
      const analyzer = new ComfyUISamplerAnalyzer(graph);

      const reporter1 = { id: 'reporter1' };
      const reporter2 = { id: 'reporter2' };

      analyzer.setReporter(reporter1);
      expect(analyzer.reporter).toBe(reporter1);

      analyzer.setReporter(reporter2);
      expect(analyzer.reporter).toBe(reporter2);
    });

    it('should preserve reporter through extraction operations', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} },
        '2': {
          class_type: 'KSampler',
          inputs: {
            latent_image: ['1', 0],
            seed: 123,
            steps: 20,
            cfg: 7,
            sampler_name: 'euler',
            scheduler: 'normal'
          }
        },
        '3': { class_type: 'SaveImage', inputs: { images: ['2', 0] } }
      };

      const graph = new ComfyUIGraph(promptData);
      const analyzer = new ComfyUISamplerAnalyzer(graph);
      const mockReporter = { log: vi.fn() };

      analyzer.setReporter(mockReporter);

      // Perform extraction
      const result = analyzer.findBaseSampler();
      expect(result.baseSampler).toBe('2');

      // Reporter should still be set
      expect(analyzer.reporter).toBe(mockReporter);
    });

    it('should handle reporter object with various method signatures', () => {
      const graph = new ComfyUIGraph({});
      const analyzer = new ComfyUISamplerAnalyzer(graph);

      const complexReporter = {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        custom: vi.fn()
      };

      analyzer.setReporter(complexReporter);
      expect(analyzer.reporter).toBe(complexReporter);
      expect(analyzer.reporter.log).toBeDefined();
      expect(analyzer.reporter.warn).toBeDefined();
    });
  });