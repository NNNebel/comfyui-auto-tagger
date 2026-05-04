// SuspiciousNodeDialog.js - Universal module (Browser + Node.js)
// Pure data-transformation logic for the step-centric suspicious node dialog.
(function(global) {
  'use strict';

  // Dependencies from window (browser) or require (Node.js)
  var SuspiciousNodeCategorizer;

  if (typeof window !== 'undefined') {
    SuspiciousNodeCategorizer = window.SuspiciousNodeCategorizer;
  } else if (typeof require !== 'undefined') {
    SuspiciousNodeCategorizer = require('../inspector/SuspiciousNodeCategorizer');
  }

  /**
   * Build dialog steps from parsed metadata.
   *
   * Converts node-centric suspiciousNodes[] into step-centric dialog entries
   * by reusing SuspiciousNodeCategorizer.categorizeNodes().
   *
   * @param {Object} metadata - Parsed metadata with suspiciousNodes / generationSteps
   * @returns {Array<Object>} Dialog steps:
   *   [{ type, stepIndex, stepMetadata, suspiciousNodesInfo }]
   *   - type: 'excluded-sampler' | 'suspicious-sampler'
   *   - stepIndex: 1-based ordinal among dialog steps
   *   - stepMetadata: { nodeId, nodeType, seed, steps, cfg, sampler, scheduler }
   *   - suspiciousNodesInfo: suspicious node objects related to this step
   */
  function buildDialogSteps(metadata) {
    if (!metadata || !metadata.suspiciousNodes || metadata.suspiciousNodes.length === 0) {
      return [];
    }

    const { affectedExcludedMap, suspSamplerNodes } =
      SuspiciousNodeCategorizer.categorizeNodes(metadata);

    const steps = [];
    let idx = 1;

    // Excluded samplers — sampler that was excluded from generationSteps
    affectedExcludedMap.forEach((entry, nodeId) => {
      steps.push({
        type: 'excluded-sampler',
        stepIndex: idx++,
        stepMetadata: entry.stepMetadata,
        suspiciousNodesInfo: entry.warnings.slice()
      });
    });

    // Suspicious samplers — sampler that is itself flagged as suspicious
    for (const suspNode of suspSamplerNodes) {
      steps.push({
        type: 'suspicious-sampler',
        stepIndex: idx++,
        stepMetadata: suspNode.stepMetadata,
        suspiciousNodesInfo: [suspNode]
      });
    }

    return steps;
  }

  /**
   * Map step-level decisions back to node-level overrides for the parser.
   *
   * @param {Array<Object>} dialogSteps - Output of buildDialogSteps()
   * @param {Object} decisions - { stepIndex: 'include' | 'exclude' }
   * @returns {Object} { action, overrides }
   *   - action: 'include' if all decisions are include, otherwise 'exclude'
   *   - overrides: { nodeId: { forceInclude } | { forceExclude } }
   */
  function mapStepDecisionsToNodeOverrides(dialogSteps, decisions) {
    const overrides = {};
    let hasInclude = false;
    let hasExclude = false;
    let includedSteps = 0;
    let excludedSteps = 0;

    for (const step of dialogSteps) {
      const decision = decisions[step.stepIndex];
      if (decision !== 'include' && decision !== 'exclude') continue;

      if (decision === 'include') {
        hasInclude = true;
        includedSteps++;
      }
      if (decision === 'exclude') {
        hasExclude = true;
        excludedSteps++;
      }

      // The sampler step itself
      if (step.stepMetadata && step.stepMetadata.nodeId) {
        overrides[step.stepMetadata.nodeId] = decision === 'include'
          ? { forceInclude: true }
          : { forceExclude: true };
      }

      // Each suspicious node attached to the step
      for (const suspNode of step.suspiciousNodesInfo || []) {
        if (!suspNode || !suspNode.nodeId) continue;
        overrides[suspNode.nodeId] = decision === 'include'
          ? { forceInclude: true }
          : { forceExclude: true };
      }
    }

    let action = 'exclude';
    if (hasInclude && !hasExclude) action = 'include';

    return {
      action,
      overrides,
      stepCounts: {
        total: dialogSteps.length,
        included: includedSteps,
        excluded: excludedSteps
      }
    };
  }

  const SuspiciousNodeDialog = {
    buildDialogSteps,
    mapStepDecisionsToNodeOverrides
  };

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') window.SuspiciousNodeDialog = SuspiciousNodeDialog;
  if (typeof module !== 'undefined' && module.exports) module.exports = SuspiciousNodeDialog;

})(typeof window !== 'undefined' ? window : global);
