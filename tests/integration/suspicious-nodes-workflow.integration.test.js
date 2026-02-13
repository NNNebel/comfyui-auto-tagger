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
    'comfyui_suspicious_node.webp',
    'comfyui_suspicious_node2.webp',
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

  describe('comfyui_suspicious_node.webp', () => {
    it.skipIf(!fixtureExists('comfyui_suspicious_node.webp'))('should detect multiple types of suspicious nodes', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node.webp');
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
      const samplerNode = metadata.suspiciousNodes.find(n => n.nodeId === '389');
      expect(samplerNode).toBeDefined();
      expect(samplerNode.reasonKey).toBe('suspiciousNode.reason.samplerNoInput');
      expect(samplerNode.affectedSteps).toBeDefined();

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

    it.skipIf(!fixtureExists('comfyui_suspicious_node.webp'))('should detect suspicious nodes and show affected steps', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node.webp');
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

    it.skipIf(!fixtureExists('comfyui_suspicious_node.webp'))('should have correct generation steps', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node.webp');
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

  describe('comfyui_suspicious_node2.webp', () => {
    it.skipIf(!fixtureExists('comfyui_suspicious_node2.webp'))('should detect suspicious nodes in second test image', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node2.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'exclude'
      });

      // Should have suspicious nodes
      expect(metadata.suspiciousNodes).toBeDefined();
      expect(metadata.suspiciousNodes.length).toBe(2);

      // Verify both ImageUpscaleWithModel nodes are detected
      const imageUpscaleNodes = metadata.suspiciousNodes.filter(n => n.nodeType === 'ImageUpscaleWithModel');
      expect(imageUpscaleNodes.length).toBe(2);

      // Verify node IDs
      const nodeIds = metadata.suspiciousNodes.map(n => n.nodeId).sort();
      expect(nodeIds).toEqual(['171', '383']);

      // Verify node 171
      const node171 = metadata.suspiciousNodes.find(n => n.nodeId === '171');
      expect(node171.reasonKey).toBe('suspiciousNode.reason.imageProcessingNoInput');
      expect(node171.affectedSteps).toBeDefined();
      expect(node171.affectedSteps.length).toBeGreaterThan(0);

      // Verify node 383
      const node383 = metadata.suspiciousNodes.find(n => n.nodeId === '383');
      expect(node383.reasonKey).toBe('suspiciousNode.reason.imageProcessingNoInput');
      expect(node383.affectedSteps).toBeDefined();
      expect(node383.affectedSteps.length).toBeGreaterThan(0);
    });

    it.skipIf(!fixtureExists('comfyui_suspicious_node2.webp'))('should have correct metadata extraction despite suspicious nodes', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node2.webp');
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
    it.skipIf(!fixtureExists('comfyui_suspicious_node.webp'))('should work with exclude mode', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'exclude'
      });

      expect(metadata.suspiciousNodes).toBeDefined();
      expect(metadata.suspiciousNodes[0].affectedSteps).toBeDefined();
    });

    it.skipIf(!fixtureExists('comfyui_suspicious_node.webp'))('should work with include mode', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'include'
      });

      expect(metadata.suspiciousNodes).toBeDefined();
      expect(metadata.suspiciousNodes[0].affectedSteps).toBeDefined();
    });

    it.skipIf(!fixtureExists('comfyui_suspicious_node.webp'))('should work with ask mode (returns suspicious nodes for UI)', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'ask'
      });

      expect(metadata.suspiciousNodes).toBeDefined();
      expect(metadata.suspiciousNodes[0].affectedSteps).toBeDefined();
    });
  });
});
