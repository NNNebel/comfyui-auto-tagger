// tests/unit/ComfyUIGraph.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import ComfyUIGraph from '../../js/metadata-parser/graph/ComfyUIGraph.js';

describe('ComfyUIGraph', () => {
  describe('Graph Construction', () => {
    it('should create empty graph from empty prompt data', () => {
      const graph = new ComfyUIGraph({});
      
      expect(graph.getNodeCount()).toBe(0);
      expect(graph.getSinkNodes()).toEqual([]);
    });
    
    it('should build nodes map from prompt data', () => {
      const promptData = {
        '1': { class_type: 'KSampler', inputs: { seed: 123 } },
        '2': { class_type: 'CheckpointLoader', inputs: { ckpt_name: 'model.safetensors' } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      expect(graph.getNodeCount()).toBe(2);
      expect(graph.hasNode('1')).toBe(true);
      expect(graph.hasNode('2')).toBe(true);
      expect(graph.getNode('1')).toEqual(promptData['1']);
    });
    
    it('should build forward edges from node inputs', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { class_type: 'KSampler', inputs: { model: ['1', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const parents = graph.getParents('2');
      expect(parents.has('1')).toBe(true);
      expect(parents.size).toBe(1);
    });
    
    it('should build reverse edges for children', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { class_type: 'KSampler', inputs: { model: ['1', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const children = graph.getChildren('1');
      expect(children.has('2')).toBe(true);
      expect(children.size).toBe(1);
    });
    
    it('should handle multiple inputs from same node', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { 
          class_type: 'KSampler', 
          inputs: { 
            model: ['1', 0],
            positive: ['1', 1],
            negative: ['1', 2]
          } 
        }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const parents = graph.getParents('2');
      expect(parents.has('1')).toBe(true);
      expect(parents.size).toBe(1); // Should deduplicate
    });
    
    it('should handle complex graph with multiple connections', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1] } },
        '3': { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1] } },
        '4': { 
          class_type: 'KSampler', 
          inputs: { 
            model: ['1', 0],
            positive: ['2', 0],
            negative: ['3', 0]
          } 
        }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      expect(graph.getNodeCount()).toBe(4);
      expect(graph.getParents('4').size).toBe(3);
      expect(graph.getChildren('1').size).toBe(3);
    });
  });
  
  describe('Node Classification', () => {
    it('should classify KSampler as sampler', () => {
      const promptData = {
        '1': { 
          class_type: 'KSampler', 
          inputs: { seed: 123, steps: 20, cfg: 7, positive: ['2', 0], negative: ['3', 0] } 
        }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      expect(graph.getNodeType('1')).toBe('sampler');
    });
    
    it('should classify SamplerCustomAdvanced as sampler', () => {
      const promptData = {
        '1': { 
          class_type: 'SamplerCustomAdvanced', 
          inputs: { sampler: ['2', 0], sigmas: ['3', 0], latent_image: ['4', 0] } 
        }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      expect(graph.getNodeType('1')).toBe('sampler');
    });
    
    it('should classify CheckpointLoader correctly', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoaderSimple', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      expect(graph.getNodeType('1')).toBe('checkpoint_loader');
    });
    
    it('should classify LoraLoader correctly', () => {
      const promptData = {
        '1': { class_type: 'LoraLoader', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      expect(graph.getNodeType('1')).toBe('lora_loader');
    });
    
    it('should classify SaveImage as output', () => {
      const promptData = {
        '1': { class_type: 'SaveImage', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      expect(graph.getNodeType('1')).toBe('output');
    });
    
    it('should classify PreviewImage as output', () => {
      const promptData = {
        '1': { class_type: 'PreviewImage', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      expect(graph.getNodeType('1')).toBe('output');
    });
    
    it('should classify CLIPTextEncode as conditioning', () => {
      const promptData = {
        '1': { class_type: 'CLIPTextEncode', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      expect(graph.getNodeType('1')).toBe('conditioning');
    });
    
    it('should classify VAEDecode as vae', () => {
      const promptData = {
        '1': { class_type: 'VAEDecode', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      expect(graph.getNodeType('1')).toBe('vae');
    });
    
    it('should classify unknown nodes as other', () => {
      const promptData = {
        '1': { class_type: 'CustomNode', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      expect(graph.getNodeType('1')).toBe('other');
    });
  });
  
  describe('getNodesByType', () => {
    it('should find all nodes of a specific type', () => {
      const promptData = {
        '1': { class_type: 'KSampler', inputs: { seed: 1, steps: 20, cfg: 7, positive: ['2', 0], negative: ['3', 0] } },
        '2': { class_type: 'CheckpointLoader', inputs: {} },
        '3': { class_type: 'KSampler', inputs: { seed: 2, steps: 20, cfg: 7, positive: ['4', 0], negative: ['5', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const samplers = graph.getNodesByType('sampler');
      expect(samplers).toHaveLength(2);
      expect(samplers).toContain('1');
      expect(samplers).toContain('3');
    });
    
    it('should return empty array if no nodes match', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const samplers = graph.getNodesByType('sampler');
      expect(samplers).toEqual([]);
    });
  });
  
  describe('getSinkNodes', () => {
    it('should find nodes with no children', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { class_type: 'KSampler', inputs: { model: ['1', 0] } },
        '3': { class_type: 'SaveImage', inputs: { images: ['2', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const sinks = graph.getSinkNodes();
      expect(sinks).toEqual(['3']);
    });
    
    it('should find multiple sink nodes', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { class_type: 'KSampler', inputs: { model: ['1', 0] } },
        '3': { class_type: 'SaveImage', inputs: { images: ['2', 0] } },
        '4': { class_type: 'PreviewImage', inputs: { images: ['2', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const sinks = graph.getSinkNodes();
      expect(sinks).toHaveLength(2);
      expect(sinks).toContain('3');
      expect(sinks).toContain('4');
    });
    
    it('should include disconnected intermediate nodes as sinks', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['3', 0] } },
        '3': { class_type: 'CLIPTextEncode', inputs: {} },
        '4': { class_type: 'CLIPTextEncode', inputs: {} }, // Disconnected
        '5': { class_type: 'SaveImage', inputs: { images: ['2', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const sinks = graph.getSinkNodes();
      expect(sinks).toHaveLength(2);
      expect(sinks).toContain('4'); // Disconnected CLIPTextEncode
      expect(sinks).toContain('5'); // SaveImage
    });
    
    it('should return all nodes if no connections exist', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { class_type: 'KSampler', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const sinks = graph.getSinkNodes();
      expect(sinks).toHaveLength(2);
    });
  });
  
  describe('getOutputNodes', () => {
    it('should find only output nodes', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { class_type: 'KSampler', inputs: { model: ['1', 0] } },
        '3': { class_type: 'CLIPTextEncode', inputs: {} }, // Sink but not output
        '4': { class_type: 'SaveImage', inputs: { images: ['2', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const outputs = graph.getOutputNodes();
      expect(outputs).toEqual(['4']);
    });
    
    it('should find multiple output nodes', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { class_type: 'KSampler', inputs: { model: ['1', 0] } },
        '3': { class_type: 'SaveImage', inputs: { images: ['2', 0] } },
        '4': { class_type: 'PreviewImage', inputs: { images: ['2', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const outputs = graph.getOutputNodes();
      expect(outputs).toHaveLength(2);
      expect(outputs).toContain('3');
      expect(outputs).toContain('4');
    });
    
    it('should return empty array if no output nodes exist', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { class_type: 'KSampler', inputs: { model: ['1', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const outputs = graph.getOutputNodes();
      expect(outputs).toEqual([]);
    });
  });
  
  describe('getSinkNodes', () => {
    it('should find nodes with no children', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { class_type: 'KSampler', inputs: { model: ['1', 0] } },
        '3': { class_type: 'SaveImage', inputs: { images: ['2', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const sinks = graph.getSinkNodes();
      expect(sinks).toEqual(['3']);
    });
    
    it('should find multiple sink nodes', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { class_type: 'KSampler', inputs: { model: ['1', 0] } },
        '3': { class_type: 'SaveImage', inputs: { images: ['2', 0] } },
        '4': { class_type: 'PreviewImage', inputs: { images: ['2', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const sinks = graph.getSinkNodes();
      expect(sinks).toHaveLength(2);
      expect(sinks).toContain('3');
      expect(sinks).toContain('4');
    });
    
    it('should return all nodes if no connections exist', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { class_type: 'KSampler', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const sinks = graph.getSinkNodes();
      expect(sinks).toHaveLength(2);
    });
  });
  
  describe('traceToType', () => {
    it('should find nodes of target type by backtracing', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { class_type: 'KSampler', inputs: { model: ['1', 0], seed: 123, steps: 20, cfg: 7, positive: ['3', 0], negative: ['4', 0] } },
        '3': { class_type: 'CLIPTextEncode', inputs: {} },
        '4': { class_type: 'CLIPTextEncode', inputs: {} },
        '5': { class_type: 'SaveImage', inputs: { images: ['2', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const samplers = graph.traceToType('5', 'sampler');
      expect(samplers).toHaveLength(1);
      expect(samplers[0].id).toBe('2');
      expect(samplers[0].depth).toBe(1);
    });
    
    it('should find multiple nodes at different depths', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { class_type: 'KSampler', inputs: { model: ['1', 0], seed: 1, steps: 20, cfg: 7, positive: ['3', 0], negative: ['4', 0] } },
        '3': { class_type: 'CLIPTextEncode', inputs: {} },
        '4': { class_type: 'CLIPTextEncode', inputs: {} },
        '5': { class_type: 'VAEDecode', inputs: { samples: ['2', 0] } },
        '6': { class_type: 'KSampler', inputs: { latent_image: ['5', 0], seed: 2, steps: 20, cfg: 7, positive: ['7', 0], negative: ['8', 0] } },
        '7': { class_type: 'CLIPTextEncode', inputs: {} },
        '8': { class_type: 'CLIPTextEncode', inputs: {} },
        '9': { class_type: 'SaveImage', inputs: { images: ['6', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const samplers = graph.traceToType('9', 'sampler');
      expect(samplers).toHaveLength(2);
      
      const depths = samplers.map(s => s.depth).sort();
      expect(depths).toEqual([1, 3]);
    });
    
    it('should respect maxDepth parameter', () => {
      const promptData = {
        '1': { class_type: 'CheckpointLoader', inputs: {} },
        '2': { class_type: 'KSampler', inputs: { model: ['1', 0], seed: 1, steps: 20, cfg: 7, positive: ['3', 0], negative: ['4', 0] } },
        '3': { class_type: 'CLIPTextEncode', inputs: {} },
        '4': { class_type: 'CLIPTextEncode', inputs: {} },
        '5': { class_type: 'VAEDecode', inputs: { samples: ['2', 0] } },
        '6': { class_type: 'SaveImage', inputs: { images: ['5', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const loaders = graph.traceToType('6', 'checkpoint_loader', 2);
      expect(loaders).toEqual([]); // Loader is at depth 3, beyond maxDepth
    });
    
    it('should return empty array if no nodes found', () => {
      const promptData = {
        '1': { class_type: 'SaveImage', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const samplers = graph.traceToType('1', 'sampler');
      expect(samplers).toEqual([]);
    });
    
    it('should handle cycles gracefully', () => {
      const promptData = {
        '1': { class_type: 'CustomNode', inputs: { input: ['2', 0] } },
        '2': { class_type: 'CustomNode', inputs: { input: ['1', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      // Should not hang due to cycle detection
      const result = graph.traceToType('1', 'sampler');
      expect(result).toEqual([]);
    });
  });
  
  describe('resolveInput', () => {
    it('should return direct value if not a link', () => {
      const promptData = {
        '1': { class_type: 'KSampler', inputs: { seed: 123 } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const seed = graph.resolveInput('1', 'seed');
      expect(seed).toBe(123);
    });
    
    it('should resolve link to parent node', () => {
      const promptData = {
        '1': { class_type: 'PrimitiveNode', inputs: { value: 456 } },
        '2': { class_type: 'KSampler', inputs: { seed: ['1', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const seed = graph.resolveInput('2', 'seed');
      expect(seed).toBe(456);
    });
    
    it('should resolve through passthrough nodes', () => {
      const promptData = {
        '1': { class_type: 'PrimitiveNode', inputs: { value: 789 } },
        '2': { class_type: 'PassthroughNode', inputs: { seed: ['1', 0] } },
        '3': { class_type: 'KSampler', inputs: { seed: ['2', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const seed = graph.resolveInput('3', 'seed');
      expect(seed).toBe(789);
    });
    
    it('should try common value keys if same key not found', () => {
      const promptData = {
        '1': { class_type: 'PrimitiveNode', inputs: { int: 999 } },
        '2': { class_type: 'KSampler', inputs: { seed: ['1', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const seed = graph.resolveInput('2', 'seed');
      expect(seed).toBe(999);
    });
    
    it('should handle text inputs', () => {
      const promptData = {
        '1': { class_type: 'PrimitiveNode', inputs: { text: 'a beautiful landscape' } },
        '2': { class_type: 'CLIPTextEncode', inputs: { text: ['1', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const text = graph.resolveInput('2', 'text');
      expect(text).toBe('a beautiful landscape');
    });
    
    it('should return null if node not found', () => {
      const promptData = {
        '1': { class_type: 'KSampler', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const value = graph.resolveInput('999', 'seed');
      expect(value).toBeNull();
    });
    
    it('should return null if input key not found', () => {
      const promptData = {
        '1': { class_type: 'KSampler', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const value = graph.resolveInput('1', 'nonexistent');
      expect(value).toBeNull();
    });
    
    it('should handle cycles gracefully', () => {
      const promptData = {
        '1': { class_type: 'CustomNode', inputs: { value: ['2', 0] } },
        '2': { class_type: 'CustomNode', inputs: { value: ['1', 0] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      const value = graph.resolveInput('1', 'value');
      expect(value).toBeNull();
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle nodes with no inputs', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage' }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      expect(graph.getNodeCount()).toBe(1);
      expect(graph.getParents('1').size).toBe(0);
    });
    
    it('should handle nodes with empty inputs object', () => {
      const promptData = {
        '1': { class_type: 'EmptyLatentImage', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      expect(graph.getNodeCount()).toBe(1);
      expect(graph.getParents('1').size).toBe(0);
    });
    
    it('should handle numeric node IDs', () => {
      const promptData = {
        1: { class_type: 'KSampler', inputs: { seed: 123 } },
        2: { class_type: 'CheckpointLoader', inputs: {} }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      expect(graph.hasNode('1')).toBe(true);
      expect(graph.hasNode('2')).toBe(true);
    });
    
    it('should handle malformed links gracefully', () => {
      const promptData = {
        '1': { class_type: 'KSampler', inputs: { seed: ['invalid'] } }
      };
      
      const graph = new ComfyUIGraph(promptData);
      
      expect(graph.getParents('1').size).toBe(0);
    });
  });
});
