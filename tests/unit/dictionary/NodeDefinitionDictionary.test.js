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
  });

  describe('getDefault', () => {
    it('should return default dictionary', () => {
      const dict = NodeDefinitionDictionary.getDefault();
      expect(dict).toBeInstanceOf(NodeDefinitionDictionary);
      expect(dict.version).toBe('1.0.0');
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
  });
});
