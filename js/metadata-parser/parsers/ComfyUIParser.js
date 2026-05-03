// ComfyUIParser.js - Universal module (Browser + Node.js)
(function(global) {
  'use strict';

  // Get dependencies for both environments
  var MetadataParserBase, ParsingUtils, ErrorHandler, ComfyUIGraph, ComfyUISamplerAnalyzer, NodeDefinitionDictionary, MetadataExtractionReporter;
  
  if (typeof window !== 'undefined') {
    // Browser environment
    MetadataParserBase = window.MetadataParser;
    ParsingUtils = window.ParsingUtils;
    ErrorHandler = window.ErrorHandler;
    ComfyUIGraph = window.ComfyUIGraph;
    ComfyUISamplerAnalyzer = window.ComfyUISamplerAnalyzer;
    NodeDefinitionDictionary = window.NodeDefinitionDictionary;
    MetadataExtractionReporter = window.MetadataExtractionReporter;
  } else if (typeof require !== 'undefined') {
    // Node.js environment (testing)
    MetadataParserBase = require('./MetadataParser');
    ParsingUtils = require('../utils/ParsingUtils');
    ErrorHandler = require('../utils/ErrorHandler').ErrorHandler;
    ComfyUIGraph = require('../graph/ComfyUIGraph');
    ComfyUISamplerAnalyzer = require('../graph/ComfyUISamplerAnalyzer');
    NodeDefinitionDictionary = require('../dictionary/NodeDefinitionDictionary');
    MetadataExtractionReporter = require('../reporter/MetadataExtractionReporter');
  } else {
    throw new Error('Required dependencies not found');
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
   * @param {Object} [options={}] - Parser options (e.g., suspiciousNodeHandling)
   * @returns {ParsedMetadata} Structured metadata object
   */
  parse(rawChunks, options = {}) {
    const metadata = {
      format: 'comfyui'
    };

    // Parse JSON strings in rawChunks if needed (backward compatibility)
    const parsedChunks = this._parseJsonFields(rawChunks);

    // Merge eagle_bridge signals into options before graph construction
    const effectiveOptions = { ...options };
    if (parsedChunks.eagle_bridge && parsedChunks.eagle_bridge.final_node_id) {
      const nodeId = String(parsedChunks.eagle_bridge.final_node_id);
      effectiveOptions.forcedOutputNodeIds = [nodeId];
      metadata.eagle_bridge = { final_node_id: nodeId };
      console.log(`[EagleMetadataBridge] eagle_bridge detected: node ${nodeId} forced as output`);
    }

    // Extract from prompt JSON (contains generation parameters)
    if (parsedChunks.prompt) {
      ErrorHandler.safeExecute(
        () => this.extractFromPrompt(parsedChunks.prompt, metadata, effectiveOptions),
        null,
        'ComfyUIParser',
        { source: 'prompt' }
      );
    }

    // Extract from workflow JSON (contains UI state and additional info)
    if (parsedChunks.workflow) {
      ErrorHandler.safeExecute(
        () => this.extractFromWorkflow(parsedChunks.workflow, metadata),
        null,
        'ComfyUIParser',
        { source: 'workflow' }
      );
    }

    return metadata;
  }

  /**
   * Parse JSON fields in rawChunks if they are strings.
   * Handles both object (already parsed) and string (raw JSON) formats.
   * @private
   * @param {Object} rawChunks - Raw metadata chunks
   * @returns {Object} Chunks with JSON fields parsed
   */
  _parseJsonFields(rawChunks) {
    const parsed = { ...rawChunks };

    // Parse workflow if it's a string
    if (typeof parsed.workflow === 'string') {
      try {
        parsed.workflow = JSON.parse(parsed.workflow);
      } catch (e) {
        ErrorHandler.logWarning('ComfyUIParser', `Failed to parse workflow JSON: ${e.message}`);
        parsed.workflow = undefined;
      }
    }

    // Parse prompt if it's a string
    if (typeof parsed.prompt === 'string') {
      try {
        parsed.prompt = JSON.parse(parsed.prompt);
      } catch (e) {
        ErrorHandler.logWarning('ComfyUIParser', `Failed to parse prompt JSON: ${e.message}`);
        parsed.prompt = undefined;
      }
    }

    // Parse eagle_bridge if it's a string
    if (typeof parsed.eagle_bridge === 'string') {
      try {
        parsed.eagle_bridge = JSON.parse(parsed.eagle_bridge);
      } catch (e) {
        ErrorHandler.logWarning('ComfyUIParser', `Failed to parse eagle_bridge JSON: ${e.message}`);
        parsed.eagle_bridge = undefined;
      }
    }

    return parsed;
  }

  /**
   * Extract metadata from ComfyUI prompt JSON using graph-based analysis.
   * @param {Object} promptData - ComfyUI prompt JSON object
   * @param {Object} metadata - Metadata object to populate
   * @param {Object} [options={}] - Parser options (e.g., suspiciousNodeHandling)
   */
  extractFromPrompt(promptData, metadata, options = {}) {
    // Use global dictionary if available, otherwise use default
    const dictionary = (typeof window !== 'undefined' && window.globalDictionary) 
      ? window.globalDictionary 
      : NodeDefinitionDictionary.getDefault();
    const reporter = new MetadataExtractionReporter();
    
    // Create graph and analyzer instances with options
    // Pass dictionary to graph for suspicious node detection
    const graphOptions = {
      ...options,
      dictionary: dictionary
    };
    const graph = new ComfyUIGraph(promptData, graphOptions);
    const analyzer = new ComfyUISamplerAnalyzer(graph);
    
    // Set dictionary and reporter
    analyzer.setDictionary(dictionary);
    analyzer.setReporter(reporter);
    
    // Find base sampler and extract all sampler metadata
    const { baseSampler, allSamplers, isFallback, suspiciousNodes } = analyzer.findBaseSampler();
    const allSamplersMetadata = analyzer.extractAllSamplersMetadata();
    
    // Store suspicious nodes in metadata with affected steps
    if (suspiciousNodes && suspiciousNodes.length > 0) {
      // Compute the "exclude-base" sampler set: what samplers exist when ALL suspicious
      // nodes are excluded. This is the stable reference for affectedSteps comparison —
      // it does not depend on options.suspiciousNodeHandling, so the dialog gets the
      // same stepMetadata regardless of whether the caller chose include / exclude.
      let excludeBaseSamplersMetadata;
      if (options.suspiciousNodeHandling === 'exclude' &&
          !suspiciousNodes.some(sn => options.overrides && options.overrides[sn.nodeId] && options.overrides[sn.nodeId].forceInclude)) {
        // Fast path: allSamplersMetadata is already the exclude-base
        excludeBaseSamplersMetadata = allSamplersMetadata;
      } else {
        const excludeOverrides = { ...(options.overrides || {}) };
        for (const sn of suspiciousNodes) {
          excludeOverrides[sn.nodeId] = { forceExclude: true };
        }
        const excludeOptions = {
          ...options,
          suspiciousNodeHandling: 'exclude',
          overrides: excludeOverrides,
          dictionary: dictionary
        };
        const excludeGraph = new ComfyUIGraph(promptData, excludeOptions);
        const excludeAnalyzer = new ComfyUISamplerAnalyzer(excludeGraph);
        excludeAnalyzer.setDictionary(dictionary);
        excludeAnalyzer.setReporter(reporter);
        excludeBaseSamplersMetadata = excludeAnalyzer.extractAllSamplersMetadata();
      }

      // For each suspicious node, find which steps are affected
      metadata.suspiciousNodes = suspiciousNodes.map(suspNode => {
        const affectedSteps = [];

        // Isolate this suspicious node's effect: force-include only this one,
        // force-exclude all other suspicious nodes. Without this, in 'include' mode
        // the other suspicious nodes would still appear in tempSamplersMetadata and
        // cross-contaminate the affectedSteps comparison.
        const tempOverrides = { ...(options.overrides || {}) };
        for (const sn of suspiciousNodes) {
          if (sn.nodeId !== suspNode.nodeId) {
            tempOverrides[sn.nodeId] = { forceExclude: true };
          }
        }
        tempOverrides[suspNode.nodeId] = { forceInclude: true };

        const tempOptions = {
          ...options,
          suspiciousNodeHandling: 'exclude',
          overrides: tempOverrides
        };

        const tempGraph = new ComfyUIGraph(promptData, tempOptions);
        const tempAnalyzer = new ComfyUISamplerAnalyzer(tempGraph);

        // Extract all samplers with the suspicious node included
        const tempSamplersMetadata = tempAnalyzer.extractAllSamplersMetadata();

        // If this suspicious node is itself a sampler, capture its own step metadata
        const ownStepMetadata = tempSamplersMetadata.find(s => s.nodeId === suspNode.nodeId);

        // Compare against the exclude-base to find samplers that only appear when
        // this suspicious node is included.
        tempSamplersMetadata.forEach((tempStep, index) => {
          if (tempStep.nodeId === suspNode.nodeId) return; // self — handled via ownStepMetadata

          const inExcludeBase = excludeBaseSamplersMetadata.find(s => s.nodeId === tempStep.nodeId);

          if (!inExcludeBase) {
            // This sampler does not exist when all suspicious nodes are excluded —
            // including this suspicious node makes it appear. Capture full metadata for display.
            affectedSteps.push({
              stepIndex: index + 1,
              stepNodeId: tempStep.nodeId,
              stepNodeType: tempStep.nodeType,
              stepMetadata: tempStep
            });
          } else {
            // Sampler exists even without this suspicious node — check if suspicious
            // node is in its dependency chain (to confirm causal relationship).
            const ancestors = tempGraph.getAllAncestors(tempStep.nodeId);
            if (ancestors.has(suspNode.nodeId)) {
              const refIndex = allSamplersMetadata.findIndex(s => s.nodeId === tempStep.nodeId);
              affectedSteps.push({
                stepIndex: (refIndex >= 0 ? refIndex : index) + 1,
                stepNodeId: tempStep.nodeId,
                stepNodeType: tempStep.nodeType
              });
            }
          }
        });

        return {
          ...suspNode,
          affectedSteps: affectedSteps.length > 0 ? affectedSteps : undefined,
          stepMetadata: ownStepMetadata || undefined
        };
      });
    }
    
    // Adjust fallback flag: If analyzer says it's fallback but all samplers have valid paths,
    // then it's not truly a fallback (just missing output nodes)
    const hasValidPath = allSamplers.some(s => s.distance !== Infinity);
    metadata.sampler_fallback = isFallback && !hasValidPath;
    
    // Set generation steps
    metadata.generationSteps = allSamplersMetadata;
    
    // Keep extra_samplers for backward compatibility
    metadata.extra_samplers = allSamplersMetadata.map(step => ({
      id: step.nodeId,
      seed: step.seed,
      steps: step.steps,
      cfg: step.cfg,
      sampler: step.sampler,
      scheduler: step.scheduler,
      is_base: step.isBase
    }));
    
    // Set base sampler parameters
    if (baseSampler) {
      const baseStep = allSamplersMetadata.find(s => s.isBase);
      if (baseStep) {
        metadata.seed = baseStep.seed;
        metadata.steps = baseStep.steps;
        metadata.cfg = baseStep.cfg;
        metadata.sampler = baseStep.sampler;
        metadata.scheduler = baseStep.scheduler;
        if (baseStep.checkpoint) {
          metadata.checkpoint = baseStep.checkpoint;
        }
      }
    }
    
    // Merge prompts from all samplers
    const allPos = new Set();
    const allNeg = new Set();
    
    allSamplersMetadata.forEach(step => {
      if (step.positive && step.positive.trim()) {
        allPos.add(step.positive.trim());
      }
      if (step.negative && step.negative.trim()) {
        allNeg.add(step.negative.trim());
      }
    });
    
    if (allPos.size > 0) metadata.positive = Array.from(allPos).join("\n");
    if (allNeg.size > 0) metadata.negative = Array.from(allNeg).join("\n");
    
    // Determine which node IDs to scan for LoRA and checkpoint fallback.
    //
    // Deterministic mode (eagle_bridge): restrict scan to ancestors of the
    // forced output node(s) so we never pick up LoRAs / checkpoints from a
    // different pipeline in a multi-pipeline workflow.
    // Heuristic mode: scan all nodes in the prompt (legacy behaviour).
    const forcedOutputIds = options.forcedOutputNodeIds;
    let scanNodeIds;
    if (forcedOutputIds && forcedOutputIds.length > 0) {
      const ancestorSet = new Set();
      for (const nodeId of forcedOutputIds.map(String)) {
        if (graph.hasNode(nodeId)) {
          ancestorSet.add(nodeId);
          graph.getAllAncestors(nodeId).forEach(id => ancestorSet.add(id));
        }
      }
      scanNodeIds = Array.from(ancestorSet);
    } else {
      scanNodeIds = Object.keys(promptData);
    }

    // Extract LoRA information (scoped to scanNodeIds)
    const loras = new Set();
    for (const id of scanNodeIds) {
      const node = promptData[id];
      if (!node || !node.class_type) continue;

      const nodeDef = dictionary.getNodeDefinition(node.class_type);

      // ── Checkpoint ──────────────────────────────────────────────────────
      // Dictionary-first: use explicit input_key from checkpoint_loader entries.
      // Heuristic fallback: class name contains "CheckpointLoader".
      if (!metadata.checkpoint) {
        if (nodeDef && nodeDef.type === 'checkpoint_loader') {
          const ckptName = graph.resolveInput(id, nodeDef.input_key);
          if (ckptName) {
            metadata.checkpoint = ParsingUtils.extractFilename(ckptName);
          }
        } else if (!nodeDef && node.class_type.includes("CheckpointLoader")) {
          // Heuristic fallback for unknown checkpoint loader variants
          const ckptName = graph.resolveInput(id, "ckpt_name");
          if (ckptName) {
            metadata.checkpoint = ParsingUtils.extractFilename(ckptName);
          }
        }
      }

      // ── LoRA ────────────────────────────────────────────────────────────
      // Dictionary-first: use explicit input_key from lora_loader entries.
      // Heuristic fallback: class name contains "lora" (catches stack loaders etc.)
      if (nodeDef && nodeDef.type === 'lora_loader') {
        const loraName = graph.resolveInput(id, nodeDef.input_key);
        if (loraName) {
          loras.add(ParsingUtils.extractFilename(loraName));
        }
      } else if (!nodeDef && node.class_type && node.class_type.toLowerCase().includes("lora")) {
        // Heuristic fallback for unknown LoRA loader variants
        // (e.g. rgthree "Lora Loader Stack" uses lora_01, lora_02, etc.)
        if (node.inputs) {
          for (const inputKey in node.inputs) {
            if (inputKey.toLowerCase().includes("lora")) {
              const loraValue = graph.resolveInput(id, inputKey);
              if (loraValue && typeof loraValue === 'string' && loraValue !== 'None') {
                const filename = ParsingUtils.extractFilename(loraValue);
                if (filename && filename.toLowerCase().endsWith('.safetensors')) {
                  loras.add(filename);
                }
              }
            }
          }
        }
      }
    }

    metadata.loras = Array.from(loras);
    
    // Check for excluded nodes and log warnings
    const excludedNodes = reporter.getExcludedNodes();
    if (excludedNodes.length > 0) {
      const hasValidSamplers = allSamplersMetadata.length > 0;
      const hasValidMetadata = metadata.positive || metadata.seed !== null;
      
      if (hasValidSamplers && hasValidMetadata) {
        // Soft Warning: Nodes excluded but extraction succeeded
        ErrorHandler.logSoftWarning(
          'ComfyUIParser',
          reporter.getSoftWarningMessage(),
          { excludedCount: excludedNodes.length, excludedNodes }
        );
      } else {
        // Hard Warning: Nodes excluded and extraction failed
        ErrorHandler.logHardWarning(
          'ComfyUIParser',
          reporter.getHardWarningMessage(),
          { excludedCount: excludedNodes.length, excludedNodes }
        );
      }
    }
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
        metadata.checkpoint = ParsingUtils.extractFilename(fullPath);
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
