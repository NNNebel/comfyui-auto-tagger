/**
 * ComfyUISamplerAnalyzer.js - Analyzes samplers in ComfyUI workflows
 * Universal module (Browser + Node.js)
 */
(function(global) {
  'use strict';

  // Get dependencies for both environments
  var ComfyUIGraph, ParsingUtils;
  
  if (typeof window !== 'undefined') {
    // Browser environment
    ComfyUIGraph = window.ComfyUIGraph;
    ParsingUtils = window.ParsingUtils;
  } else if (typeof require !== 'undefined') {
    // Node.js environment (testing)
    ComfyUIGraph = require('./ComfyUIGraph');
    ParsingUtils = require('../utils/ParsingUtils');
  } else {
    throw new Error('Required dependencies not found');
  }

/**
 * ComfyUISamplerAnalyzer - Analyzes samplers in a ComfyUI workflow
 * 
 * This class implements a clear, documented algorithm for finding the base sampler
 * and extracting metadata from all samplers in a workflow.
 * 
 * @example
 * const graph = new ComfyUIGraph(promptData);
 * const analyzer = new ComfyUISamplerAnalyzer(graph);
 * const { baseSampler, allSamplers } = analyzer.findBaseSampler();
 * const metadata = analyzer.extractSamplerMetadata(baseSampler, true);
 */
class ComfyUISamplerAnalyzer {
  /**
   * Create a new ComfyUISamplerAnalyzer
   * @param {ComfyUIGraph} graph - ComfyUI workflow graph
   */
  constructor(graph) {
    if (!graph || typeof graph.getNodesByType !== 'function') {
      throw new Error('ComfyUISamplerAnalyzer requires a valid ComfyUIGraph instance');
    }
    
    /**
     * The workflow graph to analyze
     * @type {ComfyUIGraph}
     */
    this.graph = graph;
  }
  
  /**
   * Find the base sampler using a clear, documented algorithm
   * 
   * Algorithm:
   * 1. Find all sampler nodes
   * 2. Find all output nodes (SaveImage, PreviewImage, etc.)
   * 3. For each output node, trace back to find reachable samplers
   * 4. Calculate distance from each sampler to its latent source
   * 5. Select sampler with minimum distance (closest to source)
   * 6. If tie, select by smallest node ID
   * 
   * Fallback: If no output nodes exist OR no samplers reachable from output nodes,
   * use all samplers (this handles incomplete workflows or workflows with
   * disconnected nodes)
   * 
   * @returns {{baseSampler: string|null, allSamplers: Array<{id: string, distance: number}>, isFallback: boolean}}
   * 
   * @example
   * const result = analyzer.findBaseSampler();
   * // Returns: {
   * //   baseSampler: '5',
   * //   allSamplers: [{ id: '5', distance: 0 }, { id: '8', distance: 2 }],
   * //   isFallback: false
   * // }
   */
  findBaseSampler() {
    // Step 1: Get all samplers
    const samplerIds = this.graph.getNodesByType('sampler');
    if (samplerIds.length === 0) {
      return { baseSampler: null, allSamplers: [], isFallback: false };
    }
    
    // Step 2: Get output nodes (SaveImage, PreviewImage, etc.)
    const outputNodeIds = this.graph.getOutputNodes();
    
    // Step 3: Find samplers reachable from output nodes
    let reachableSamplers = new Set();
    if (outputNodeIds.length > 0) {
      for (const outputId of outputNodeIds) {
        const samplers = this.graph.traceToType(outputId, 'sampler');
        samplers.forEach(s => reachableSamplers.add(s.id));
      }
    }
    
    // Fallback: If no output nodes OR no samplers reachable from output nodes
    const isFallback = outputNodeIds.length === 0 || reachableSamplers.size === 0;
    if (isFallback) {
      reachableSamplers = new Set(samplerIds);
    }
    
    // Step 4: Calculate distance to latent source for each sampler
    const scored = Array.from(reachableSamplers).map(id => ({
      id,
      distance: this._calculateDistanceToSource(id)
    }));
    
    // Step 5: Sort by distance, then by ID
    scored.sort((a, b) => {
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      return parseInt(a.id) - parseInt(b.id);
    });
    
    return {
      baseSampler: scored[0]?.id || null,
      allSamplers: scored,
      isFallback
    };
  }
  
  /**
   * Calculate distance from sampler to its latent source
   * Returns Infinity if no valid path found
   * @private
   * @param {string} samplerId - Sampler node ID
   * @returns {number} Distance to latent source (0 = is a source, Infinity = no path)
   */
  _calculateDistanceToSource(samplerId) {
    const visited = new Set();
    const queue = [[samplerId, 0]]; // [nodeId, distance]
    
    while (queue.length > 0) {
      const [currentId, distance] = queue.shift();
      
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      
      const node = this.graph.getNode(currentId);
      if (!node) continue;
      
      // Check if this is a latent source
      if (this._isLatentSource(currentId)) {
        return distance;
      }
      
      // Trace through latent_image input
      const latentInput = node.inputs?.latent_image || node.inputs?.samples;
      if (Array.isArray(latentInput) && latentInput.length === 2) {
        const parentId = String(latentInput[0]);
        queue.push([parentId, distance + 1]);
      }
    }
    
    return Infinity;
  }
  
  /**
   * Check if node is a latent source (EmptyLatentImage, VAEEncode, etc.)
   * @private
   * @param {string} nodeId - Node ID to check
   * @returns {boolean} True if node is a latent source
   */
  _isLatentSource(nodeId) {
    const node = this.graph.getNode(nodeId);
    if (!node) return false;
    
    const classType = node.class_type || '';
    
    // EmptyLatentImage is a true source
    if (classType.includes('EmptyLatent')) {
      return true;
    }
    
    // VAEEncode is an img2img source
    if (classType.includes('VAEEncode')) {
      return true;
    }
    
    // Node with no latent input is a source
    const hasLatentInput = 
      node.inputs?.latent_image !== undefined ||
      node.inputs?.samples !== undefined;
    
    return !hasLatentInput;
  }
  
  /**
   * Extract metadata from a specific sampler node
   * @param {string} samplerId - Sampler node ID
   * @param {boolean} [isBase=false] - Whether this is the base sampler
   * @returns {Object|null} Sampler metadata or null if node not found
   * 
   * @example
   * const metadata = analyzer.extractSamplerMetadata('5', true);
   * // Returns: {
   * //   nodeId: '5',
   * //   nodeType: 'KSampler',
   * //   isBase: true,
   * //   seed: 123456,
   * //   steps: 20,
   * //   cfg: 7.0,
   * //   sampler: 'euler',
   * //   scheduler: 'normal',
   * //   positive: 'a beautiful landscape',
   * //   negative: 'ugly, bad quality',
   * //   checkpoint: 'model.safetensors'
   * // }
   */
  extractSamplerMetadata(samplerId, isBase = false) {
    const node = this.graph.getNode(samplerId);
    if (!node) return null;
    
    const classType = node.class_type || '';
    
    // Handle SamplerCustomAdvanced and similar advanced samplers
    if (classType.includes('SamplerCustomAdvanced') || classType.includes('SamplerCustom')) {
      return this._extractAdvancedSamplerMetadata(samplerId, isBase);
    }
    
    // Standard KSampler handling
    // Get raw prompt values (check if inputs exist)
    const positiveRaw = node.inputs ? this.graph.resolveInput(samplerId, 'positive') : null;
    const negativeRaw = node.inputs ? this.graph.resolveInput(samplerId, 'negative') : null;
    
    // Convert to string and trim, or empty string if not present
    const positive = typeof positiveRaw === 'string' ? positiveRaw.trim() : '';
    const negative = typeof negativeRaw === 'string' ? negativeRaw.trim() : '';
    
    // Get other values
    const seed = node.inputs ? this.graph.resolveInput(samplerId, 'seed') : null;
    const steps = node.inputs ? this.graph.resolveInput(samplerId, 'steps') : null;
    const cfg = node.inputs ? this.graph.resolveInput(samplerId, 'cfg') : null;
    const sampler = node.inputs ? this.graph.resolveInput(samplerId, 'sampler_name') : null;
    const scheduler = node.inputs ? this.graph.resolveInput(samplerId, 'scheduler') : null;
    
    return {
      nodeId: samplerId,
      nodeName: node.class_type || 'Unknown',
      nodeType: node.class_type,
      isBase,
      // Convert null to undefined only for optional fields (sampler, scheduler)
      // Keep null for numeric fields (seed, steps, cfg) as they might be 0
      seed: seed,
      steps: steps,
      cfg: cfg,
      sampler: sampler !== null ? sampler : undefined,
      scheduler: scheduler !== null ? scheduler : undefined,
      positive,
      negative,
      checkpoint: this._findCheckpoint(samplerId)
    };
  }
  
  /**
   * Extract metadata from advanced sampler nodes (SamplerCustomAdvanced, etc.)
   * These samplers use a modular approach with separate nodes for noise, scheduler, etc.
   * @private
   * @param {string} samplerId - Sampler node ID
   * @param {boolean} isBase - Whether this is the base sampler
   * @returns {Object} Sampler metadata
   */
  _extractAdvancedSamplerMetadata(samplerId, isBase) {
    const node = this.graph.getNode(samplerId);
    if (!node) return null;
    
    // Trace to connected nodes to extract parameters
    let seed = null;
    let steps = null;
    let cfg = null;
    let sampler = null;
    let scheduler = null;
    let positive = '';
    let negative = '';
    
    // Extract seed from RandomNoise node
    if (node.inputs?.noise) {
      const noiseNodeId = Array.isArray(node.inputs.noise) ? String(node.inputs.noise[0]) : null;
      if (noiseNodeId) {
        const noiseNode = this.graph.getNode(noiseNodeId);
        if (noiseNode && noiseNode.class_type === 'RandomNoise') {
          seed = this.graph.resolveInput(noiseNodeId, 'noise_seed');
        }
      }
    }
    
    // Extract steps and scheduler from BasicScheduler or similar nodes
    if (node.inputs?.sigmas) {
      const sigmasNodeId = Array.isArray(node.inputs.sigmas) ? String(node.inputs.sigmas[0]) : null;
      if (sigmasNodeId) {
        const sigmasNode = this.graph.getNode(sigmasNodeId);
        if (sigmasNode && (sigmasNode.class_type === 'BasicScheduler' || sigmasNode.class_type.includes('Scheduler'))) {
          steps = this.graph.resolveInput(sigmasNodeId, 'steps');
          scheduler = this.graph.resolveInput(sigmasNodeId, 'scheduler');
        }
      }
    }
    
    // Extract sampler_name from KSamplerSelect node
    if (node.inputs?.sampler) {
      const samplerNodeId = Array.isArray(node.inputs.sampler) ? String(node.inputs.sampler[0]) : null;
      if (samplerNodeId) {
        const samplerNode = this.graph.getNode(samplerNodeId);
        if (samplerNode && samplerNode.class_type === 'KSamplerSelect') {
          sampler = this.graph.resolveInput(samplerNodeId, 'sampler_name');
        }
      }
    }
    
    // Extract cfg from FluxGuidance or BasicGuider
    if (node.inputs?.guider) {
      const guiderNodeId = Array.isArray(node.inputs.guider) ? String(node.inputs.guider[0]) : null;
      if (guiderNodeId) {
        const guiderNode = this.graph.getNode(guiderNodeId);
        
        // Check for FluxGuidance connected to BasicGuider
        if (guiderNode && guiderNode.class_type === 'BasicGuider' && guiderNode.inputs?.conditioning) {
          const condNodeId = Array.isArray(guiderNode.inputs.conditioning) ? String(guiderNode.inputs.conditioning[0]) : null;
          if (condNodeId) {
            const condNode = this.graph.getNode(condNodeId);
            if (condNode && condNode.class_type === 'FluxGuidance') {
              cfg = this.graph.resolveInput(condNodeId, 'guidance');
              
              // Extract positive prompt from FluxGuidance's conditioning input
              if (condNode.inputs?.conditioning) {
                const textNodeId = Array.isArray(condNode.inputs.conditioning) ? String(condNode.inputs.conditioning[0]) : null;
                if (textNodeId) {
                  const textRaw = this.graph.resolveInput(textNodeId, 'text');
                  if (typeof textRaw === 'string') {
                    positive = textRaw.trim();
                  }
                }
              }
            }
          }
        }
        
        // Also check for direct CFG in guider (some custom nodes)
        if (!cfg && guiderNode) {
          cfg = this.graph.resolveInput(guiderNodeId, 'cfg') || this.graph.resolveInput(guiderNodeId, 'guidance');
        }
      }
    }
    
    // If no positive prompt found yet, try to find CLIPTextEncode nodes
    if (!positive) {
      const textNodes = this.graph.getNodesByType('conditioning');
      for (const textNodeId of textNodes) {
        const textNode = this.graph.getNode(textNodeId);
        if (textNode && textNode.class_type && textNode.class_type.includes('CLIPTextEncode')) {
          const textRaw = this.graph.resolveInput(textNodeId, 'text');
          if (typeof textRaw === 'string') {
            positive = textRaw.trim();
            break;
          }
        }
      }
    }
    
    return {
      nodeId: samplerId,
      nodeName: node.class_type || 'Unknown',
      nodeType: node.class_type,
      isBase,
      seed: seed,
      steps: steps,
      cfg: cfg,
      sampler: sampler !== null ? sampler : undefined,
      scheduler: scheduler !== null ? scheduler : undefined,
      positive,
      negative,
      checkpoint: this._findCheckpoint(samplerId)
    };
  }
  
  /**
   * Find checkpoint used by a sampler
   * @private
   * @param {string} samplerId - Sampler node ID
   * @returns {string|null} Checkpoint filename or null if not found
   */
  _findCheckpoint(samplerId) {
    const loaders = this.graph.traceToType(samplerId, 'checkpoint_loader');
    if (loaders.length === 0) {
      // Fallback: Try to find UNETLoader for Flux workflows
      return this._findUNETLoader(samplerId);
    }
    
    // Use closest checkpoint loader (minimum depth)
    const closest = loaders.sort((a, b) => a.depth - b.depth)[0];
    const ckptPath = this.graph.resolveInput(closest.id, 'ckpt_name');
    
    if (!ckptPath || typeof ckptPath !== 'string') return null;
    
    // Extract filename from path
    return ParsingUtils.extractFilename(ckptPath);
  }
  
  /**
   * Find UNET model used by a sampler (for Flux workflows)
   * @private
   * @param {string} samplerId - Sampler node ID
   * @returns {string|null} UNET model filename or null if not found
   */
  _findUNETLoader(samplerId) {
    // Trace through model connections to find UNETLoader
    const visited = new Set();
    const queue = [samplerId];
    
    while (queue.length > 0) {
      const currentId = queue.shift();
      if (visited.has(currentId)) continue;
      visited.add(currentId);
      
      const node = this.graph.getNode(currentId);
      if (!node) continue;
      
      // Check if this is a UNETLoader
      if (node.class_type === 'UNETLoader') {
        const unetPath = this.graph.resolveInput(currentId, 'unet_name');
        if (unetPath && typeof unetPath === 'string') {
          return ParsingUtils.extractFilename(unetPath);
        }
      }
      
      // Trace through model input
      if (node.inputs?.model && Array.isArray(node.inputs.model)) {
        queue.push(String(node.inputs.model[0]));
      }
      
      // For advanced samplers, trace through guider -> model
      if (node.inputs?.guider && Array.isArray(node.inputs.guider)) {
        queue.push(String(node.inputs.guider[0]));
      }
      
      // For schedulers, trace through model
      if (node.inputs?.sigmas && Array.isArray(node.inputs.sigmas)) {
        const sigmasNodeId = String(node.inputs.sigmas[0]);
        const sigmasNode = this.graph.getNode(sigmasNodeId);
        if (sigmasNode?.inputs?.model && Array.isArray(sigmasNode.inputs.model)) {
          queue.push(String(sigmasNode.inputs.model[0]));
        }
      }
    }
    
    return null;
  }
  
  /**
   * Extract metadata from all samplers in the workflow
   * @returns {Array<Object>} Array of sampler metadata objects
   * 
   * @example
   * const allMetadata = analyzer.extractAllSamplersMetadata();
   * // Returns: [
   * //   { nodeId: '5', isBase: true, seed: 123, stepIndex: 1, ... },
   * //   { nodeId: '8', isBase: false, seed: 456, stepIndex: 2, ... }
   * // ]
   */
  extractAllSamplersMetadata() {
    const { baseSampler, allSamplers } = this.findBaseSampler();
    
    return allSamplers.map((sampler, index) => {
      const metadata = this.extractSamplerMetadata(sampler.id, sampler.id === baseSampler);
      return {
        ...metadata,
        distance: sampler.distance,
        stepIndex: index + 1
      };
    });
  }
}

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.ComfyUISamplerAnalyzer = ComfyUISamplerAnalyzer;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ComfyUISamplerAnalyzer;
  }

})(typeof window !== 'undefined' ? window : global);
