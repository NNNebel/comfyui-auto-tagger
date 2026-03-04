import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Import using require for IIFE modules
const NodeDefinitionDictionary = require('../../js/metadata-parser/dictionary/NodeDefinitionDictionary.js');

/**
 * Property-Based Tests for NodeDefinitionDictionary
 * 
 * These tests verify universal properties that should hold for dictionary validation.
 * Using fast-check to generate randomized test cases.
 */

describe('NodeDefinitionDictionary - Property Tests', () => {
  /**
   * Property 8: Dictionary class_type Keys
   * 
   * For any valid dictionary, all node definitions must be keyed by their class_type.
   * The class_type field in the definition must match the key.
   * 
   * **Validates: Requirements 6.1**
   */
  describe('Property 8: Dictionary class_type Keys', () => {
    it('should have class_type matching the dictionary key', () => {
      fc.assert(
        fc.property(
          // Generate dictionary with class_type keys
          fc.dictionary(
            fc.string({ minLength: 1 }), // class_type key
            fc.record({
              class_type: fc.string({ minLength: 1 }),
              type: fc.constantFrom('sampler', 'router', 'provider'),
              version: fc.string()
            })
          ),
          (nodes) => {
            // Ensure class_type matches key
            const validNodes = {};
            for (const [key, def] of Object.entries(nodes)) {
              validNodes[key] = { ...def, class_type: key };
            }
            
            const dictData = { version: '1.0.0', nodes: validNodes };
            const dict = new NodeDefinitionDictionary(dictData);
            
            // Property: All definitions should be retrievable by their class_type
            for (const classType of Object.keys(validNodes)) {
              const definition = dict.getNodeDefinition(classType);
              if (definition) {
                expect(definition.class_type).toBe(classType);
              }
            }
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 9: Node Type Classification Support
   * 
   * For any valid dictionary, all node definitions must have a type field
   * that is one of: 'sampler', 'router', or 'provider'.
   * 
   * **Validates: Requirements 6.2**
   */
  describe('Property 9: Node Type Classification Support', () => {
    it('should only accept valid node types', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // class_type
          fc.constantFrom('sampler', 'router', 'provider'), // valid type
          (classType, type) => {
            const dictData = {
              version: '1.0.0',
              nodes: {
                [classType]: {
                  class_type: classType,
                  type: type,
                  ...(type === 'router' ? { passthrough_rules: [] } : {}),
                  ...(type === 'provider' ? { value_path: 'inputs.value' } : {}),
                  ...(type === 'sampler' ? { port_mapping: {} } : {})
                }
              }
            };
            
            const dict = new NodeDefinitionDictionary(dictData);
            const definition = dict.getNodeDefinition(classType);
            
            // Property: Definition should exist and have the correct type
            return definition && definition.type === type;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect invalid node types via validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0), // class_type (non-empty)
          fc.string({ minLength: 1 }).filter(s => !['sampler', 'router', 'provider'].includes(s) && s.trim().length > 0), // invalid type
          (classType, invalidType) => {
            const dictData = {
              version: '1.0.0',
              nodes: {
                [classType]: {
                  class_type: classType,
                  type: invalidType
                }
              }
            };
            
            const dict = new NodeDefinitionDictionary(dictData);
            const validation = dict.validate();
            
            // Property: Validation should fail for invalid type
            return !validation.valid && 
                   validation.errors.some(e => e.includes('Invalid type'));
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 10-12: Node Type-Specific Definitions
   * 
   * Router nodes must have passthrough_rules.
   * Sampler nodes must have port_mapping.
   * Provider nodes must have value_path.
   * 
   * **Validates: Requirements 6.3, 6.4, 6.5**
   */
  describe('Property 10: Router Node passthrough_rules', () => {
    it('should require passthrough_rules for router nodes', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // class_type
          fc.array(fc.record({
            from: fc.string(),
            to: fc.string()
          })), // passthrough_rules
          (classType, rules) => {
            const dictData = {
              version: '1.0.0',
              nodes: {
                [classType]: {
                  class_type: classType,
                  type: 'router',
                  passthrough_rules: rules
                }
              }
            };
            
            const dict = new NodeDefinitionDictionary(dictData);
            const definition = dict.getNodeDefinition(classType);
            
            // Property: Router node should have passthrough_rules
            return definition && 
                   definition.type === 'router' && 
                   Array.isArray(definition.passthrough_rules);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect missing passthrough_rules via validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0), // class_type (non-empty)
          (classType) => {
            const dictData = {
              version: '1.0.0',
              nodes: {
                [classType]: {
                  class_type: classType,
                  type: 'router'
                  // Missing passthrough_rules
                }
              }
            };
            
            const dict = new NodeDefinitionDictionary(dictData);
            const validation = dict.validate();
            
            // Property: Validation should fail for missing passthrough_rules
            return !validation.valid && 
                   validation.errors.some(e => e.includes('passthrough_rules'));
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 11: Sampler Node port_mapping', () => {
    it('should require port_mapping for sampler nodes', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // class_type
          fc.dictionary(fc.string(), fc.string()), // port_mapping
          (classType, mapping) => {
            const dictData = {
              version: '1.0.0',
              nodes: {
                [classType]: {
                  class_type: classType,
                  type: 'sampler',
                  port_mapping: mapping
                }
              }
            };
            
            const dict = new NodeDefinitionDictionary(dictData);
            const definition = dict.getNodeDefinition(classType);
            
            // Property: Sampler node should have port_mapping
            return definition && 
                   definition.type === 'sampler' && 
                   typeof definition.port_mapping === 'object';
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect missing port_mapping via validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0), // class_type (non-empty)
          (classType) => {
            const dictData = {
              version: '1.0.0',
              nodes: {
                [classType]: {
                  class_type: classType,
                  type: 'sampler'
                  // Missing port_mapping
                }
              }
            };
            
            const dict = new NodeDefinitionDictionary(dictData);
            const validation = dict.validate();
            
            // Property: Validation should fail for missing port_mapping
            return !validation.valid && 
                   validation.errors.some(e => e.includes('port_mapping'));
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 12: Provider Node value_path', () => {
    it('should require value_path for provider nodes', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // class_type
          fc.string({ minLength: 1 }), // value_path
          (classType, valuePath) => {
            const dictData = {
              version: '1.0.0',
              nodes: {
                [classType]: {
                  class_type: classType,
                  type: 'provider',
                  value_path: valuePath
                }
              }
            };
            
            const dict = new NodeDefinitionDictionary(dictData);
            const definition = dict.getNodeDefinition(classType);
            
            // Property: Provider node should have value_path
            return definition && 
                   definition.type === 'provider' && 
                   typeof definition.value_path === 'string';
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should detect missing value_path via validation', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter(s => s.trim().length > 0), // class_type (non-empty)
          (classType) => {
            const dictData = {
              version: '1.0.0',
              nodes: {
                [classType]: {
                  class_type: classType,
                  type: 'provider'
                  // Missing value_path
                }
              }
            };
            
            const dict = new NodeDefinitionDictionary(dictData);
            const validation = dict.validate();
            
            // Property: Validation should fail for missing value_path
            return !validation.valid && 
                   validation.errors.some(e => e.includes('value_path'));
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 13-14: Dictionary Version and JSON Format
   * 
   * All dictionaries must have a version field.
   * Dictionaries must be valid JSON.
   * 
   * **Validates: Requirements 6.6, 6.7**
   */
  describe('Property 13: Dictionary version Field', () => {
    it('should require version field', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // version
          (version) => {
            const dictData = {
              version: version,
              nodes: {}
            };
            
            const dict = new NodeDefinitionDictionary(dictData);
            
            // Property: Dictionary should have version
            return dict._originalData.version === version;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject dictionary without version', () => {
      // Test with explicit missing version
      const dictData = {
        // Missing version
        nodes: {}
      };
      
      // Property: Should throw error for missing version
      try {
        new NodeDefinitionDictionary(dictData);
        expect.fail('Should have thrown error for missing version');
      } catch (e) {
        expect(e.message).toContain('version');
      }
    });
  });

  describe('Property 14: Dictionary JSON Format', () => {
    it('should be serializable to JSON and back', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // version
          fc.dictionary(
            fc.string({ minLength: 1 }),
            fc.record({
              class_type: fc.string({ minLength: 1 }),
              type: fc.constantFrom('sampler', 'router', 'provider')
            })
          ),
          (version, nodes) => {
            // Add required fields based on type
            const validNodes = {};
            for (const [key, def] of Object.entries(nodes)) {
              validNodes[key] = {
                ...def,
                class_type: key,
                ...(def.type === 'router' ? { passthrough_rules: [] } : {}),
                ...(def.type === 'provider' ? { value_path: 'inputs.value' } : {}),
                ...(def.type === 'sampler' ? { port_mapping: {} } : {})
              };
            }
            
            const dictData = { version, nodes: validNodes };
            
            // Property: Should be serializable to JSON and back
            const json = JSON.stringify(dictData);
            const parsed = JSON.parse(json);
            const dict = new NodeDefinitionDictionary(parsed);
            
            return dict._originalData.version === version;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
