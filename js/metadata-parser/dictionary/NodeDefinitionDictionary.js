/**
 * NodeDefinitionDictionary - Manages custom node behavior definitions
 * 
 * This class provides a dictionary-based approach to defining how custom nodes
 * should be processed during metadata extraction. It supports three node types:
 * - sampler: Nodes that perform sampling operations
 * - router: Nodes that route inputs to outputs (switches, etc.)
 * - provider: Nodes that provide metadata values
 */

(function() {
  'use strict';

  class NodeDefinitionDictionary {
    /**
     * Create a new NodeDefinitionDictionary
     * @param {Object} dictionaryData - The dictionary data object
     */
    constructor(dictionaryData) {
      this._originalData = dictionaryData || {};
      this.version = dictionaryData.version || '1.0.0';
      this.nodes = dictionaryData.nodes || {};
    }

    /**
     * Get the definition for a node by its class_type
     * @param {string} classType - The class_type of the node
     * @returns {Object|null} The node definition or null if not found
     */
    getNodeDefinition(classType) {
      return this.nodes[classType] || null;
    }

    /**
     * Check if a node definition exists
     * @param {string} classType - The class_type of the node
     * @returns {boolean} True if the definition exists
     */
    hasDefinition(classType) {
      return classType in this.nodes;
    }

    /**
     * Validate the dictionary structure
     * @returns {Object} Validation result with {valid: boolean, errors: string[]}
     */
    validate() {
      const errors = [];

      // Check required fields in original data
      if (!this._originalData.version) {
        errors.push('Missing required field: version');
      }

      if (!this.nodes || typeof this.nodes !== 'object') {
        errors.push('Missing or invalid required field: nodes');
        return { valid: false, errors };
      }

      // Validate each node definition
      for (const [classType, definition] of Object.entries(this.nodes)) {
        if (!definition.type) {
          errors.push(`Node "${classType}": Missing required field "type"`);
          continue;
        }

        const validTypes = ['sampler', 'router', 'provider'];
        if (!validTypes.includes(definition.type)) {
          errors.push(`Node "${classType}": Invalid type "${definition.type}". Must be one of: ${validTypes.join(', ')}`);
        }

        // Type-specific validation
        if (definition.type === 'router') {
          if (!definition.passthrough_rules) {
            errors.push(`Node "${classType}": Router type requires "passthrough_rules" field`);
          }
        }

        if (definition.type === 'provider') {
          if (!definition.value_path && !definition.value_paths) {
            errors.push(`Node "${classType}": Provider type requires either "value_path" or "value_paths" field`);
          }
        }

        if (definition.type === 'sampler') {
          if (!definition.port_mapping) {
            errors.push(`Node "${classType}": Sampler type requires "port_mapping" field`);
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    }

    /**
     * Save dictionary to local cache
     */
    saveToCache() {
      try {
        const cacheKey = 'comfyui_node_dictionary_cache';
        const cacheData = {
          version: this.version,
          nodes: this.nodes,
          cachedAt: new Date().toISOString()
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (error) {
        console.error('Failed to save dictionary to cache:', error);
      }
    }

    /**
     * Load dictionary from local cache
     * @returns {NodeDefinitionDictionary|null} Cached dictionary or null
     */
    static loadFromCache() {
      try {
        const cacheKey = 'comfyui_node_dictionary_cache';
        const cached = localStorage.getItem(cacheKey);
        if (!cached) {
          return null;
        }

        const cacheData = JSON.parse(cached);
        return new NodeDefinitionDictionary({
          version: cacheData.version,
          nodes: cacheData.nodes
        });
      } catch (error) {
        console.error('Failed to load dictionary from cache:', error);
        return null;
      }
    }

    /**
     * Fetch dictionary from a remote URL
     * @param {string} url - The URL to fetch from
     * @returns {Promise<NodeDefinitionDictionary>} The fetched dictionary
     */
    static async fetchFromURL(url) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const dictionary = new NodeDefinitionDictionary(data);
        
        // Validate the fetched dictionary
        const validation = dictionary.validate();
        if (!validation.valid) {
          console.error('Invalid dictionary from URL:', validation.errors);
          throw new Error('Invalid dictionary structure');
        }

        // Save to cache on successful fetch
        dictionary.saveToCache();
        return dictionary;
      } catch (error) {
        console.error('Failed to fetch dictionary from URL:', error);
        
        // Try to load from cache
        const cached = NodeDefinitionDictionary.loadFromCache();
        if (cached) {
          console.log('Using cached dictionary');
          return cached;
        }

        // Fall back to default dictionary
        console.log('Using default dictionary');
        return NodeDefinitionDictionary.getDefault();
      }
    }

    /**
     * Get the default bundled dictionary
     * @returns {NodeDefinitionDictionary} The default dictionary
     */
    static getDefault() {
      const defaultData = {
        "version": "1.0.0",
        "nodes": {
          "RandomNoise": {
            "type": "provider",
            "value_path": ["inputs", "noise_seed"],
            "metadata_type": "seed"
          },
          "BasicScheduler": {
            "type": "provider",
            "value_paths": {
              "steps": ["inputs", "steps"],
              "scheduler": ["inputs", "scheduler"]
            }
          },
          "KSamplerSelect": {
            "type": "provider",
            "value_path": ["inputs", "sampler_name"],
            "metadata_type": "sampler"
          },
          "FluxGuidance": {
            "type": "provider",
            "value_path": ["inputs", "guidance"],
            "metadata_type": "cfg"
          },
          "CLIPTextEncode": {
            "type": "provider",
            "value_path": ["inputs", "text"],
            "metadata_type": "positive"
          },
          "SamplerCustomAdvanced": {
            "type": "sampler",
            "port_mapping": {
              "seed": ["noise", "noise_seed"],
              "steps": ["sigmas", "steps"],
              "cfg": ["guider", "guidance"],
              "sampler": ["sampler", "sampler_name"],
              "scheduler": ["sigmas", "scheduler"],
              "positive": ["guider", "conditioning", "text"],
              "negative": []
            }
          },
          "AnySwitch": {
            "type": "router",
            "passthrough_rules": {
              "output": ["input1", "input2", "input3", "input4", "input5"]
            }
          },
          "Switch": {
            "type": "router",
            "passthrough_rules": {
              "output": ["input_true", "input_false"]
            }
          }
        }
      };
      
      return new NodeDefinitionDictionary(defaultData);
    }
  }

  // Export for browser environment
  if (typeof window !== 'undefined') {
    window.NodeDefinitionDictionary = NodeDefinitionDictionary;
  }

  // Export for Node.js environment (testing)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = NodeDefinitionDictionary;
  }
})();
