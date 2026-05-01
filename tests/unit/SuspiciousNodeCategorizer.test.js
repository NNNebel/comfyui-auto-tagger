import { describe, it, expect, beforeEach } from 'vitest';

const { categorizeNodes } = require('../../js/inspector/SuspiciousNodeCategorizer.js');

describe('SuspiciousNodeCategorizer', () => {
  describe('categorizeNodes function', () => {
    it('should return empty maps when no suspicious nodes', () => {
      const metadata = {
        generationSteps: [
          { nodeId: '1', seed: 123, steps: 20, cfg: 7, sampler: 'euler' }
        ],
        suspiciousNodes: []
      };

      const result = categorizeNodes(metadata);

      expect(result.stepWarningMap).toEqual({});
      expect(result.suspSamplerNodes).toEqual([]);
      expect(result.affectedExcludedMap.size).toBe(0);
      expect(result.orphanNodes).toEqual([]);
    });

    it('should handle undefined suspiciousNodes', () => {
      const metadata = {
        generationSteps: [
          { nodeId: '1', seed: 123, steps: 20, cfg: 7, sampler: 'euler' }
        ]
      };

      const result = categorizeNodes(metadata);

      expect(result.stepWarningMap).toEqual({});
      expect(result.suspSamplerNodes).toEqual([]);
      expect(result.affectedExcludedMap.size).toBe(0);
      expect(result.orphanNodes).toEqual([]);
    });

    it('should categorize suspicious sampler (has stepMetadata)', () => {
      const metadata = {
        generationSteps: [],
        suspiciousNodes: [
          {
            nodeId: '389',
            nodeType: 'KSampler',
            stepMetadata: {
              nodeId: '389',
              seed: 456,
              steps: 30,
              cfg: 8,
              sampler: 'dpmpp_2m'
            }
          }
        ]
      };

      const result = categorizeNodes(metadata);

      expect(result.suspSamplerNodes).toHaveLength(1);
      expect(result.suspSamplerNodes[0].nodeId).toBe('389');
      expect(result.stepWarningMap).toEqual({});
      expect(result.affectedExcludedMap.size).toBe(0);
      expect(result.orphanNodes).toEqual([]);
    });

    it('should categorize excluded sampler in affectedSteps with stepMetadata', () => {
      const metadata = {
        generationSteps: [
          { nodeId: '1', seed: 123, steps: 20, cfg: 7, sampler: 'euler' }
        ],
        suspiciousNodes: [
          {
            nodeId: '171',
            nodeType: 'ImageUpscaleWithModel',
            affectedSteps: [
              {
                stepIndex: 2,
                stepNodeId: '32',
                stepNodeType: 'KSampler',
                stepMetadata: {
                  nodeId: '32',
                  seed: 789,
                  steps: 25,
                  cfg: 9,
                  sampler: 'euler_ancestral'
                }
              }
            ]
          }
        ]
      };

      const result = categorizeNodes(metadata);

      expect(result.suspSamplerNodes).toEqual([]);
      expect(result.stepWarningMap).toEqual({});
      expect(result.affectedExcludedMap.has('32')).toBe(true);
      expect(result.affectedExcludedMap.get('32').stepMetadata.nodeId).toBe('32');
      expect(result.affectedExcludedMap.get('32').warnings).toContain(metadata.suspiciousNodes[0]);
      expect(result.orphanNodes).toEqual([]);
    });

    it('should categorize affected normal step (affectedSteps without stepMetadata)', () => {
      const metadata = {
        generationSteps: [
          { nodeId: '1', seed: 123, steps: 20, cfg: 7, sampler: 'euler' }
        ],
        suspiciousNodes: [
          {
            nodeId: '171',
            nodeType: 'ImageUpscaleWithModel',
            affectedSteps: [
              {
                stepIndex: 1,
                stepNodeId: '1',
                stepNodeType: 'KSampler'
              }
            ]
          }
        ]
      };

      const result = categorizeNodes(metadata);

      expect(result.suspSamplerNodes).toEqual([]);
      expect(result.stepWarningMap['1']).toContain(metadata.suspiciousNodes[0]);
      expect(result.affectedExcludedMap.size).toBe(0);
      expect(result.orphanNodes).toEqual([]);
    });

    it('should categorize orphan node (no affected steps, no stepMetadata)', () => {
      const metadata = {
        generationSteps: [
          { nodeId: '1', seed: 123, steps: 20, cfg: 7, sampler: 'euler' }
        ],
        suspiciousNodes: [
          {
            nodeId: '395',
            nodeType: 'VAEDecode'
          }
        ]
      };

      const result = categorizeNodes(metadata);

      expect(result.suspSamplerNodes).toEqual([]);
      expect(result.stepWarningMap).toEqual({});
      expect(result.affectedExcludedMap.size).toBe(0);
      expect(result.orphanNodes).toHaveLength(1);
      expect(result.orphanNodes[0].nodeId).toBe('395');
    });

    it('should handle multiple suspicious nodes affecting same excluded sampler', () => {
      const metadata = {
        generationSteps: [],
        suspiciousNodes: [
          {
            nodeId: '171',
            nodeType: 'ImageUpscaleWithModel',
            affectedSteps: [
              {
                stepIndex: 1,
                stepNodeId: '32',
                stepNodeType: 'KSampler',
                stepMetadata: { nodeId: '32', seed: 100 }
              }
            ]
          },
          {
            nodeId: '387',
            nodeType: 'VAEEncode',
            affectedSteps: [
              {
                stepIndex: 1,
                stepNodeId: '32',
                stepNodeType: 'KSampler',
                stepMetadata: { nodeId: '32', seed: 100 }
              }
            ]
          }
        ]
      };

      const result = categorizeNodes(metadata);

      expect(result.affectedExcludedMap.has('32')).toBe(true);
      expect(result.affectedExcludedMap.get('32').warnings).toHaveLength(2);
      expect(result.affectedExcludedMap.get('32').warnings.map(w => w.nodeId)).toContain('171');
      expect(result.affectedExcludedMap.get('32').warnings.map(w => w.nodeId)).toContain('387');
    });

    it('should not mix orphan nodes into any category', () => {
      const metadata = {
        generationSteps: [
          { nodeId: '1', seed: 123, steps: 20, cfg: 7, sampler: 'euler' }
        ],
        suspiciousNodes: [
          {
            nodeId: '171',
            nodeType: 'ImageUpscaleWithModel',
            affectedSteps: [
              {
                stepIndex: 1,
                stepNodeId: '1',
                stepNodeType: 'KSampler'
              }
            ]
          },
          {
            nodeId: '395',
            nodeType: 'VAEDecode'
          }
        ]
      };

      const result = categorizeNodes(metadata);

      // Orphan should be in orphanNodes only
      expect(result.orphanNodes).toHaveLength(1);
      expect(result.orphanNodes[0].nodeId).toBe('395');

      // Orphan should NOT appear in any warning maps
      expect(result.stepWarningMap['1']).toEqual([metadata.suspiciousNodes[0]]);
      expect(result.affectedExcludedMap.size).toBe(0);
    });

    it('should handle suspicious sampler with both external and excluded affected steps', () => {
      const metadata = {
        generationSteps: [
          { nodeId: '1', seed: 123, steps: 20, cfg: 7, sampler: 'euler' },
          { nodeId: '2', seed: 456, steps: 25, cfg: 8, sampler: 'dpmpp' }
        ],
        suspiciousNodes: [
          {
            nodeId: '389',
            nodeType: 'KSampler',
            stepMetadata: {
              nodeId: '389',
              seed: 789,
              steps: 30,
              cfg: 9,
              sampler: 'euler_ancestral'
            },
            affectedSteps: [
              {
                stepIndex: 1,
                stepNodeId: '1',
                stepNodeType: 'KSampler'
              },
              {
                stepIndex: 2,
                stepNodeId: '32',
                stepNodeType: 'KSampler',
                stepMetadata: { nodeId: '32', seed: 321 }
              }
            ]
          }
        ]
      };

      const result = categorizeNodes(metadata);

      expect(result.suspSamplerNodes).toHaveLength(1);
      expect(result.stepWarningMap['1']).toContain(metadata.suspiciousNodes[0]);
      expect(result.affectedExcludedMap.has('32')).toBe(true);
      expect(result.affectedExcludedMap.get('32').warnings).toContain(metadata.suspiciousNodes[0]);
    });

    it('should prevent orphan nodes from appearing in suspicious sampler warnings', () => {
      const metadata = {
        generationSteps: [],
        suspiciousNodes: [
          {
            nodeId: '389',
            nodeType: 'KSampler',
            stepMetadata: {
              nodeId: '389',
              seed: 789,
              steps: 30,
              cfg: 9,
              sampler: 'euler_ancestral'
            }
          },
          {
            nodeId: '395',
            nodeType: 'VAEDecode'
          }
        ]
      };

      const result = categorizeNodes(metadata);

      expect(result.suspSamplerNodes).toHaveLength(1);
      expect(result.orphanNodes).toHaveLength(1);

      // Orphan should NOT be in any warning structure
      const sussSamplerWarnings = result.suspSamplerNodes.flatMap(s => s.affectedSteps || []);
      expect(sussSamplerWarnings.some(w => w.nodeId === '395')).toBe(false);
    });
  });
});
