// SuspiciousNodeCategorizer.js - Universal module (Browser + Node.js)
(function(global) {
  'use strict';

  /**
   * Categorize suspicious nodes for inspector display.
   * Pure function: metadata → { stepWarningMap, suspSamplerNodes, affectedExcludedMap }
   *
   * @param {Object} metadata - Parsed metadata with suspiciousNodes and generationSteps
   * @returns {Object} Categorized nodes:
   *   - stepWarningMap: { nodeId → suspiciousNode[] } (affects normal steps)
   *   - suspSamplerNodes: [ suspiciousNode ] (suspicious samplers themselves)
   *   - affectedExcludedMap: Map<nodeId, { stepMetadata, warnings: [] }> (excluded samplers)
   */
  function categorizeNodes(metadata) {
    const stepWarningMap = {};
    const suspSamplerNodes = [];
    const orphanNodes = [];
    const affectedExcludedMap = new Map();

    if (!metadata.suspiciousNodes || metadata.suspiciousNodes.length === 0) {
      return { stepWarningMap, suspSamplerNodes, affectedExcludedMap, orphanNodes };
    }

    for (const suspNode of metadata.suspiciousNodes) {
      if (suspNode.stepMetadata) {
        // This suspicious node is itself a sampler — give it its own step tab
        suspSamplerNodes.push(suspNode);
        // Also register any external step it affects
        if (suspNode.affectedSteps) {
          for (const affected of suspNode.affectedSteps) {
            if (affected.stepMetadata) {
              // Excluded sampler with full metadata
              if (!affectedExcludedMap.has(affected.stepNodeId)) {
                affectedExcludedMap.set(affected.stepNodeId, { stepMetadata: affected.stepMetadata, warnings: [] });
              }
              affectedExcludedMap.get(affected.stepNodeId).warnings.push(suspNode);
            } else {
              if (!stepWarningMap[affected.stepNodeId]) stepWarningMap[affected.stepNodeId] = [];
              stepWarningMap[affected.stepNodeId].push(suspNode);
            }
          }
        }
      } else if (suspNode.affectedSteps && suspNode.affectedSteps.length > 0) {
        for (const affected of suspNode.affectedSteps) {
          if (affected.stepMetadata) {
            // Sampler excluded from generationSteps — give it a tab with warning
            if (!affectedExcludedMap.has(affected.stepNodeId)) {
              affectedExcludedMap.set(affected.stepNodeId, { stepMetadata: affected.stepMetadata, warnings: [] });
            }
            affectedExcludedMap.get(affected.stepNodeId).warnings.push(suspNode);
          } else {
            // Normal step in generationSteps — add warning
            if (!stepWarningMap[affected.stepNodeId]) stepWarningMap[affected.stepNodeId] = [];
            stepWarningMap[affected.stepNodeId].push(suspNode);
          }
        }
      } else {
        // No step relation — orphaned node (not displayed as tab or in warnings)
        orphanNodes.push(suspNode);
      }
    }

    return { stepWarningMap, suspSamplerNodes, affectedExcludedMap, orphanNodes };
  }

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.SuspiciousNodeCategorizer = { categorizeNodes };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { categorizeNodes };
  }

})(typeof window !== 'undefined' ? window : global);
