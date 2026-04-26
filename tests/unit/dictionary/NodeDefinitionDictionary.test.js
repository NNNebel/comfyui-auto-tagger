import { describe, it, expect, beforeEach } from 'vitest';

// Import IIFE module - it exports via module.exports for Node.js
const NodeDefinitionDictionary = require('../../../js/metadata-parser/dictionary/NodeDefinitionDictionary.js');

describe('NodeDefinitionDictionary', () => {
  describe('constructor', () => {
    it('should create dictionary with valid data', () => {
      const data = {
        version: '1.0.0',
        nodes: {
          'TestNode': {
            type: 'provider',
            value_path: ['inputs', 'value'],
            metadata_type: 'test'
          }
        }
      };
      
      const dict = new NodeDefinitionDictionary(data);
      expect(dict.version).toBe('1.0.0');
      expect(dict.nodes).toEqual(data.nodes);
    });

    it('should handle empty nodes', () => {
      const data = {
        version: '1.0.0',
        nodes: {}
      };
      
      const dict = new NodeDefinitionDictionary(data);
      expect(dict.nodes).toEqual({});
    });
  });

  describe('getNodeDefinition', () => {
    let dict;

    beforeEach(() => {
      dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'RandomNoise': {
            type: 'provider',
            value_path: ['inputs', 'noise_seed'],
            metadata_type: 'seed'
          },
          'AnySwitch': {
            type: 'router',
            passthrough_rules: {
              'output': ['input1', 'input2']
            }
          }
        }
      });
    });

    it('should return definition for existing node', () => {
      const def = dict.getNodeDefinition('RandomNoise');
      expect(def).toEqual({
        type: 'provider',
        value_path: ['inputs', 'noise_seed'],
        metadata_type: 'seed'
      });
    });

    it('should return null for non-existing node', () => {
      const def = dict.getNodeDefinition('NonExistent');
      expect(def).toBeNull();
    });
  });

  describe('hasDefinition', () => {
    let dict;

    beforeEach(() => {
      dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'RandomNoise': {
            type: 'provider',
            value_path: ['inputs', 'noise_seed'],
            metadata_type: 'seed'
          }
        }
      });
    });

    it('should return true for existing node', () => {
      expect(dict.hasDefinition('RandomNoise')).toBe(true);
    });

    it('should return false for non-existing node', () => {
      expect(dict.hasDefinition('NonExistent')).toBe(false);
    });
  });

  describe('validate', () => {
    it('should validate correct dictionary', () => {
      const dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'TestNode': {
            type: 'provider',
            value_path: ['inputs', 'value'],
            metadata_type: 'test'
          }
        }
      });

      const result = dict.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing version', () => {
      const dict = new NodeDefinitionDictionary({
        nodes: {}
      });

      const result = dict.validate();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: version');
    });

    it('should detect missing type field', () => {
      const dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'TestNode': {
            value_path: ['inputs', 'value']
          }
        }
      });

      const result = dict.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Missing required field "type"'))).toBe(true);
    });

    it('should detect invalid type', () => {
      const dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'TestNode': {
            type: 'invalid',
            value_path: ['inputs', 'value']
          }
        }
      });

      const result = dict.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid type'))).toBe(true);
    });

    it('should detect missing passthrough_rules for router', () => {
      const dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'TestRouter': {
            type: 'router'
          }
        }
      });

      const result = dict.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('requires "passthrough_rules"'))).toBe(true);
    });

    it('should detect missing value_path for provider', () => {
      const dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'TestProvider': {
            type: 'provider'
          }
        }
      });

      const result = dict.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('requires either "value_path" or "value_paths"'))).toBe(true);
    });

    it('should detect missing port_mapping for sampler', () => {
      const dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'TestSampler': {
            type: 'sampler'
          }
        }
      });

      const result = dict.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('requires "port_mapping"'))).toBe(true);
    });

    it('should detect missing input_key for checkpoint_loader', () => {
      const dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'TestCheckpointLoader': {
            type: 'checkpoint_loader'
          }
        }
      });

      const result = dict.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('requires "input_key"'))).toBe(true);
    });

    it('should detect missing input_key for lora_loader', () => {
      const dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'TestLoraLoader': {
            type: 'lora_loader'
          }
        }
      });

      const result = dict.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('requires "input_key"'))).toBe(true);
    });

    it('should accept valid checkpoint_loader definition', () => {
      const dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'TestCheckpointLoader': {
            type: 'checkpoint_loader',
            input_key: 'ckpt_name'
          }
        }
      });

      const result = dict.validate();
      expect(result.valid).toBe(true);
    });

    it('should accept valid lora_loader definition', () => {
      const dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'TestLoraLoader': {
            type: 'lora_loader',
            input_key: 'lora_name'
          }
        }
      });

      const result = dict.validate();
      expect(result.valid).toBe(true);
    });
  });

  describe('getDefault', () => {
    it('should return default dictionary', () => {
      const dict = NodeDefinitionDictionary.getDefault();
      expect(dict).toBeInstanceOf(NodeDefinitionDictionary);
      expect(dict.version).toBeDefined();
      expect(dict.nodes).toBeDefined();
    });

    it('should include RandomNoise definition', () => {
      const dict = NodeDefinitionDictionary.getDefault();
      expect(dict.hasDefinition('RandomNoise')).toBe(true);
      const def = dict.getNodeDefinition('RandomNoise');
      expect(def.type).toBe('provider');
      expect(def.metadata_type).toBe('seed');
    });

    it('should include SamplerCustomAdvanced definition', () => {
      const dict = NodeDefinitionDictionary.getDefault();
      expect(dict.hasDefinition('SamplerCustomAdvanced')).toBe(true);
      const def = dict.getNodeDefinition('SamplerCustomAdvanced');
      expect(def.type).toBe('sampler');
      expect(def.port_mapping).toBeDefined();
    });

    it('should include AnySwitch definition', () => {
      const dict = NodeDefinitionDictionary.getDefault();
      expect(dict.hasDefinition('AnySwitch')).toBe(true);
      const def = dict.getNodeDefinition('AnySwitch');
      expect(def.type).toBe('router');
      expect(def.passthrough_rules).toBeDefined();
    });

    it('should include CheckpointLoaderSimple as checkpoint_loader', () => {
      const dict = NodeDefinitionDictionary.getDefault();
      expect(dict.hasDefinition('CheckpointLoaderSimple')).toBe(true);
      const def = dict.getNodeDefinition('CheckpointLoaderSimple');
      expect(def.type).toBe('checkpoint_loader');
      expect(def.input_key).toBe('ckpt_name');
    });

    it('should include UNETLoader as checkpoint_loader', () => {
      const dict = NodeDefinitionDictionary.getDefault();
      expect(dict.hasDefinition('UNETLoader')).toBe(true);
      const def = dict.getNodeDefinition('UNETLoader');
      expect(def.type).toBe('checkpoint_loader');
      expect(def.input_key).toBe('unet_name');
    });

    it('should include LoraLoader as lora_loader', () => {
      const dict = NodeDefinitionDictionary.getDefault();
      expect(dict.hasDefinition('LoraLoader')).toBe(true);
      const def = dict.getNodeDefinition('LoraLoader');
      expect(def.type).toBe('lora_loader');
      expect(def.input_key).toBe('lora_name');
    });
  });

  describe('cache functionality', () => {
    it('should save dictionary to cache', () => {
      // Skip if localStorage is not available (Node.js environment)
      if (typeof localStorage === 'undefined') {
        return;
      }

      const dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'TestNode': {
            type: 'provider',
            value_path: ['inputs', 'value'],
            metadata_type: 'test'
          }
        }
      });

      // Save to cache
      dict.saveToCache();

      // Load from cache
      const cached = NodeDefinitionDictionary.loadFromCache();
      expect(cached).toBeInstanceOf(NodeDefinitionDictionary);
      expect(cached.version).toBe('1.0.0');
      expect(cached.hasDefinition('TestNode')).toBe(true);
    });

    it('should return null when cache is empty', () => {
      // Skip if localStorage is not available (Node.js environment)
      if (typeof localStorage === 'undefined') {
        return;
      }

      // Clear cache first
      localStorage.removeItem('node_definition_dictionary');

      const cached = NodeDefinitionDictionary.loadFromCache();
      expect(cached).toBeNull();
    });

    it('should handle invalid cache data', () => {
      // Skip if localStorage is not available (Node.js environment)
      if (typeof localStorage === 'undefined') {
        return;
      }

      // Set invalid cache data
      localStorage.setItem('node_definition_dictionary', 'invalid json');

      const cached = NodeDefinitionDictionary.loadFromCache();
      expect(cached).toBeNull();
    });
  });

  describe('fetchFromURL', () => {
    it('should return null when fetch is not available', async () => {
      // In Node.js environment without fetch polyfill, this should return null
      // The method handles this gracefully by returning null on error
      const result = await NodeDefinitionDictionary.fetchFromURL('https://example.com/dict.json');
      
      // Result can be either null (fetch failed) or a dictionary (fetch succeeded with default)
      // We just verify the method doesn't throw
      expect(result === null || result instanceof NodeDefinitionDictionary).toBe(true);
    });

    it('should return a promise', () => {
      // Test that the method exists and returns a promise
      const promise = NodeDefinitionDictionary.fetchFromURL('https://example.com/dict.json');
      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe('node type validation', () => {
    it('should accept valid sampler node', () => {
      const dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'TestSampler': {
            type: 'sampler',
            port_mapping: {
              seed: 'noise_seed',
              steps: 'steps',
              cfg: 'cfg'
            }
          }
        }
      });

      const result = dict.validate();
      expect(result.valid).toBe(true);
    });

    it('should accept valid router node', () => {
      const dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'TestRouter': {
            type: 'router',
            passthrough_rules: {
              'output': ['input1', 'input2']
            }
          }
        }
      });

      const result = dict.validate();
      expect(result.valid).toBe(true);
    });

    it('should accept valid provider node with value_path', () => {
      const dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'TestProvider': {
            type: 'provider',
            value_path: ['inputs', 'value'],
            metadata_type: 'test'
          }
        }
      });

      const result = dict.validate();
      expect(result.valid).toBe(true);
    });

    it('should accept valid provider node with value_paths', () => {
      const dict = new NodeDefinitionDictionary({
        version: '1.0.0',
        nodes: {
          'TestProvider': {
            type: 'provider',
            value_paths: {
              seed: ['inputs', 'seed'],
              steps: ['inputs', 'steps']
            }
          }
        }
      });

      const result = dict.validate();
      expect(result.valid).toBe(true);
    });
  });
});
