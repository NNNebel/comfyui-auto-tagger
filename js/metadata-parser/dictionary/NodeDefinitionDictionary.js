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

        const validTypes = ['sampler', 'router', 'provider', 'checkpoint_loader', 'lora_loader', 'image_processor', 'vae'];
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

        if (definition.type === 'checkpoint_loader' || definition.type === 'lora_loader') {
          // input_key is optional; if not provided, it will be inferred from context
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
      // Node.js / Electron (Eagle plugin) environment: load from JSON file
      if (typeof require !== 'undefined') {
        try {
          const path = require('path');
          const fs = require('fs');

          // Try primary location: relative to this file
          let jsonPath = path.join(__dirname, 'default-dictionary.json');

          // Try fallback: from plugin path if available (Eagle environment)
          if (typeof window !== 'undefined' && window.pluginPath) {
            const fallbackPath = path.join(window.pluginPath, 'js', 'metadata-parser', 'dictionary', 'default-dictionary.json');
            if (fs.existsSync(fallbackPath)) {
              jsonPath = fallbackPath;
            }
          }

          const defaultData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          return new NodeDefinitionDictionary(defaultData);
        } catch (e) {
          console.warn('Failed to load default-dictionary.json, using empty dictionary:', e);
        }
      }
      return new NodeDefinitionDictionary({ version: '1.0.0', nodes: {} });
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
