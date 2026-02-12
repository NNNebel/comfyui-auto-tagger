/**
 * ComfyUIGraph.js - Graph representation of ComfyUI workflows
 * Universal module (Browser + Node.js)
 */
(function(global) {
  'use strict';

  // Get dependencies for both environments
  var GraphConstructionError, ErrorHandler;
  
  if (typeof window !== 'undefined') {
    // Browser environment
    GraphConstructionError = window.GraphConstructionError;
    ErrorHandler = window.ErrorHandler;
  } else if (typeof require !== 'undefined') {
    // Node.js environment (testing)
    const { GraphConstructionError: GCE } = require('../errors/ParseError');
    GraphConstructionError = GCE;
    ErrorHandler = require('../utils/ErrorHandler').ErrorHandler;
  }

/**
 * ComfyUIGraph - Represents a ComfyUI workflow as a directed graph
 * 
 * This class provides an explicit graph data structure for ComfyUI workflows,
 * separating graph construction from analysis. It enables efficient traversal
 * and querying of workflow structure.
 * 
 * @example
 * const graph = new ComfyUIGraph(promptData);
 * const samplers = graph.getNodesByType('sampler');
 * const sinks = graph.getSinkNodes();
 * const value = graph.resolveInput('5', 'seed');
 */
class ComfyUIGraph {
  /**
   * Create a new ComfyUIGraph from prompt data
   * @param {Object} promptData - ComfyUI prompt JSON object (nodeId -> node data)
   */
  constructor(promptData) {
    /**
     * Map of node IDs to node data
     * @type {Map<string, Object>}
     */
    this.nodes = new Map();
    
    /**
     * Map of node IDs to their parent node IDs (forward edges)
     * @type {Map<string, Set<string>>}
     */
    this.edges = new Map();
    
    /**
     * Map of node IDs to their child node IDs (reverse edges)
     * @type {Map<string, Set<string>>}
     */
    this.reverseEdges = new Map();
    
    /**
     * Map of node IDs to their classified types
     * @type {Map<string, string>}
     */
    this.nodeTypes = new Map();
    
    /**
     * Set of missing node IDs that were referenced but not found
     * @type {Set<string>}
     */
    this.missingNodes = new Set();
    
    this._build(promptData);
  }
  
  /**
   * Build graph structure from prompt data
   * Time complexity: O(N + E) where N = nodes, E = edges
   * @private
   * @param {Object} promptData - ComfyUI prompt JSON object
   * @throws {GraphConstructionError} When prompt data is invalid or malformed
   */
  _build(promptData) {
    // Validate prompt data
    if (!promptData || typeof promptData !== 'object') {
      throw new GraphConstructionError(
        'Invalid prompt data: must be an object',
        { promptData: typeof promptData },
        ['Ensure the prompt field contains valid JSON object']
      );
    }
    
    // Step 1: Add all nodes
    for (const [id, node] of Object.entries(promptData)) {
      if (!node || typeof node !== 'object') {
        throw new GraphConstructionError(
          `Invalid node data for node ${id}`,
          { nodeId: id, nodeType: typeof node },
          ['Check that all nodes in the prompt are valid objects']
        );
      }
      this.nodes.set(String(id), node);
    }
    
    // Step 2: Build edges by analyzing inputs
    for (const [id, node] of this.nodes) {
      const parents = new Set();
      
      if (node.inputs) {
        for (const [key, value] of Object.entries(node.inputs)) {
          // Check if value is a link [sourceNodeId, outputSlot]
          if (Array.isArray(value) && value.length === 2) {
            const parentId = String(value[0]);
            
            // Check if parent node exists
            if (!this.nodes.has(parentId)) {
              // Record missing node
              this.missingNodes.add(parentId);
              
              // Log warning about missing node
              const parentNode = this.nodes.get(id);
              ErrorHandler.logWarning('ComfyUIGraph', 'Referenced node not found in workflow', {
                nodeId: id,
                nodeType: parentNode?.class_type || 'Unknown',
                inputKey: key,
                missingNodeId: parentId,
                suggestion: 'This may be a custom node not saved in the workflow, or the workflow may be incomplete. Some metadata (like prompts or parameters) may not be extracted correctly.'
              });
              
              continue;
            }
            
            parents.add(parentId);
            
            // Build reverse edges (parent -> children)
            if (!this.reverseEdges.has(parentId)) {
              this.reverseEdges.set(parentId, new Set());
            }
            this.reverseEdges.get(parentId).add(id);
          }
        }
      }
      
      this.edges.set(id, parents);
    }
    
    // Step 3: Classify nodes by type
    this._classifyNodes();
  }
  
  /**
   * Classify all nodes into categories for easier analysis
   * @private
   */
  _classifyNodes() {
    for (const [id, node] of this.nodes) {
      const type = this._getNodeType(node);
      this.nodeTypes.set(id, type);
    }
  }
  
  /**
   * Determine node type based on class_type and inputs
   * @private
   * @param {Object} node - Node data
   * @returns {string} Node type classification
   */
  _getNodeType(node) {
    const classType = node.class_type || '';
    
    // Sampler nodes (highest priority)
    if (this._isSamplerNode(node)) {
      return 'sampler';
    }
    
    // Loader nodes
    if (classType.includes('Loader')) {
      if (classType.includes('Checkpoint')) return 'checkpoint_loader';
      if (classType.toLowerCase().includes('lora')) return 'lora_loader';
      if (classType.includes('VAE')) return 'vae_loader';
      return 'loader';
    }
    
    // Output nodes
    if (classType.includes('Save') || classType.includes('Preview') || classType.includes('Output')) {
      return 'output';
    }
    
    // Conditioning nodes
    if (classType.includes('CLIP') || classType.includes('Conditioning')) {
      return 'conditioning';
    }
    
    // VAE nodes
    if (classType.includes('VAE')) {
      return 'vae';
    }
    
    return 'other';
  }
  
  /**
   * Check if node is a sampler node
   * @private
   * @param {Object} node - Node data
   * @returns {boolean} True if node is a sampler
   */
  _isSamplerNode(node) {
    if (!node.inputs) return false;
    
    // Traditional sampler: has seed, steps, cfg, positive, negative
    const samplerParams = ['seed', 'steps', 'cfg', 'positive', 'negative'];
    const hasSamplerParams = samplerParams.filter(key => node.inputs[key] !== undefined).length >= 3;
    
    // Advanced sampler: has sampler, sigmas, latent_image
    const hasAdvancedParams = 
      node.inputs.sampler !== undefined &&
      node.inputs.sigmas !== undefined &&
      node.inputs.latent_image !== undefined;
    
    return hasSamplerParams || hasAdvancedParams;
  }
  
  /**
   * Find all nodes of a specific type
   * @param {string} type - Node type to search for
   * @returns {Array<string>} Array of node IDs matching the type
   * 
   * @example
   * const samplers = graph.getNodesByType('sampler');
   * const loaders = graph.getNodesByType('checkpoint_loader');
   */
  getNodesByType(type) {
    const result = [];
    for (const [id, nodeType] of this.nodeTypes) {
      if (nodeType === type) {
        result.push(id);
      }
    }
    return result;
  }
  
  /**
   * Find sink nodes (nodes with no children)
   * @returns {Array<string>} Array of sink node IDs
   * 
   * @example
   * const sinks = graph.getSinkNodes();
   * // Returns: ['10', '15', '20'] (all nodes with no children)
   */
  getSinkNodes() {
    const sinks = [];
    for (const id of this.nodes.keys()) {
      const children = this.reverseEdges.get(id);
      if (!children || children.size === 0) {
        sinks.push(id);
      }
    }
    return sinks;
  }
  
  /**
   * Find output nodes (SaveImage, PreviewImage, etc.)
   * These are the nodes that produce final output for the user
   * @returns {Array<string>} Array of output node IDs
   * 
   * @example
   * const outputs = graph.getOutputNodes();
   * // Returns: ['10', '15'] (only SaveImage, PreviewImage, etc.)
   */
  getOutputNodes() {
    return this.getNodesByType('output');
  }
  
  /**
   * Trace back from a node to find all ancestors of a specific type
   * Uses BFS to find shortest paths
   * @param {string} startId - Starting node ID
   * @param {string} targetType - Target node type to find
   * @param {number} [maxDepth=Infinity] - Maximum depth to search
   * @returns {Array<{id: string, depth: number}>} Array of matching nodes with their depths
   * 
   * @example
   * // Find all samplers reachable from output node '10'
   * const samplers = graph.traceToType('10', 'sampler');
   * // Returns: [{ id: '5', depth: 2 }, { id: '8', depth: 3 }]
   */
  traceToType(startId, targetType, maxDepth = Infinity) {
    const queue = [[startId, 0]]; // [nodeId, depth]
    const visited = new Set();
    const results = [];
    
    while (queue.length > 0) {
      const [currentId, depth] = queue.shift();
      
      if (visited.has(currentId) || depth > maxDepth) {
        continue;
      }
      visited.add(currentId);
      
      // Check if this node matches target type
      if (this.nodeTypes.get(currentId) === targetType) {
        results.push({ id: currentId, depth });
      }
      
      // Add parents to queue
      const parents = this.edges.get(currentId);
      if (parents) {
        for (const parentId of parents) {
          if (!visited.has(parentId)) {
            queue.push([parentId, depth + 1]);
          }
        }
      }
    }
    
    return results;
  }
  
  /**
   * Get input value, resolving links recursively
   * @param {string} nodeId - Node ID to get input from
   * @param {string} inputKey - Input key to resolve
   * @param {Set<string>} [visited=new Set()] - Set of visited nodes (for cycle detection)
   * @returns {*} Resolved input value, or null if not found
   * 
   * @example
   * // Get seed value from node '5'
   * const seed = graph.resolveInput('5', 'seed');
   * // Returns: 123456 (follows links to find actual value)
   * 
   * // Get positive prompt from sampler
   * const prompt = graph.resolveInput('5', 'positive');
   * // Returns: "a beautiful landscape" (resolves through CLIP nodes)
   */
  resolveInput(nodeId, inputKey, visited = new Set()) {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);
    
    const node = this.nodes.get(nodeId);
    if (!node || !node.inputs) return null;
    
    const value = node.inputs[inputKey];
    
    // Input key not found
    if (value === undefined) return null;
    
    // Direct value (not a link)
    if (!Array.isArray(value)) {
      return value;
    }
    
    // Link to parent node [parentId, outputSlot]
    if (value.length === 2) {
      const parentId = String(value[0]);
      const parentNode = this.nodes.get(parentId);
      if (!parentNode) return null;
      
      // Strategy 1: Try same key first (passthrough pattern)
      if (parentNode.inputs && parentNode.inputs[inputKey] !== undefined) {
        return this.resolveInput(parentId, inputKey, new Set(visited));
      }
      
      // Strategy 2: Try common value keys (Primitive nodes, etc.)
      const commonKeys = [
        'value', 'int', 'float', 'text', 'string',
        'text_g', 'text_l', // FLUX conditioning
        'seed', 'steps', 'cfg', 'sampler_name', 'scheduler'
      ];
      
      for (const key of commonKeys) {
        if (parentNode.inputs && parentNode.inputs[key] !== undefined) {
          return this.resolveInput(parentId, key, new Set(visited));
        }
      }
    }
    
    return null;
  }
  
  /**
   * Get node data by ID
   * @param {string} nodeId - Node ID
   * @returns {Object|null} Node data or null if not found
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId) || null;
  }
  
  /**
   * Get parent node IDs for a given node
   * @param {string} nodeId - Node ID
   * @returns {Set<string>} Set of parent node IDs
   */
  getParents(nodeId) {
    return this.edges.get(nodeId) || new Set();
  }
  
  /**
   * Get child node IDs for a given node
   * @param {string} nodeId - Node ID
   * @returns {Set<string>} Set of child node IDs
   */
  getChildren(nodeId) {
    return this.reverseEdges.get(nodeId) || new Set();
  }
  
  /**
   * Get node type classification
   * @param {string} nodeId - Node ID
   * @returns {string|null} Node type or null if not found
   */
  getNodeType(nodeId) {
    return this.nodeTypes.get(nodeId) || null;
  }
  
  /**
   * Get total number of nodes in the graph
   * @returns {number} Number of nodes
   */
  getNodeCount() {
    return this.nodes.size;
  }
  
  /**
   * Check if a node exists in the graph
   * @param {string} nodeId - Node ID to check
   * @returns {boolean} True if node exists
   */
  hasNode(nodeId) {
    return this.nodes.has(nodeId);
  }
  
  /**
   * Get set of missing node IDs that were referenced but not found
   * @returns {Set<string>} Set of missing node IDs
   */
  getMissingNodes() {
    return new Set(this.missingNodes);
  }
  
  /**
   * Check if there are any missing nodes in the workflow
   * @returns {boolean} True if there are missing nodes
   */
  hasMissingNodes() {
    return this.missingNodes.size > 0;
  }
  /**
   * Get topological sort order of nodes (execution order)
   * Uses Kahn's algorithm for topological sorting
   * @returns {Array<string>} Array of node IDs in execution order
   *
   * @example
   * const executionOrder = graph.getTopologicalOrder();
   * // Returns: ['1', '2', '3', '5', '8', '10'] (nodes in execution order)
   */
  getTopologicalOrder() {
    // Calculate in-degree for each node
    const inDegree = new Map();
    for (const id of this.nodes.keys()) {
      inDegree.set(id, 0);
    }

    for (const [id, parents] of this.edges) {
      inDegree.set(id, parents.size);
    }

    // Queue of nodes with no dependencies
    const queue = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    // Process nodes in topological order
    const result = [];
    while (queue.length > 0) {
      // Sort queue by node ID for deterministic order when multiple nodes have same in-degree
      queue.sort((a, b) => parseInt(a) - parseInt(b));

      const currentId = queue.shift();
      result.push(currentId);

      // Reduce in-degree of children
      const children = this.reverseEdges.get(currentId);
      if (children) {
        for (const childId of children) {
          const newDegree = inDegree.get(childId) - 1;
          inDegree.set(childId, newDegree);

          if (newDegree === 0) {
            queue.push(childId);
          }
        }
      }
    }

    return result;
  }

  /**
   * Get execution order index for a specific node
   * @param {string} nodeId - Node ID
   * @returns {number} Execution order index (0-based), or -1 if not found
   */
  getExecutionOrder(nodeId) {
    if (!this._executionOrder) {
      this._executionOrder = this.getTopologicalOrder();
    }
    return this._executionOrder.indexOf(nodeId);
  }
}

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.ComfyUIGraph = ComfyUIGraph;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ComfyUIGraph;
  }

})(typeof window !== 'undefined' ? window : global);
