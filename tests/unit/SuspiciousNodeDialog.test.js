import { describe, it, expect } from 'vitest';

const SuspiciousNodeDialog = require('../../js/plugin-ui/SuspiciousNodeDialog');

const sampler32 = {
  nodeId: '32',
  nodeType: 'KSampler',
  seed: 123,
  steps: 20,
  cfg: 7,
  sampler: 'euler',
  scheduler: 'normal'
};

const sampler378 = {
  nodeId: '378',
  nodeType: 'KSampler',
  seed: 456,
  steps: 30,
  cfg: 8,
  sampler: 'dpmpp_2m',
  scheduler: 'karras'
};

describe('SuspiciousNodeDialog', () => {
  describe('buildDialogSteps()', () => {
    it('returns empty array when no suspicious nodes', () => {
      expect(SuspiciousNodeDialog.buildDialogSteps({})).toEqual([]);
      expect(SuspiciousNodeDialog.buildDialogSteps({ suspiciousNodes: [] })).toEqual([]);
    });

    it('returns empty array when metadata is null', () => {
      expect(SuspiciousNodeDialog.buildDialogSteps(null)).toEqual([]);
    });

    it('builds excluded-sampler step when suspicious node affects an excluded sampler', () => {
      const metadata = {
        suspiciousNodes: [
          {
            nodeId: '171',
            nodeType: 'ImageUpscaleWithModel',
            reasonKey: 'suspiciousNode.reason.imageProcessingNoInput',
            affectedSteps: [
              { stepNodeId: '32', stepNodeType: 'KSampler', stepMetadata: sampler32 }
            ]
          }
        ]
      };

      const steps = SuspiciousNodeDialog.buildDialogSteps(metadata);
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe('excluded-sampler');
      expect(steps[0].stepIndex).toBe(1);
      expect(steps[0].stepMetadata).toEqual(sampler32);
      expect(steps[0].suspiciousNodesInfo).toHaveLength(1);
      expect(steps[0].suspiciousNodesInfo[0].nodeId).toBe('171');
    });

    it('builds suspicious-sampler step when sampler itself is flagged', () => {
      const metadata = {
        suspiciousNodes: [
          {
            nodeId: '389',
            nodeType: 'KSampler',
            reasonKey: 'suspiciousNode.reason.samplerNoInput',
            stepMetadata: sampler32
          }
        ]
      };

      const steps = SuspiciousNodeDialog.buildDialogSteps(metadata);
      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe('suspicious-sampler');
      expect(steps[0].stepMetadata).toEqual(sampler32);
      expect(steps[0].suspiciousNodesInfo[0].nodeId).toBe('389');
    });

    it('builds mixed steps with sequential stepIndex', () => {
      const metadata = {
        suspiciousNodes: [
          {
            nodeId: '171',
            nodeType: 'ImageUpscaleWithModel',
            reasonKey: 'suspiciousNode.reason.imageProcessingNoInput',
            affectedSteps: [
              { stepNodeId: '32', stepNodeType: 'KSampler', stepMetadata: sampler32 }
            ]
          },
          {
            nodeId: '389',
            nodeType: 'KSampler',
            reasonKey: 'suspiciousNode.reason.samplerNoInput',
            stepMetadata: sampler378
          }
        ]
      };

      const steps = SuspiciousNodeDialog.buildDialogSteps(metadata);
      expect(steps).toHaveLength(2);
      expect(steps[0].type).toBe('excluded-sampler');
      expect(steps[0].stepIndex).toBe(1);
      expect(steps[1].type).toBe('suspicious-sampler');
      expect(steps[1].stepIndex).toBe(2);
    });

    it('does not produce a step for orphan nodes', () => {
      const metadata = {
        suspiciousNodes: [
          {
            nodeId: '395',
            nodeType: 'VAEDecode',
            reasonKey: 'suspiciousNode.reason.vaeDecodeNoInput'
            // no affectedSteps, no stepMetadata
          }
        ]
      };

      expect(SuspiciousNodeDialog.buildDialogSteps(metadata)).toEqual([]);
    });

    it('aggregates multiple suspicious nodes affecting the same excluded sampler', () => {
      const metadata = {
        suspiciousNodes: [
          {
            nodeId: '171',
            nodeType: 'ImageUpscaleWithModel',
            affectedSteps: [
              { stepNodeId: '32', stepNodeType: 'KSampler', stepMetadata: sampler32 }
            ]
          },
          {
            nodeId: '382',
            nodeType: 'ImageScaleBy',
            affectedSteps: [
              { stepNodeId: '32', stepNodeType: 'KSampler', stepMetadata: sampler32 }
            ]
          }
        ]
      };

      const steps = SuspiciousNodeDialog.buildDialogSteps(metadata);
      expect(steps).toHaveLength(1);
      expect(steps[0].suspiciousNodesInfo).toHaveLength(2);
      const ids = steps[0].suspiciousNodesInfo.map(n => n.nodeId).sort();
      expect(ids).toEqual(['171', '382']);
    });
  });

  describe('mapStepDecisionsToNodeOverrides()', () => {
    function makeSteps() {
      return [
        {
          type: 'excluded-sampler',
          stepIndex: 1,
          stepMetadata: sampler32,
          suspiciousNodesInfo: [{ nodeId: '171', nodeType: 'ImageUpscaleWithModel' }]
        },
        {
          type: 'suspicious-sampler',
          stepIndex: 2,
          stepMetadata: sampler378,
          suspiciousNodesInfo: [{ nodeId: '378', nodeType: 'KSampler' }]
        }
      ];
    }

    it('maps exclude decision to forceExclude overrides', () => {
      const result = SuspiciousNodeDialog.mapStepDecisionsToNodeOverrides(
        makeSteps(),
        { 1: 'exclude', 2: 'exclude' }
      );
      expect(result.action).toBe('exclude');
      expect(result.overrides['32']).toEqual({ forceExclude: true });
      expect(result.overrides['171']).toEqual({ forceExclude: true });
      expect(result.overrides['378']).toEqual({ forceExclude: true });
    });

    it('maps include decision to forceInclude overrides', () => {
      const result = SuspiciousNodeDialog.mapStepDecisionsToNodeOverrides(
        makeSteps(),
        { 1: 'include', 2: 'include' }
      );
      expect(result.action).toBe('include');
      expect(result.overrides['32']).toEqual({ forceInclude: true });
      expect(result.overrides['171']).toEqual({ forceInclude: true });
      expect(result.overrides['378']).toEqual({ forceInclude: true });
    });

    it('uses exclude as base action when decisions are mixed', () => {
      const result = SuspiciousNodeDialog.mapStepDecisionsToNodeOverrides(
        makeSteps(),
        { 1: 'include', 2: 'exclude' }
      );
      expect(result.action).toBe('exclude');
      expect(result.overrides['32']).toEqual({ forceInclude: true });
      expect(result.overrides['171']).toEqual({ forceInclude: true });
      expect(result.overrides['378']).toEqual({ forceExclude: true });
    });

    it('skips steps without a decision', () => {
      const result = SuspiciousNodeDialog.mapStepDecisionsToNodeOverrides(
        makeSteps(),
        { 1: 'exclude' }
      );
      expect(result.overrides['32']).toEqual({ forceExclude: true });
      expect(result.overrides['171']).toEqual({ forceExclude: true });
      expect(result.overrides['378']).toBeUndefined();
    });

    it('returns empty overrides when no decisions provided', () => {
      const result = SuspiciousNodeDialog.mapStepDecisionsToNodeOverrides(
        makeSteps(),
        {}
      );
      expect(result.action).toBe('exclude');
      expect(result.overrides).toEqual({});
    });
  });
});
