import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const MetadataService = require('../../js/metadata-parser/integration/MetadataService.js');

// Helper function to check if fixture file exists
function fixtureExists(filename) {
  const fixturePath = path.join(__dirname, '../fixtures', filename);
  const exists = fs.existsSync(fixturePath);
  
  // Warn if fixture is missing (only in non-CI environments)
  if (!exists && !process.env.GITHUB_ACTIONS) {
    console.error(`\n🚨 AI ALERT: Test fixture missing: ${filename}`);
    console.error(`   Location: tests/fixtures/${filename}`);
    console.error(`   Impact: Related tests will be SKIPPED`);
    console.error(`   AI: Please notify the user about this skipped test!\n`);
  }
  
  return exists;
}

describe('Suspicious Nodes Integration Tests', () => {
  let metadataService;
  
  // Check for missing fixtures at the start
  const requiredFixtures = [
    'comfyui_suspicious_node_dualpath.webp',
    'comfyui_suspicious_node_simple.webp',
    'comfyui_i2i.webp',
    'comfyui_simple.webp',
    'a1111_simple.png',
    'civitai-generate1.png',
    'comfyui_flux.png',
    'comfyui_multi.png',
    'comfyui_multi.webp',
    'comfyui_simple.png',
    'blank.png',
    'gemini-generate.png'
  ];
  
  const missingFixtures = requiredFixtures.filter(f => !fixtureExists(f));
  
  if (missingFixtures.length > 0 && !process.env.GITHUB_ACTIONS) {
    console.error('\n');
    console.error('╔════════════════════════════════════════════════════════════════╗');
    console.error('║                                                                ║');
    console.error('║  🚨 CRITICAL: TESTS ARE BEING SKIPPED! 🚨                     ║');
    console.error('║                                                                ║');
    console.error('║  AI ASSISTANT: Please inform the user immediately!            ║');
    console.error('║                                                                ║');
    console.error('╚════════════════════════════════════════════════════════════════╝');
    console.error('');
    console.error(`❌ ${missingFixtures.length} fixture file(s) are MISSING from tests/fixtures/:`);
    console.error('');
    missingFixtures.forEach(f => console.error(`   ❌ ${f}`));
    console.error('');
    console.error('⚠️  IMPACT: Integration tests for these files will be SKIPPED.');
    console.error('⚠️  ACTION REQUIRED: User needs to generate or restore fixture files.');
    console.error('⚠️  LOCATION: tests/fixtures/ directory');
    console.error('');
    console.error('╔════════════════════════════════════════════════════════════════╗');
    console.error('║  AI: Report this to the user before proceeding!                ║');
    console.error('╚════════════════════════════════════════════════════════════════╝');
    console.error('\n');
  }

  beforeEach(() => {
    metadataService = new MetadataService();
  });

  describe('comfyui_suspicious_node_dualpath.webp', () => {
    it.skipIf(!fixtureExists('comfyui_suspicious_node_dualpath.webp'))('should detect multiple types of suspicious nodes', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node_dualpath.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'exclude'
      });

      // Should have suspicious nodes
      expect(metadata.suspiciousNodes).toBeDefined();
      expect(metadata.suspiciousNodes.length).toBe(5);

      // Verify all suspicious node types are detected
      const nodeTypes = metadata.suspiciousNodes.map(n => n.nodeType);
      expect(nodeTypes).toContain('ImageUpscaleWithModel');
      expect(nodeTypes).toContain('ImageScaleBy');
      expect(nodeTypes).toContain('KSampler');
      expect(nodeTypes).toContain('VAEEncode');
      expect(nodeTypes).toContain('VAEDecode');

      // Verify ImageUpscaleWithModel (ID: 171)
      const imageUpscaleNode = metadata.suspiciousNodes.find(n => n.nodeId === '171');
      expect(imageUpscaleNode).toBeDefined();
      expect(imageUpscaleNode.reasonKey).toBe('suspiciousNode.reason.imageProcessingNoInput');
      expect(imageUpscaleNode.affectedSteps).toBeDefined();

      // Verify ImageScaleBy (ID: 382)
      const imageScaleNode = metadata.suspiciousNodes.find(n => n.nodeId === '382');
      expect(imageScaleNode).toBeDefined();
      expect(imageScaleNode.reasonKey).toBe('suspiciousNode.reason.imageProcessingNoInput');
      expect(imageScaleNode.affectedSteps).toBeDefined();

      // Verify KSampler (ID: 389)
      // A suspicious sampler has stepMetadata (its own step info) instead of affectedSteps
      const samplerNode = metadata.suspiciousNodes.find(n => n.nodeId === '389');
      expect(samplerNode).toBeDefined();
      expect(samplerNode.reasonKey).toBe('suspiciousNode.reason.samplerNoInput');
      expect(samplerNode.stepMetadata).toBeDefined();

      // Verify VAEEncode (ID: 387)
      const vaeEncodeNode = metadata.suspiciousNodes.find(n => n.nodeId === '387');
      expect(vaeEncodeNode).toBeDefined();
      expect(vaeEncodeNode.reasonKey).toBe('suspiciousNode.reason.vaeEncodeNoInput');
      expect(vaeEncodeNode.affectedSteps).toBeDefined();

      // Verify VAEDecode (ID: 395)
      const vaeDecodeNode = metadata.suspiciousNodes.find(n => n.nodeId === '395');
      expect(vaeDecodeNode).toBeDefined();
      expect(vaeDecodeNode.reasonKey).toBe('suspiciousNode.reason.vaeDecodeNoInput');
    });

    it.skipIf(!fixtureExists('comfyui_suspicious_node_dualpath.webp'))('should detect suspicious nodes and show affected steps', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node_dualpath.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'exclude'
      });

      // Should have suspicious nodes
      expect(metadata.suspiciousNodes).toBeDefined();
      expect(metadata.suspiciousNodes.length).toBeGreaterThan(0);

      // Find ImageScaleBy node (ID: 382)
      const suspiciousNode = metadata.suspiciousNodes.find(n => n.nodeId === '382');
      expect(suspiciousNode).toBeDefined();
      expect(suspiciousNode.nodeType).toBe('ImageScaleBy');

      // Should have affectedSteps
      expect(suspiciousNode.affectedSteps).toBeDefined();
      expect(suspiciousNode.affectedSteps.length).toBeGreaterThan(0);

      // Should affect step 2 (KSampler ID: 378)
      const affectedStep = suspiciousNode.affectedSteps.find(s => s.stepNodeId === '378');
      expect(affectedStep).toBeDefined();
      expect(affectedStep.stepIndex).toBe(2);
    });

    it.skipIf(!fixtureExists('comfyui_suspicious_node_dualpath.webp'))('should have correct generation steps', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node_dualpath.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'exclude'
      });

      // Should have generation steps
      expect(metadata.generationSteps).toBeDefined();
      expect(metadata.generationSteps.length).toBeGreaterThan(0);

      // Verify step structure
      metadata.generationSteps.forEach((step, index) => {
        expect(step).toHaveProperty('nodeId');
        expect(step).toHaveProperty('nodeType');
        expect(step).toHaveProperty('stepIndex');
        expect(step.stepIndex).toBe(index + 1);
      });
    });
  });

  describe('comfyui_suspicious_node_simple.webp (suspicious nodes detected)', () => {
    it.skipIf(!fixtureExists('comfyui_suspicious_node_simple.webp'))('should extract metadata correctly when suspicious nodes exist', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node_simple.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'exclude'
      });

      // Should detect suspicious nodes (file was renamed from comfyui_orphaned.webp)
      expect(metadata.suspiciousNodes).toBeDefined();
      expect(metadata.suspiciousNodes.length).toBeGreaterThan(0);
    });

    it.skipIf(!fixtureExists('comfyui_suspicious_node_simple.webp'))('should have correct metadata extraction despite suspicious nodes', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node_simple.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'exclude'
      });

      // Should still extract basic metadata correctly
      expect(metadata.format).toBe('comfyui');
      expect(metadata.checkpoint).toBe('perfectdeliberate_v60.safetensors');
      expect(metadata.sampler).toBe('dpmpp_2m');
      expect(metadata.positive).toBe('blue hair, red eyes, pout');
      expect(metadata.negative).toBe('bad face, bad anatomy,');
    });
  });

  describe('comfyui_i2i.webp', () => {
    it.skipIf(!fixtureExists('comfyui_i2i.webp'))('should detect suspicious nodes in i2i workflow', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_i2i.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'exclude'
      });

      // Should have suspicious nodes (ImageUpscaleWithModel ID: 171)
      expect(metadata.suspiciousNodes).toBeDefined();
      expect(metadata.suspiciousNodes.length).toBeGreaterThan(0);

      const suspiciousNode = metadata.suspiciousNodes.find(n => n.nodeId === '171');
      expect(suspiciousNode).toBeDefined();

      // Should have affectedSteps
      if (suspiciousNode.affectedSteps) {
        expect(Array.isArray(suspiciousNode.affectedSteps)).toBe(true);
        suspiciousNode.affectedSteps.forEach(step => {
          expect(step).toHaveProperty('stepIndex');
          expect(step).toHaveProperty('stepNodeId');
          expect(step).toHaveProperty('stepNodeType');
        });
      }
    });
  });

  describe('all fixture images', () => {
    const supportedTestCases = [
      { file: 'a1111_simple.png', format: 'a1111', mimeType: 'image/png' },
      { file: 'civitai-generate1.png', format: 'comfyui', mimeType: 'image/png' },
      { file: 'comfyui_flux.png', format: 'comfyui', mimeType: 'image/png' },
      { file: 'comfyui_multi.png', format: 'comfyui', mimeType: 'image/png' },
      { file: 'comfyui_multi.webp', format: 'comfyui', mimeType: 'image/webp' },
      { file: 'comfyui_simple.png', format: 'comfyui', mimeType: 'image/png' },
      { file: 'comfyui_simple.webp', format: 'comfyui', mimeType: 'image/webp' }
    ];

    supportedTestCases.forEach(({ file, format, mimeType }) => {
      it.skipIf(!fixtureExists(file))(`should extract metadata from ${file}`, async () => {
        const fixturePath = path.join(__dirname, `../fixtures/${file}`);
        const buffer = fs.readFileSync(fixturePath);
        const metadata = metadataService.extractPreferredMetadata(buffer, mimeType, format, {
          suspiciousNodeHandling: 'exclude'
        });

        // Should successfully extract metadata
        expect(metadata).not.toBeNull();
        expect(metadata).toHaveProperty('format');
      });
    });
  });

  describe('unsupported image formats', () => {
    const unsupportedTestCases = [
      { file: 'blank.png', description: 'blank image created with Paint' },
      { file: 'gemini-generate.png', description: 'Gemini-generated image' }
    ];

    unsupportedTestCases.forEach(({ file, description }) => {
      it.skipIf(!fixtureExists(file))(`should return null for ${file} (${description})`, async () => {
        const fixturePath = path.join(__dirname, `../fixtures/${file}`);
        const buffer = fs.readFileSync(fixturePath);
        const metadata = metadataService.extractPreferredMetadata(buffer, 'image/png', 'comfyui', {
          suspiciousNodeHandling: 'exclude'
        });

        // Should return null for unsupported format
        expect(metadata).toBeNull();
      });
    });
  });

  describe('workflows without suspicious nodes', () => {
    it.skipIf(!fixtureExists('comfyui_simple.webp'))('should not have suspiciousNodes field for clean workflows', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_simple.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'exclude'
      });

      // Should not have suspicious nodes or have empty array
      expect(metadata.suspiciousNodes === undefined || metadata.suspiciousNodes.length === 0).toBe(true);
    });
  });

  describe('handling modes', () => {
    it.skipIf(!fixtureExists('comfyui_suspicious_node_dualpath.webp'))('should work with exclude mode', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node_dualpath.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'exclude'
      });

      expect(metadata.suspiciousNodes).toBeDefined();
      expect(metadata.suspiciousNodes[0].affectedSteps).toBeDefined();
    });

    it.skipIf(!fixtureExists('comfyui_suspicious_node_dualpath.webp'))('should work with include mode', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node_dualpath.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'include'
      });

      expect(metadata.suspiciousNodes).toBeDefined();
      expect(metadata.suspiciousNodes[0].affectedSteps).toBeDefined();
    });

    it.skipIf(!fixtureExists('comfyui_suspicious_node_dualpath.webp'))('should work with ask mode (returns suspicious nodes for UI)', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node_dualpath.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'ask'
      });

      expect(metadata.suspiciousNodes).toBeDefined();
      expect(metadata.suspiciousNodes[0].affectedSteps).toBeDefined();
    });
  });

  describe('warning card display requirements', () => {
    it.skipIf(!fixtureExists('comfyui_suspicious_node_dualpath.webp'))('should include all required fields for warning card rendering', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node_dualpath.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'ask'
      });

      // Verify all suspicious nodes have required fields for warning card
      metadata.suspiciousNodes.forEach(node => {
        expect(node).toHaveProperty('nodeId');
        expect(node).toHaveProperty('nodeType');
        expect(node).toHaveProperty('reasonKey');
        expect(node.reasonKey).toMatch(/^suspiciousNode\.reason\./);
      });
    });

    it.skipIf(!fixtureExists('comfyui_suspicious_node_dualpath.webp'))('should include suggestion info for VAEDecode warning card', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node_dualpath.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'ask'
      });

      const vaeDecodeNode = metadata.suspiciousNodes.find(n => n.nodeType === 'VAEDecode');
      if (vaeDecodeNode) {
        expect(vaeDecodeNode.reasonKey).toBe('suspiciousNode.reason.vaeDecodeNoInput');
        expect(vaeDecodeNode).toHaveProperty('suggestionKey');
        expect(vaeDecodeNode.suggestionKey).toBe('suspiciousNode.suggestion.vaeDecodeRequired');
      }
    });

    it.skipIf(!fixtureExists('comfyui_suspicious_node_dualpath.webp'))('should include reasonParams for parameter interpolation', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node_dualpath.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'ask'
      });

      // Nodes with nodeType in reason should have reasonParams
      metadata.suspiciousNodes.forEach(node => {
        if (node.reasonKey === 'suspiciousNode.reason.imageProcessingNoInput' ||
            node.reasonKey === 'suspiciousNode.reason.samplerNoInput' ||
            node.reasonKey === 'suspiciousNode.reason.missingInput') {
          expect(node).toHaveProperty('reasonParams');
          expect(node.reasonParams).toHaveProperty('nodeType');
        }
      });
    });
  });

  describe('affectedSteps.stepMetadata for excluded samplers', () => {
    it.skipIf(!fixtureExists('comfyui_suspicious_node_dualpath.webp'))('should include full metadata for excluded samplers', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node_dualpath.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'exclude'
      });

      // Collect all affectedSteps with stepMetadata (excluded samplers)
      const excludedSamplers = [];
      if (metadata.suspiciousNodes) {
        metadata.suspiciousNodes.forEach(suspNode => {
          if (suspNode.affectedSteps) {
            suspNode.affectedSteps.forEach(affected => {
              if (affected.stepMetadata) {
                excludedSamplers.push({
                  suspNodeId: suspNode.nodeId,
                  excludedNodeId: affected.stepNodeId,
                  stepMetadata: affected.stepMetadata
                });
              }
            });
          }
        });
      }

      // Should have at least one excluded sampler (e.g., #32, #378, #388)
      expect(excludedSamplers.length).toBeGreaterThan(0);

      // Each excluded sampler should have full metadata
      excludedSamplers.forEach(excluded => {
        expect(excluded.stepMetadata.nodeId).toBe(excluded.excludedNodeId);
        expect(excluded.stepMetadata).toHaveProperty('seed');
        expect(excluded.stepMetadata).toHaveProperty('steps');
        expect(excluded.stepMetadata).toHaveProperty('cfg');
        expect(excluded.stepMetadata).toHaveProperty('sampler');
        expect(excluded.stepMetadata).toHaveProperty('scheduler');
      });
    });

    it.skipIf(!fixtureExists('comfyui_suspicious_node_dualpath.webp'))('should NOT include stepMetadata for samplers in generationSteps', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node_dualpath.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'exclude'
      });

      // For each suspicious node, check affectedSteps
      if (metadata.suspiciousNodes) {
        metadata.suspiciousNodes.forEach(suspNode => {
          if (suspNode.affectedSteps) {
            suspNode.affectedSteps.forEach(affected => {
              // If affected step is in generationSteps, it should NOT have stepMetadata
              const isInGenerationSteps = metadata.generationSteps?.some(g => g.nodeId === affected.stepNodeId);
              if (isInGenerationSteps) {
                expect(affected.stepMetadata).toBeUndefined();
              }
            });
          }
        });
      }
    });

    it.skipIf(!fixtureExists('comfyui_suspicious_node_dualpath.webp'))('should not mix orphan nodes into unrelated warning cards', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node_dualpath.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'exclude'
      });

      // Build a map of which suspicious nodes affect which samplers
      const suspiciousAffectMap = new Map(); // nodeId → Set of affected stepNodeIds
      if (metadata.suspiciousNodes) {
        metadata.suspiciousNodes.forEach(suspNode => {
          const affected = new Set();
          if (suspNode.affectedSteps) {
            suspNode.affectedSteps.forEach(s => affected.add(s.stepNodeId));
          }
          if (suspNode.stepMetadata) {
            affected.add(suspNode.nodeId); // self-reference for sampler nodes
          }
          suspiciousAffectMap.set(suspNode.nodeId, affected);
        });
      }

      // Orphan nodes are those with no affected samplers
      const orphanNodeIds = new Set();
      if (metadata.suspiciousNodes) {
        metadata.suspiciousNodes.forEach(suspNode => {
          const affected = suspiciousAffectMap.get(suspNode.nodeId);
          if (!affected || affected.size === 0) {
            orphanNodeIds.add(suspNode.nodeId);
          }
        });
      }

      // Orphan nodes should not have relationships to specific samplers
      orphanNodeIds.forEach(orphanId => {
        const orphanNode = metadata.suspiciousNodes.find(n => n.nodeId === orphanId);
        if (orphanNode) {
          // Orphan should have no affectedSteps or empty affectedSteps
          if (orphanNode.affectedSteps) {
            expect(orphanNode.affectedSteps.length).toBe(0);
          } else {
            expect(orphanNode.affectedSteps).toBeUndefined();
          }
        }
      });
    });
  });
});
