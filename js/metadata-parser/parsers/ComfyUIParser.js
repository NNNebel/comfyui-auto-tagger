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

    // Extract from prompt JSON (contains generation parameters)
    if (rawChunks.prompt) {
      ErrorHandler.safeExecute(
        () => this.extractFromPrompt(rawChunks.prompt, metadata, options),
        null,
        'ComfyUIParser',
        { source: 'prompt' }
      );
    }

    // Extract from workflow JSON (contains UI state and additional info)
    if (rawChunks.workflow) {
      ErrorHandler.safeExecute(
        () => this.extractFromWorkflow(rawChunks.workflow, metadata),
        null,
        'ComfyUIParser',
        { source: 'workflow' }
      );
    }

    return metadata;
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
      // For each suspicious node, find which steps are affected
      metadata.suspiciousNodes = suspiciousNodes.map(suspNode => {
        const affectedSteps = [];
        
        // Create a temporary graph with this suspicious node force-included
        const tempOptions = {
          ...options,
          overrides: {
            ...options.overrides,
            [suspNode.nodeId]: { forceInclude: true }
          }
        };
        
        const tempGraph = new ComfyUIGraph(promptData, tempOptions);
        const tempAnalyzer = new ComfyUISamplerAnalyzer(tempGraph);
        
        // Extract all samplers with the suspicious node included
        const tempSamplersMetadata = tempAnalyzer.extractAllSamplersMetadata();
        
        // Compare with original samplers to find which steps would be affected
        // A step is affected if it appears in tempSamplersMetadata but not in allSamplersMetadata
        // OR if it exists in both but would have different dependencies
        tempSamplersMetadata.forEach((tempStep, index) => {
          // Check if this sampler exists in the original metadata
          const originalStep = allSamplersMetadata.find(s => s.nodeId === tempStep.nodeId);
          
          if (!originalStep) {
            // This sampler only appears when suspicious node is included
            // So it's definitely affected
            affectedSteps.push({
              stepIndex: index + 1,
              stepNodeId: tempStep.nodeId,
              stepNodeType: tempStep.nodeType
            });
          } else {
            // Sampler exists in both - check if suspicious node is in its dependency chain
            const ancestors = tempGraph.getAllAncestors(tempStep.nodeId);
            if (ancestors.has(suspNode.nodeId)) {
              // Find the step index in the original metadata
              const originalIndex = allSamplersMetadata.findIndex(s => s.nodeId === tempStep.nodeId);
              affectedSteps.push({
                stepIndex: originalIndex + 1,
                stepNodeId: tempStep.nodeId,
                stepNodeType: tempStep.nodeType
              });
            }
          }
        });
        
        return {
          ...suspNode,
          affectedSteps: affectedSteps.length > 0 ? affectedSteps : undefined
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
    
    // Extract LoRA information
    const loras = new Set();
    for (const id in promptData) {
      const node = promptData[id];
      if (!node || !node.class_type) continue;
      
      // Fallback: If no checkpoint found from samplers, use first CheckpointLoader or UNETLoader
      if (!metadata.checkpoint) {
        if (node.class_type.includes("CheckpointLoader")) {
          const ckptName = graph.resolveInput(id, "ckpt_name");
          if (ckptName) {
            metadata.checkpoint = ParsingUtils.extractFilename(ckptName);
          }
        } else if (node.class_type === "UNETLoader") {
          const unetName = graph.resolveInput(id, "unet_name");
          if (unetName) {
            metadata.checkpoint = ParsingUtils.extractFilename(unetName);
          }
        }
      }
      
      // Extract LoRA from LoraLoader nodes
      if (node.class_type && node.class_type.toLowerCase().includes("lora")) {
        if (node.class_type.includes("LoraLoader")) {
          const loraName = graph.resolveInput(id, "lora_name");
          if (loraName) {
            loras.add(ParsingUtils.extractFilename(loraName));
          }
        } else if (node.inputs) {
          // Custom LoRA loader variants
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
    
    if (loras.size > 0) metadata.loras = Array.from(loras);
    
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
