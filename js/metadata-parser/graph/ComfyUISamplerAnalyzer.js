/**
 * ComfyUISamplerAnalyzer.js - Analyzes samplers in ComfyUI workflows
 * Universal module (Browser + Node.js)
 */
(function(global) {
  'use strict';

  // Get dependencies for both environments
  var ComfyUIGraph, ParsingUtils, SamplerNotFoundError;
  
  if (typeof window !== 'undefined') {
    // Browser environment
    ComfyUIGraph = window.ComfyUIGraph;
    ParsingUtils = window.ParsingUtils;
    SamplerNotFoundError = window.SamplerNotFoundError;
  } else if (typeof require !== 'undefined') {
    // Node.js environment (testing)
    ComfyUIGraph = require('./ComfyUIGraph');
    ParsingUtils = require('../utils/ParsingUtils');
    const { SamplerNotFoundError: SNFE } = require('../errors/ParseError');
    SamplerNotFoundError = SNFE;
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
   * @throws {Error} When graph is invalid
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
    
    /**
     * Node definition dictionary for custom nodes
     * @type {NodeDefinitionDictionary|null}
     */
    this.dictionary = null;
    
    /**
     * Metadata extraction reporter for trace logs
     * @type {MetadataExtractionReporter|null}
     */
    this.reporter = null;
  }
  
  /**
   * Set the node definition dictionary
   * @param {NodeDefinitionDictionary} dictionary - The dictionary instance
   */
  setDictionary(dictionary) {
    this.dictionary = dictionary;
  }
  
  /**
   * Set the metadata extraction reporter
   * @param {MetadataExtractionReporter} reporter - The reporter instance
   */
  setReporter(reporter) {
    this.reporter = reporter;
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
   * 6. Sort samplers by execution order (topological sort)
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
    // Debug logging helper
    const debugLog = (msg, level = 'info') => {
      if (typeof window !== 'undefined' && window.isDebugMode && window.isDebugMode()) {
        const levelPrefix = '[' + level.toUpperCase() + ']';
        const fullMsg = '[ComfyUISamplerAnalyzer] ' + msg;
        switch(level) {
          case 'error':
            console.error(levelPrefix + ' ' + fullMsg);
            break;
          case 'warn':
            console.warn(levelPrefix + ' ' + fullMsg);
            break;
          default:
            console.log(levelPrefix + ' ' + fullMsg);
        }
      }
    };

    debugLog('=== Starting Base Sampler Search ===');
    
    // Step 1: Get all samplers
    const samplerIds = this.graph.getNodesByType('sampler');
    debugLog('Step 1: Found ' + samplerIds.length + ' sampler nodes: ' + JSON.stringify(samplerIds));
    
    if (samplerIds.length === 0) {
      debugLog('No samplers found in workflow', 'warn');
      return { baseSampler: null, allSamplers: [], isFallback: false };
    }
    
    // Step 2: Get output nodes to trace from.
    //
    // Deterministic mode (eagle_bridge): when forcedOutputNodeIds is set,
    // trace ONLY from those nodes so we stay within the correct pipeline.
    // Heuristic mode: use all nodes classified as 'output' (SaveImage, etc.).
    const forcedIds = this.graph.options && this.graph.options.forcedOutputNodeIds;
    let outputNodeIds;
    if (forcedIds && forcedIds.length > 0) {
      outputNodeIds = forcedIds.map(String).filter(id => this.graph.hasNode(id));
      debugLog('Step 2: Deterministic mode – forced output nodes: ' + JSON.stringify(outputNodeIds));
    } else {
      outputNodeIds = this.graph.getOutputNodes();
      debugLog('Step 2: Heuristic mode – found ' + outputNodeIds.length + ' output nodes: ' + JSON.stringify(outputNodeIds));
    }
    
    // Step 3: Find samplers reachable from output nodes
    let reachableSamplers = new Set();
    let allSuspiciousNodes = [];
    
    if (outputNodeIds.length > 0) {
      debugLog('Step 3: Tracing from output nodes to find reachable samplers');
      for (const outputId of outputNodeIds) {
        debugLog('  Tracing from output node: ' + outputId);
        // Use BFS to find all reachable samplers
        const result = this.graph.traceToType(outputId, 'sampler');
        debugLog('    Found ' + result.nodes.length + ' reachable samplers: ' + JSON.stringify(result.nodes.map(function(n) { return n.id; })));
        result.nodes.forEach(function(s) { reachableSamplers.add(s.id); });
        
        // Collect suspicious nodes
        debugLog('    traceToType result.suspiciousNodes count: ' + (result.suspiciousNodes ? result.suspiciousNodes.length : 0), 'warn');
        if (result.suspiciousNodes && result.suspiciousNodes.length > 0) {
          debugLog('    Found ' + result.suspiciousNodes.length + ' suspicious nodes', 'warn');
          result.suspiciousNodes.forEach(function(node) {
            debugLog('      Suspicious: ' + node.nodeId + ' (' + node.nodeType + ')', 'warn');
          });
          allSuspiciousNodes.push.apply(allSuspiciousNodes, result.suspiciousNodes);
        }
      }
    }
    
    // Deduplicate suspicious nodes by nodeId
    const uniqueSuspiciousNodes = [];
    const seenNodeIds = new Set();
    for (var i = 0; i < allSuspiciousNodes.length; i++) {
      var node = allSuspiciousNodes[i];
      if (!seenNodeIds.has(node.nodeId)) {
        seenNodeIds.add(node.nodeId);
        uniqueSuspiciousNodes.push(node);
      }
    }
    
    if (uniqueSuspiciousNodes.length > 0) {
      debugLog('Total unique suspicious nodes: ' + uniqueSuspiciousNodes.length, 'warn');
    }
    
    // Fallback: If no output nodes OR no samplers reachable from output nodes
    const isFallback = outputNodeIds.length === 0 || reachableSamplers.size === 0;
    if (isFallback) {
      debugLog('Using fallback: including all samplers (no output nodes or no reachable samplers)', 'warn');
      reachableSamplers = new Set(samplerIds);
    } else {
      debugLog('Reachable samplers: ' + reachableSamplers.size + ' of ' + samplerIds.length);
    }
    
    // Filter out samplers with no latent_image connection (Silent_Drop)
    debugLog('Step 4: Filtering valid samplers (checking latent connections, muted/bypassed status)');
    const validSamplers = [];
    var reachableArray = Array.from(reachableSamplers);
    for (var j = 0; j < reachableArray.length; j++) {
      var samplerId = reachableArray[j];
      const node = this.graph.getNode(samplerId);
      if (!node) {
        debugLog('  Sampler ' + samplerId + ': Node not found', 'warn');
        continue;
      }
      
      debugLog('  Checking sampler ' + samplerId + ' (' + node.class_type + ')');
      
      // Check if node is Muted or Bypassed
      if (node.mode === 2 || node.mode === 4) {
        // mode 2 = Muted, mode 4 = Bypassed
        const reason = node.mode === 2 ? 'muted' : 'bypassed';
        debugLog('    EXCLUDED: ' + reason, 'warn');
        if (this.reporter) {
          this.reporter.logNodeExclusion(samplerId, node.class_type, reason);
        }
        continue;
      }
      
      // Check if latent_image input is connected
      const hasLatentInput = this.graph.hasInputPort(samplerId, 'latent_image') || 
                             this.graph.hasInputPort(samplerId, 'latent');
      
      debugLog('    Has latent input port: ' + hasLatentInput);
      
      if (hasLatentInput) {
        const latentConnection = this.graph.getConnectedNodeId(samplerId, 'latent_image') ||
                                 this.graph.getConnectedNodeId(samplerId, 'latent');
        
        debugLog('    Latent connection: ' + (latentConnection || 'none'));
        
        if (!latentConnection) {
          // No connection - exclude this sampler
          debugLog('    EXCLUDED: no latent input connection', 'warn');
          if (this.reporter) {
            this.reporter.logNodeExclusion(samplerId, node.class_type, 'no_latent_input');
          }
          continue;
        }
      }
      
      debugLog('    VALID: included in analysis');
      validSamplers.push(samplerId);
    }
    
    debugLog('Valid samplers after filtering: ' + validSamplers.length + ' of ' + reachableSamplers.size);
    
    // If all samplers were excluded, return empty result
    if (validSamplers.length === 0) {
      debugLog('No valid samplers found after filtering', 'error');
      return { baseSampler: null, allSamplers: [], isFallback: isFallback, suspiciousNodes: uniqueSuspiciousNodes };
    }
    
    // Step 4: Calculate distance to latent source for each valid sampler
    debugLog('Step 5: Calculating distances to latent source');
    const scored = validSamplers.map(function(id) {
      var distance = this._calculateDistanceToSource(id);
      var executionOrder = this.graph.getExecutionOrder(id);
      debugLog('  Sampler ' + id + ': distance=' + distance + ', executionOrder=' + executionOrder);
      return {
        id: id,
        distance: distance,
        executionOrder: executionOrder
      };
    }.bind(this));
    
    // Step 5: Sort by distance, then by execution order (topological sort)
    debugLog('Step 6: Sorting samplers by distance and execution order');
    scored.sort(function(a, b) {
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      // Use topological execution order as tiebreaker
      return a.executionOrder - b.executionOrder;
    });
    
    var baseSampler = scored[0] ? scored[0].id : null;
    debugLog('=== Base Sampler Selection Complete ===');
    debugLog('Selected base sampler: ' + baseSampler);
    debugLog('Total samplers in workflow: ' + scored.length);
    debugLog('Is fallback mode: ' + isFallback);
    if (uniqueSuspiciousNodes.length > 0) {
      debugLog('Suspicious nodes detected: ' + uniqueSuspiciousNodes.length, 'warn');
    }
    
    return {
      baseSampler: baseSampler,
      allSamplers: scored,
      isFallback: isFallback,
      suspiciousNodes: uniqueSuspiciousNodes
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
      
      const classType = node.class_type || '';
      
      // Trace through latent_image input
      const latentInput = node.inputs?.latent_image || node.inputs?.samples;
      if (Array.isArray(latentInput) && latentInput.length === 2) {
        const parentId = String(latentInput[0]);
        const parentNode = this.graph.getNode(parentId);
        
        // If parent is VAEEncode, trace through its image input
        if (parentNode && parentNode.class_type === 'VAEEncode') {
          const imageInput = parentNode.inputs?.pixels || parentNode.inputs?.image;
          if (Array.isArray(imageInput) && imageInput.length === 2) {
            const imageSourceId = String(imageInput[0]);
            queue.push([imageSourceId, distance + 2]); // +2 because we go through VAEEncode
          }
        } else {
          queue.push([parentId, distance + 1]);
        }
      }
      
      // For DetailerForEach nodes, trace through image input
      // The image comes from VAEDecode, which comes from a sampler
      if (classType.includes('DetailerForEach') && node.inputs?.image) {
        const imageInput = node.inputs.image;
        if (Array.isArray(imageInput) && imageInput.length === 2) {
          const imageSourceId = String(imageInput[0]);
          const imageSourceNode = this.graph.getNode(imageSourceId);
          
          // If image comes from VAEDecode, trace through its samples input
          if (imageSourceNode && imageSourceNode.class_type === 'VAEDecode') {
            const samplesInput = imageSourceNode.inputs?.samples;
            if (Array.isArray(samplesInput) && samplesInput.length === 2) {
              const samplerId = String(samplesInput[0]);
              queue.push([samplerId, distance + 1]); // +1 for VAEDecode
            }
          } else {
            // Otherwise, just trace through the image input
            queue.push([imageSourceId, distance + 1]);
          }
        }
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
    
    // DetailerForEach nodes work on images, not latents - they are NOT latent sources
    // They should trace back through their image input chain
    if (classType.includes('DetailerForEach')) {
      return false;
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
    const seed = node.inputs ? this.graph.resolveInput(samplerId, 'seed') : null;
    const steps = node.inputs ? this.graph.resolveInput(samplerId, 'steps') : null;
    const cfg = node.inputs ? this.graph.resolveInput(samplerId, 'cfg') : null;
    const sampler = node.inputs ? this.graph.resolveInput(samplerId, 'sampler_name') : null;
    const scheduler = node.inputs ? this.graph.resolveInput(samplerId, 'scheduler') : null;

    // Use _traceConditioningText for positive/negative so that ConditioningCombine
    // and other conditioning routers are handled correctly (all texts collected & joined).
    const positive = this._traceConditioningText(samplerId, 'positive');
    const negative = this._traceConditioningText(samplerId, 'negative');

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
    
    const metadata = {
      nodeId: samplerId,
      nodeName: node.class_type || 'Unknown',
      nodeType: node.class_type,
      isBase
    };
    
    // Start trace if reporter is available
    if (this.reporter) {
      this.reporter.startTrace(samplerId);
    }
    
    // Extract scalar metadata (seed, steps, cfg, sampler, scheduler)
    const scalarTypes = ['seed', 'steps', 'cfg', 'sampler', 'scheduler'];
    for (const type of scalarTypes) {
      const value = this._traceMetadataValue(samplerId, type, this._getPortPatterns(type));
      if (value !== null && value !== undefined) {
        metadata[type] = value;
      } else {
        metadata[type] = (type === 'sampler' || type === 'scheduler') ? undefined : null;
      }
    }

    // Extract conditioning text (positive, negative) via dedicated method that
    // collects all text across the conditioning subgraph (e.g. ConditioningCombine).
    for (const type of ['positive', 'negative']) {
      metadata[type] = this._traceConditioningText(samplerId, type);
    }
    
    // Find checkpoint
    metadata.checkpoint = this._findCheckpoint(samplerId);
    
    // End trace if reporter is available
    if (this.reporter) {
      this.reporter.endTrace(true, metadata);
    }
    
    return metadata;
  }
  
  /**
   * Find checkpoint used by a sampler
   * @private
   * @param {string} samplerId - Sampler node ID
   * @returns {string|null} Checkpoint filename or null if not found
   */
  _findCheckpoint(samplerId) {
    const result = this.graph.traceToType(samplerId, 'checkpoint_loader');
    if (result.nodes.length === 0) {
      // Fallback: Try to find UNETLoader for Flux workflows
      return this._findUNETLoader(samplerId);
    }

    // Use closest checkpoint loader (minimum depth)
    const closest = result.nodes.sort((a, b) => a.depth - b.depth)[0];

    // Use dictionary input_key when available, fall back to 'ckpt_name'
    let inputKey = 'ckpt_name';
    if (this.dictionary) {
      const node = this.graph.getNode(closest.id);
      if (node && this.dictionary.hasDefinition(node.class_type)) {
        const def = this.dictionary.getNodeDefinition(node.class_type);
        if (def.input_key) inputKey = def.input_key;
      }
    }

    const ckptPath = this.graph.resolveInput(closest.id, inputKey);
    if (!ckptPath || typeof ckptPath !== 'string') return null;

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
  
  /**
   * Get port name patterns for a metadata type
   * @param {string} metadataType - The type of metadata (seed, steps, cfg, etc.)
   * @returns {Array<string>} Array of port name patterns
   * @private
   */
  _getPortPatterns(metadataType) {
    // Scalar metadata port patterns only.
    // positive/negative are handled by _traceConditioningText, not here.
    const patterns = {
      seed:      ['seed', 'noise_seed', 'noise'],
      steps:     ['steps'],
      cfg:       ['cfg', 'guidance'],
      sampler:   ['sampler', 'sampler_name'],
      scheduler: ['scheduler'],
    };
    return patterns[metadataType] || [];
  }
  
  /**
   * Trace metadata value by traversing the graph backwards
   * @param {string} startNodeId - The node to start tracing from
   * @param {string} metadataType - The type of metadata to trace
   * @param {Array<string>} portPatterns - Port name patterns to match
   * @returns {*} The traced metadata value, or null if not found
   * @private
   */
  _traceMetadataValue(startNodeId, metadataType, portPatterns) {
    const visited = new Set();
    const queue = [[startNodeId, 0]]; // [nodeId, depth]
    const maxDepth = 20; // Prevent infinite loops
    
    while (queue.length > 0) {
      const [nodeId, depth] = queue.shift();
      
      if (visited.has(nodeId) || depth > maxDepth) {
        continue;
      }
      visited.add(nodeId);
      
      const node = this.graph.getNode(nodeId);
      if (!node) {
        continue;
      }
      
      // Log node visit
      if (this.reporter) {
        this.reporter.logNodeVisit(nodeId, node.class_type, `trace_${metadataType}`);
      }
      
      // Check dictionary definition first (highest priority)
      if (this.dictionary && this.dictionary.hasDefinition(node.class_type)) {
        const definition = this.dictionary.getNodeDefinition(node.class_type);
        
        if (this.reporter) {
          this.reporter.logDictionaryUsage(nodeId, definition);
        }
        
        const value = this._applyDictionaryDefinition(nodeId, definition, metadataType);
        if (value !== null && value !== undefined) {
          return value;
        }
      }
      
      // Check if this is a router node - if so, pass through
      if (this._isRouterNode(nodeId)) {
        const passthroughPorts = this._passthroughRouter(nodeId, portPatterns);
        for (const port of passthroughPorts) {
          const connectedNodeId = this.graph.getConnectedNodeId(nodeId, port);
          if (connectedNodeId && !visited.has(connectedNodeId)) {
            queue.push([connectedNodeId, depth + 1]);
          }
        }
        continue;
      }
      
      // Apply heuristic search
      if (this.reporter) {
        this.reporter.logHeuristicUsage(nodeId, portPatterns);
      }
      
      const value = this._applyHeuristicSearch(nodeId, metadataType, portPatterns);
      if (value !== null && value !== undefined) {
        return value;
      }
      
      // Continue traversing to parent nodes (scalar metadata only).
      const parents = this.graph.getParents(nodeId);
      for (const parentId of parents) {
        if (!visited.has(parentId)) {
          queue.push([parentId, depth + 1]);
        }
      }
    }
    
    return null;
  }
  
  /**
   * Apply dictionary definition to extract metadata value
   * @param {string} nodeId - The node ID
   * @param {Object} definition - The dictionary definition
   * @param {string} metadataType - The type of metadata to extract
   * @returns {*} The extracted value, or null if not found
   * @private
   */
  _applyDictionaryDefinition(nodeId, definition, metadataType) {
    const node = this.graph.getNode(nodeId);
    if (!node) {
      return null;
    }
    
    // Handle provider type nodes
    if (definition.type === 'provider') {
      // Single value_path for one metadata type
      if (definition.value_path && definition.metadata_type === metadataType) {
        let value = node;
        for (const key of definition.value_path) {
          if (value && typeof value === 'object') {
            value = value[key];
          } else {
            return null;
          }
        }
        return value;
      }
      
      // Multiple value_paths for different metadata types
      if (definition.value_paths && definition.value_paths[metadataType]) {
        let value = node;
        for (const key of definition.value_paths[metadataType]) {
          if (value && typeof value === 'object') {
            value = value[key];
          } else {
            return null;
          }
        }
        return value;
      }
    }
    
    // Handle sampler type nodes
    if (definition.type === 'sampler') {
      const portMapping = definition.port_mapping[metadataType];
      if (!portMapping || portMapping.length === 0) {
        return null;
      }
      
      // Follow the port path to find connected nodes
      for (const portName of portMapping) {
        const connectedNodeId = this.graph.getConnectedNodeId(nodeId, portName);
        if (connectedNodeId) {
          // Recursively trace from the connected node
          return this._traceMetadataValue(connectedNodeId, metadataType, this._getPortPatterns(metadataType));
        }
      }
    }
    
    // Router type nodes are handled separately in _traceMetadataValue
    
    return null;
  }
  
  /**
   * Apply heuristic search to extract metadata value
   * @param {string} nodeId - The node ID
   * @param {string} metadataType - The type of metadata to extract
   * @param {Array<string>} portPatterns - Port name patterns to match
   * @returns {*} The extracted value, or null if not found
   * @private
   */
  _applyHeuristicSearch(nodeId, metadataType, portPatterns) {
    const node = this.graph.getNode(nodeId);
    if (!node || !node.inputs) {
      return null;
    }
    
    // Check if node has a direct value in inputs matching the patterns
    for (const pattern of portPatterns) {
      if (pattern in node.inputs) {
        const value = node.inputs[pattern];
        
        // If it's a connection [nodeId, outputIndex], continue tracing
        if (Array.isArray(value) && value.length >= 2) {
          const connectedNodeId = String(value[0]);
          return this._traceMetadataValue(connectedNodeId, metadataType, portPatterns);
        }
        
        // If it's a direct value, return it
        if (value !== null && value !== undefined) {
          return value;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Check if a node is a router node
   * @param {string} nodeId - The node ID
   * @returns {boolean} True if the node is a router
   * @private
   */
  _isRouterNode(nodeId) {
    const node = this.graph.getNode(nodeId);
    if (!node) {
      return false;
    }
    
    // Check dictionary definition
    if (this.dictionary && this.dictionary.hasDefinition(node.class_type)) {
      const definition = this.dictionary.getNodeDefinition(node.class_type);
      return definition.type === 'router';
    }
    
    return false;
  }
  
  /**
   * Get passthrough ports for a router node
   * @param {string} nodeId - The router node ID
   * @param {Array<string>} portPatterns - Port name patterns to match
   * @returns {Array<string>} Array of input port names to explore
   * @private
   */
  _passthroughRouter(nodeId, portPatterns) {
    const node = this.graph.getNode(nodeId);
    if (!node) {
      return [];
    }
    
    // Get router definition from dictionary
    if (this.dictionary && this.dictionary.hasDefinition(node.class_type)) {
      const definition = this.dictionary.getNodeDefinition(node.class_type);
      
      if (definition.type === 'router' && definition.passthrough_rules) {
        // Return all input ports defined in passthrough_rules
        const allInputPorts = new Set();
        for (const outputPort in definition.passthrough_rules) {
          const inputPorts = definition.passthrough_rules[outputPort];
          if (Array.isArray(inputPorts)) {
            inputPorts.forEach(port => allInputPorts.add(port));
          }
        }
        return Array.from(allInputPorts);
      }
    }
    
    return [];
  }

  /**
   * Trace conditioning text for positive or negative metadata.
   *
   * Unlike _traceMetadataValue (which returns the first scalar found), this method
   * collects ALL text values reachable within the conditioning subgraph and joins
   * them. This correctly handles ConditioningCombine and similar nodes where multiple
   * CLIPTextEncode outputs are merged before reaching the sampler.
   *
   * From the KSampler's perspective, everything arriving at its 'positive'/'negative'
   * port is that conditioning — including all branches of a ConditioningCombine.
   *
   * Traversal rules:
   *   - Dictionary provider  → extract text, add to collection
   *   - Dictionary router    → follow passthrough ports, continue BFS
   *   - Unknown node         → stop (do not expand parents)
   *
   * @param {string} startNodeId - The sampler node to start from
   * @param {string} metadataType - 'positive' or 'negative'
   * @returns {string} Collected text joined by ', ', or '' if nothing found
   * @private
   */
  _traceConditioningText(startNodeId, metadataType) {
    const portName = metadataType; // 'positive' or 'negative' — matches KSampler input key

    // Step 1: follow the direct port link from the sampler
    const condNodeId = this.graph.getConnectedNodeId(startNodeId, portName);
    if (!condNodeId) {
      return '';
    }

    // Step 2: BFS within the conditioning subgraph, collecting all text
    const visited = new Set();
    const queue = [condNodeId];
    const texts = [];

    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const node = this.graph.getNode(nodeId);
      if (!node) continue;

      // Dictionary lookup first
      if (this.dictionary && this.dictionary.hasDefinition(node.class_type)) {
        const definition = this.dictionary.getNodeDefinition(node.class_type);

        if (definition.type === 'provider') {
          // Extract text and add to collection
          const value = this._applyDictionaryDefinition(nodeId, definition, metadataType);
          if (value !== null && value !== undefined && typeof value === 'string' && value.trim()) {
            texts.push(value.trim());
          }
          continue; // provider is a leaf — don't traverse further
        }

        if (definition.type === 'router' && definition.passthrough_rules) {
          // Follow all passthrough ports
          const allInputPorts = new Set();
          for (const outputPort in definition.passthrough_rules) {
            const inputPorts = definition.passthrough_rules[outputPort];
            if (Array.isArray(inputPorts)) {
              inputPorts.forEach(p => allInputPorts.add(p));
            }
          }
          for (const port of allInputPorts) {
            const nextId = this.graph.getConnectedNodeId(nodeId, port);
            if (nextId && !visited.has(nextId)) {
              queue.push(nextId);
            }
          }
          continue;
        }
      }

      // Unknown node: apply a lightweight heuristic for well-known text provider ports
      // before giving up. This covers CLIPTextEncode (and similar) when no dictionary
      // is loaded, without expanding into unrelated ancestors.
      const TEXT_PORT_NAMES = ['text', 'text_g', 'text_l', 'prompt', 'string'];
      let foundText = false;
      if (node.inputs) {
        for (const portName of TEXT_PORT_NAMES) {
          if (portName in node.inputs) {
            const val = node.inputs[portName];
            if (typeof val === 'string' && val.trim()) {
              texts.push(val.trim());
              foundText = true;
              break;
            }
          }
        }
      }
      // If no text was found here, stop — do not expand parents.
      // Intentional: we don't traverse into unrelated parts of the graph.
    }

    return texts.join(', ');
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
