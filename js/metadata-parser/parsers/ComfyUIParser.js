// ComfyUIParser.js - Universal module (Browser + Node.js)
(function(global) {
  'use strict';

  // Get MetadataParser reference for both environments
  var MetadataParserBase;
  if (typeof window !== 'undefined' && window.MetadataParser) {
    MetadataParserBase = window.MetadataParser;
  } else if (typeof require !== 'undefined') {
    MetadataParserBase = require('./MetadataParser');
  } else {
    throw new Error('MetadataParser not found');
  }

/**
 * Parser for ComfyUI metadata format.
 * Extracts metadata from ComfyUI's prompt and workflow JSON structures.
 */
class ComfyUIParser extends MetadataParserBase {
  /**
   * Get the format name this parser handles.
   * @returns {string} Format identifier 'comfyui'
   */
  getFormatName() {
    return 'comfyui';
  }

  /**
   * Parse raw metadata chunks into structured ComfyUI metadata.
   * @param {Object} rawChunks - Raw metadata chunks containing 'prompt' and/or 'workflow'
   * @returns {ParsedMetadata} Structured metadata object
   */
  parse(rawChunks) {
    const metadata = {
      format: 'comfyui'
    };

    // Extract from prompt JSON (contains generation parameters)
    if (rawChunks.prompt) {
      try {
        this.extractFromPrompt(rawChunks.prompt, metadata);
      } catch (e) {
        console.error("ComfyUI prompt parsing failed:", e);
      }
    }

    // Extract from workflow JSON (contains UI state and additional info)
    if (rawChunks.workflow) {
      try {
        this.extractFromWorkflow(rawChunks.workflow, metadata);
      } catch (e) {
        console.error("ComfyUI workflow parsing failed:", e);
      }
    }

    return metadata;
  }

  /**
   * Find Sink Nodes (output nodes that consume IMAGE/LATENT but don't pass it forward).
   * These are typically SaveImage, PreviewImage, or any custom output nodes.
   * @param {Object} promptData - ComfyUI prompt JSON object
   * @returns {Array<string>} Array of node IDs that are sink nodes
   */
  findSinkNodes(promptData) {
    // Step 1: Build a map of which nodes consume which outputs
    const outputConsumers = new Map(); // outputNodeId -> Set of consumer node IDs
    
    for (const nodeId in promptData) {
      const node = promptData[nodeId];
      if (!node || !node.inputs) continue;
      
      // Check all inputs for links
      for (const inputKey in node.inputs) {
        const inputValue = node.inputs[inputKey];
        
        // If it's a link [sourceNodeId, outputSlot]
        if (Array.isArray(inputValue) && inputValue.length === 2) {
          const sourceNodeId = String(inputValue[0]);
          if (!outputConsumers.has(sourceNodeId)) {
            outputConsumers.set(sourceNodeId, new Set());
          }
          outputConsumers.get(sourceNodeId).add(nodeId);
        }
      }
    }
    
    // Step 2: Find nodes that consume IMAGE/LATENT but don't pass it forward
    const sinkNodes = [];
    const imageLatentInputKeys = ['images', 'image', 'latent_image', 'samples', 'latent'];
    
    for (const nodeId in promptData) {
      const node = promptData[nodeId];
      if (!node || !node.inputs) continue;
      
      // Check if this node has IMAGE/LATENT inputs
      let hasImageLatentInput = false;
      for (const inputKey of imageLatentInputKeys) {
        if (node.inputs[inputKey] !== undefined) {
          hasImageLatentInput = true;
          break;
        }
      }
      
      if (!hasImageLatentInput) continue;
      
      // Check if this node's outputs are consumed by other nodes
      const consumers = outputConsumers.get(nodeId);
      const hasConsumers = consumers && consumers.size > 0;
      
      // If no consumers, this is a sink node
      if (!hasConsumers) {
        sinkNodes.push(nodeId);
      }
    }
    
    // Step 3: Prioritize sink nodes
    // Priority: 1. Known keywords (Save, Output, Export)
    //          2. IMAGE type over LATENT type
    //          3. Larger ID (newer nodes)
    sinkNodes.sort((a, b) => {
      const nodeA = promptData[a];
      const nodeB = promptData[b];
      
      if (!nodeA || !nodeB) return 0;
      
      // Priority 1: Known keywords
      const keywordsA = (nodeA.class_type || '').match(/Save|Output|Export/i);
      const keywordsB = (nodeB.class_type || '').match(/Save|Output|Export/i);
      if (keywordsA && !keywordsB) return -1;
      if (!keywordsA && keywordsB) return 1;
      
      // Priority 2: IMAGE over LATENT
      const hasImageA = nodeA.inputs && (nodeA.inputs.images !== undefined || nodeA.inputs.image !== undefined);
      const hasImageB = nodeB.inputs && (nodeB.inputs.images !== undefined || nodeB.inputs.image !== undefined);
      if (hasImageA && !hasImageB) return -1;
      if (!hasImageA && hasImageB) return 1;
      
      // Priority 3: Larger ID (newer)
      return parseInt(b) - parseInt(a);
    });
    
    return sinkNodes;
  }

  /**
   * Extract metadata from ComfyUI prompt JSON.
   * Implements the base sampler selection algorithm and prompt merging logic.
   * @param {Object} promptData - ComfyUI prompt JSON object
   * @param {Object} metadata - Metadata object to populate
   */
  extractFromPrompt(promptData, metadata) {
    // Helper to resolve inputs recursively
    const resolve = (nodeId, inputKey, visited = new Set()) => {
      if (visited.has(nodeId)) return null;
      visited.add(nodeId);
      
      const node = promptData[nodeId];
      if (!node || !node.inputs) return null;
      const val = node.inputs[inputKey];

      // If it's a direct value (not an array link), return it
      if (!Array.isArray(val)) return val;

      // If it's a link [parentId, slotIndex]
      if (val.length === 2) {
        const parentId = val[0];
        const parentNode = promptData[parentId];
        if (!parentNode) return null;

        // 1. Try to find the same key in parent (passthrough)
        if (parentNode.inputs[inputKey] !== undefined) {
          return resolve(parentId, inputKey, visited);
        }

        // 2. Try common value keys (Primitive nodes, etc.)
        for (const k of ['value', 'int', 'float', 'text', 'text_g', 'text_l', 'string', 'seed', 'steps', 'cfg', 'sampler_name']) {
          if (parentNode.inputs[k] !== undefined) {
            return resolve(parentId, k, visited);
          }
        }
      }
      return null;
    };

    // 1. Identify all sampling nodes (KSampler, Detailer, etc.)
    // A sampling node is any node that has seed, steps, cfg, and positive/negative inputs
    const samplers = [];
    for (const id in promptData) {
      const node = promptData[id];
      if (!node || !node.class_type || !node.inputs) continue;
      
      // Check if this node has sampling parameters
      const hasSeed = node.inputs.seed !== undefined;
      const hasSteps = node.inputs.steps !== undefined;
      const hasCfg = node.inputs.cfg !== undefined;
      const hasPositive = node.inputs.positive !== undefined;
      const hasNegative = node.inputs.negative !== undefined;
      
      // If it has most of the sampling parameters, treat it as a sampler
      // (some nodes might not have all parameters, so we check for at least 3)
      const samplingParamCount = [hasSeed, hasSteps, hasCfg, hasPositive, hasNegative].filter(Boolean).length;
      
      if (samplingParamCount >= 3) {
        samplers.push({ id, node });
      }
    }

    // 2. Strategy: Seed/Sampler (Base Sampler Selection)
    // Algorithm: Start from Sink Nodes (output nodes) and backtrace to find the KSampler
    // closest to a latent source (node without latent_image input)
    let baseSamplerId = null;
    let isFallback = false;
    metadata.extra_samplers = [];

    if (samplers.length > 0) {
      // Find Sink Nodes (output nodes that consume IMAGE/LATENT but don't pass it forward)
      const sinkNodes = this.findSinkNodes(promptData);
      
      // If no sink nodes found, fall back to all-sampler scoring
      const startNodes = sinkNodes.length > 0 ? sinkNodes : Object.keys(promptData);

      // Helper: Check if a node is a latent source (no latent_image input or not connected)
      const isLatentSource = (nodeId) => {
        const node = promptData[nodeId];
        if (!node || !node.inputs) return false;
        
        // Check if node has latent_image or samples input
        const latentInput = node.inputs.latent_image || node.inputs.samples;
        
        // If no latent input exists, check if it has image input (img2img nodes)
        if (latentInput === undefined) {
          // Special case: VAEEncode is a latent source (img2img starting point)
          if (node.class_type && node.class_type.includes('VAEEncode')) {
            return true;
          }
          // Nodes with 'image' input (but not VAEEncode) are not latent sources
          if (node.inputs.image !== undefined) {
            return false;
          }
          // Nodes without latent or image input are latent sources
          return true;
        }
        
        // If latent input is not a link (direct value), it's a source
        if (!Array.isArray(latentInput)) return true;
        
        // If it's a link but points to nothing, it's a source
        if (latentInput.length !== 2) return true;
        
        return false;
      };

      // Helper: Trace image chain to find originating sampler
      const traceImageChainToSampler = (nodeId, chainVisited = new Set()) => {
        if (chainVisited.has(nodeId)) return Infinity;
        chainVisited.add(nodeId);
        
        const n = promptData[nodeId];
        if (!n || !n.inputs) return Infinity;
        
        // Check if this node is a sampler
        const isSampler = samplers.some(s => s.id === nodeId);
        if (isSampler) {
          const dist = getDistToLatentSource(nodeId);
          // If sampler has no latent_image input, it might be a special node like DetailerForEach
          // In this case, continue tracing through its image input
          if (!n.inputs.latent_image && !n.inputs.samples) {
            // Continue to image tracing below
          } else {
            return dist;
          }
        }
        
        // If it's VAEDecode, trace its samples input to find sampler
        if (n.class_type === 'VAEDecode') {
          const samplesInput = n.inputs.samples;
          if (Array.isArray(samplesInput) && samplesInput.length === 2) {
            const samplerId = String(samplesInput[0]);
            return getDistToLatentSource(samplerId);
          }
        }
        
        // Otherwise trace through image inputs
        const imgInput = n.inputs.image || n.inputs.images || n.inputs.pixels;
        if (Array.isArray(imgInput) && imgInput.length === 2) {
          const upstreamId = String(imgInput[0]);
          return traceImageChainToSampler(upstreamId, new Set(chainVisited));
        }
        
        return Infinity;
      };

      // Helper: Calculate distance from a sampler to nearest latent source
      const getDistToLatentSource = (samplerId, visited = new Set()) => {
        if (visited.has(samplerId)) return Infinity;
        visited.add(samplerId);
        
        const node = promptData[samplerId];
        if (!node) return Infinity;
        
        // Check if this node has latent_image input
        const latentInput = node.inputs.latent_image || node.inputs.samples;
        
        // If no latent input, check what type of node this is
        if (latentInput === undefined) {
          // VAEEncode: trace its image input to find originating sampler
          if (node.class_type && node.class_type.includes('VAEEncode')) {
            const imageInput = node.inputs.image || node.inputs.pixels;
            if (Array.isArray(imageInput) && imageInput.length === 2) {
              const imageSourceId = String(imageInput[0]);
              
              // Trace through image chain to find sampler
              const chainDist = traceImageChainToSampler(imageSourceId);
              if (chainDist !== Infinity) {
                return chainDist + 1;
              }
            }
            
            // If can't trace, treat as true img2img source (distance 0)
            return 0;
          }
          
          // Nodes with image input (not VAEEncode) are not latent sources
          if (node.inputs.image !== undefined || node.inputs.pixels !== undefined) {
            return Infinity;
          }
          
          // Nodes without latent/image input are true sources (EmptyLatentImage)
          return 0;
        }
        
        // If latent input is not a link, it's a source
        if (!Array.isArray(latentInput)) return 0;
        if (latentInput.length !== 2) return 0;
        
        // Trace back through latent_image input
        const parentId = String(latentInput[0]);
        const parentNode = promptData[parentId];
        
        // Special case: If parent is VAEEncode, its distance is already the final distance
        // (VAEEncode distance = originating sampler distance + 1)
        if (parentNode && parentNode.class_type && parentNode.class_type.includes('VAEEncode')) {
          return getDistToLatentSource(parentId, new Set(visited));
        }
        
        // Otherwise, add 1 to parent distance
        const parentDist = getDistToLatentSource(parentId, new Set(visited));
        if (parentDist !== Infinity) {
          return parentDist + 1;
        }
        
        return Infinity;
      };

      // Helper: Find samplers reachable from a given node by backtracing
      const findReachableSamplers = (nodeId, visited = new Set()) => {
        if (visited.has(nodeId)) return [];
        visited.add(nodeId);
        
        const node = promptData[nodeId];
        if (!node || !node.inputs) return [];
        
        const reachable = [];
        
        // Check if this node itself is a sampler
        const isSampler = samplers.some(s => s.id === nodeId);
        if (isSampler) {
          reachable.push(nodeId);
        }
        
        // Backtrace through all inputs
        for (const inputKey in node.inputs) {
          const inputValue = node.inputs[inputKey];
          
          // If it's a link [sourceNodeId, outputSlot]
          if (Array.isArray(inputValue) && inputValue.length === 2) {
            const sourceNodeId = String(inputValue[0]);
            const upstream = findReachableSamplers(sourceNodeId, new Set(visited));
            reachable.push(...upstream);
          }
        }
        
        return reachable;
      };

      // Strategy: Start from sink nodes and find reachable samplers
      let candidateSamplers = [];
      
      if (sinkNodes.length > 0) {
        // Find all samplers reachable from sink nodes
        const reachableFromSinks = new Set();
        for (const sinkId of sinkNodes) {
          const reachable = findReachableSamplers(sinkId);
          reachable.forEach(s => reachableFromSinks.add(s));
        }
        
        // If we found samplers from sink nodes, use those
        if (reachableFromSinks.size > 0) {
          candidateSamplers = samplers.filter(s => reachableFromSinks.has(s.id));
        }
      }
      
      // Fallback: If no samplers found from sink nodes, use all samplers
      if (candidateSamplers.length === 0) {
        candidateSamplers = samplers;
        isFallback = true;
        console.warn('[ComfyUI Parser] No sink nodes found or no samplers reachable from sink nodes. Using all samplers as fallback.');
      }

      // Score each candidate sampler by distance to latent source
      const scored = candidateSamplers.map(s => ({
        id: s.id,
        dist: getDistToLatentSource(s.id)
      }));

      // Sort: Min Distance -> Min ID
      scored.sort((a, b) => {
        if (a.dist !== b.dist) return a.dist - b.dist;
        return parseInt(a.id) - parseInt(b.id);
      });

      // Check if we had to fall back (no valid path to source or no sink nodes)
      if (scored.length === 0 || scored[0].dist === Infinity) {
        isFallback = true;
        console.warn('[ComfyUI Parser] Could not find valid path to latent source. Base sampler selection may be unreliable.');
      }
      
      // Check if multiple samplers have the same minimum distance (tie-breaking by ID)
      if (scored.length > 1 && scored[0].dist === scored[1].dist) {
        console.warn(`[ComfyUI Parser] Multiple samplers at same distance (${scored[0].dist}). Selected node ${scored[0].id} by smallest ID.`);
      }
      
      baseSamplerId = scored[0].id;

      // Collect info from ALL samplers with detailed information for each generation step
      metadata.generationSteps = samplers.map((s, index) => {
        const nodeId = s.id;
        const node = s.node;
        const isBase = nodeId === baseSamplerId;
        
        // Get node title/name from workflow if available
        let nodeName = node.class_type || 'Unknown';
        
        // Extract positive and negative prompts for this specific sampler
        const positivePrompt = resolve(nodeId, "positive");
        const negativePrompt = resolve(nodeId, "negative");
        
        // Trace back to find the checkpoint for this specific sampler
        let samplerCheckpoint = null;
        const visited = new Set();
        const findCheckpoint = (currentNodeId, preferredInputKey = null) => {
          if (visited.has(currentNodeId)) return null;
          visited.add(currentNodeId);
          
          const currentNode = promptData[currentNodeId];
          if (!currentNode) return null;
          
          // Check if this node is a CheckpointLoader
          if (currentNode.class_type && currentNode.class_type.includes('CheckpointLoader')) {
            const ckptName = resolve(currentNodeId, 'ckpt_name');
            return ckptName ? ckptName.split(/[/\\]/).pop() : null;
          }
          
          // If preferredInputKey is specified, check it first
          if (preferredInputKey && currentNode.inputs && currentNode.inputs[preferredInputKey]) {
            const inputValue = currentNode.inputs[preferredInputKey];
            if (Array.isArray(inputValue) && inputValue.length === 2) {
              const sourceNodeId = String(inputValue[0]);
              const checkpoint = findCheckpoint(sourceNodeId);
              if (checkpoint) return checkpoint;
            }
          }
          
          // Traverse through other inputs to find checkpoint
          if (currentNode.inputs) {
            for (const inputKey in currentNode.inputs) {
              if (inputKey === preferredInputKey) continue; // Already checked
              const inputValue = currentNode.inputs[inputKey];
              if (Array.isArray(inputValue) && inputValue.length === 2) {
                const sourceNodeId = String(inputValue[0]);
                const checkpoint = findCheckpoint(sourceNodeId);
                if (checkpoint) return checkpoint;
              }
            }
          }
          
          return null;
        };
        
        // Start search from 'model' input (most common for KSampler)
        samplerCheckpoint = findCheckpoint(nodeId, 'model');
        
        return {
          nodeId: nodeId,
          nodeName: nodeName,
          nodeType: node.class_type,
          checkpoint: samplerCheckpoint,
          seed: resolve(nodeId, "seed"),
          steps: resolve(nodeId, "steps"),
          cfg: resolve(nodeId, "cfg"),
          sampler: resolve(nodeId, "sampler_name"),
          scheduler: resolve(nodeId, "scheduler"),
          positive: typeof positivePrompt === 'string' ? positivePrompt.trim() : '',
          negative: typeof negativePrompt === 'string' ? negativePrompt.trim() : '',
          isBase: isBase,
          stepIndex: index + 1,
          distance: scored.find(sc => sc.id === nodeId)?.dist
        };
      });
      
      // Keep extra_samplers for backward compatibility (tags generation)
      metadata.extra_samplers = metadata.generationSteps.map(step => ({
        id: step.nodeId,
        seed: step.seed,
        steps: step.steps,
        cfg: step.cfg,
        sampler: step.sampler,
        scheduler: step.scheduler,
        is_base: step.isBase
      }));
    } else {
      // No samplers found - initialize empty arrays
      metadata.generationSteps = [];
      metadata.extra_samplers = [];
    }

    if (baseSamplerId) {
      metadata.sampler_fallback = isFallback;
      metadata.seed = resolve(baseSamplerId, "seed");
      metadata.steps = resolve(baseSamplerId, "steps");
      metadata.cfg = resolve(baseSamplerId, "cfg");
      metadata.sampler = resolve(baseSamplerId, "sampler_name");
      metadata.scheduler = resolve(baseSamplerId, "scheduler");
      
      // Set global checkpoint from base sampler
      const baseStep = metadata.generationSteps.find(s => s.isBase);
      if (baseStep && baseStep.checkpoint) {
        metadata.checkpoint = baseStep.checkpoint;
      }
    }

    // 3. Strategy: Prompt (Merge)
    const allPos = new Set();
    const allNeg = new Set();

    samplers.forEach(s => {
      const p = resolve(s.id, "positive");
      const n = resolve(s.id, "negative");
      if (typeof p === 'string' && p.trim()) allPos.add(p.trim());
      if (typeof n === 'string' && n.trim()) allNeg.add(n.trim());
    });

    if (allPos.size > 0) metadata.positive = Array.from(allPos).join("\n");
    if (allNeg.size > 0) metadata.negative = Array.from(allNeg).join("\n");

    // 4. Other Global Metadata (LoRA and fallback checkpoint)
    const loras = new Set();
    for (const id in promptData) {
      const node = promptData[id];
      if (!node || !node.class_type) continue;
      
      // Fallback: If no checkpoint found from samplers, use first CheckpointLoader
      if (node.class_type.includes("CheckpointLoader") && !metadata.checkpoint) {
        const ckptName = resolve(id, "ckpt_name");
        if (ckptName) {
          metadata.checkpoint = ckptName.split(/[/\\]/).pop();
        }
      }
      
      // Extract LoRA from LoraLoader nodes (standard and custom variants)
      if (node.class_type && node.class_type.toLowerCase().includes("lora")) {
        // Standard LoraLoader node
        if (node.class_type.includes("LoraLoader")) {
          const l = resolve(id, "lora_name");
          if (l) {
            loras.add(l.split(/[/\\]/).pop());
          }
        }
        // Custom LoRA loader variants (e.g., "Lora Loader Stack (rgthree)")
        else if (node.inputs) {
          // Check for common LoRA input keys
          for (const inputKey in node.inputs) {
            if (inputKey.toLowerCase().includes("lora")) {
              const loraValue = resolve(id, inputKey);
              if (loraValue && typeof loraValue === 'string' && loraValue !== 'None') {
                // Extract filename from path
                const filename = loraValue.split(/[/\\]/).pop();
                if (filename && filename.toLowerCase().endsWith('.safetensors')) {
                  loras.add(filename);
                }
              }
            }
          }
        }
      }
    }
    
    if (loras.size > 0) metadata.loras = Array.from(loras);
  }

  /**
   * Extract metadata from ComfyUI workflow JSON.
   * Extracts checkpoint information and node titles from workflow nodes.
   * @param {Object} workflowData - ComfyUI workflow JSON object
   * @param {Object} metadata - Metadata object to populate
   */
  extractFromWorkflow(workflowData, metadata) {
    if (!workflowData.nodes) return;
    
    // Build a map of node IDs to their titles/names
    const nodeTitles = new Map();
    const nodeGroups = new Map();
    
    workflowData.nodes.forEach(node => {
      const nodeId = String(node.id);
      
      // Store node title if available
      if (node.title) {
        nodeTitles.set(nodeId, node.title);
      }
      
      // Store group information if available
      if (node.group !== undefined && workflowData.groups) {
        const group = workflowData.groups.find(g => g.id === node.group);
        if (group && group.title) {
          nodeGroups.set(nodeId, group.title);
        }
      }
      
      // Extract checkpoint
      const type = node.type || node.class_type || "";
      if (type.includes("CheckpointLoader") && !metadata.checkpoint && node.widgets_values) {
        const fullPath = node.widgets_values?.[0] || '';
        // Extract just the filename from the path (handles both / and \ separators)
        metadata.checkpoint = fullPath.split(/[/\\]/).pop();
      }
    });
    
    // Update generationSteps with node titles and groups
    if (metadata.generationSteps) {
      metadata.generationSteps.forEach(step => {
        if (nodeTitles.has(step.nodeId)) {
          step.nodeTitle = nodeTitles.get(step.nodeId);
        }
        if (nodeGroups.has(step.nodeId)) {
          step.nodeGroup = nodeGroups.get(step.nodeId);
        }
      });
    }
  }
}

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.ComfyUIParser = ComfyUIParser;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ComfyUIParser;
  }

})(typeof window !== 'undefined' ? window : global);
