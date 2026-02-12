import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const MetadataService = require('../../js/metadata-parser/integration/MetadataService.js');

describe('Suspicious Nodes Integration Tests', () => {
  let metadataService;

  beforeEach(() => {
    metadataService = new MetadataService();
  });

  describe('comfyui_suspicious_node.webp', () => {
    it('should detect suspicious nodes and show affected steps', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'exclude'
      });

      // Should have suspicious nodes
      expect(metadata.suspiciousNodes).toBeDefined();
      expect(metadata.suspiciousNodes.length).toBeGreaterThan(0);

      // Find ImageUpscaleWithModel node (ID: 383)
      const suspiciousNode = metadata.suspiciousNodes.find(n => n.nodeId === '383');
      expect(suspiciousNode).toBeDefined();
      expect(suspiciousNode.nodeType).toBe('ImageUpscaleWithModel');

      // Should have affectedSteps
      expect(suspiciousNode.affectedSteps).toBeDefined();
      expect(suspiciousNode.affectedSteps.length).toBeGreaterThan(0);

      // Should affect step 2 (KSampler ID: 378)
      const affectedStep = suspiciousNode.affectedSteps.find(s => s.stepNodeId === '378');
      expect(affectedStep).toBeDefined();
      expect(affectedStep.stepIndex).toBe(2);
    });

    it('should have correct generation steps', async () => {
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

  describe('comfyui_i2i.webp', () => {
    it('should detect suspicious nodes in i2i workflow', async () => {
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

  describe('workflows without suspicious nodes', () => {
    it('should not have suspiciousNodes field for clean workflows', async () => {
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
    it('should work with exclude mode', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'exclude'
      });

      expect(metadata.suspiciousNodes).toBeDefined();
      expect(metadata.suspiciousNodes[0].affectedSteps).toBeDefined();
    });

    it('should work with include mode', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node.webp');
      const buffer = fs.readFileSync(fixturePath);

      const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
        suspiciousNodeHandling: 'include'
      });

      expect(metadata.suspiciousNodes).toBeDefined();
      expect(metadata.suspiciousNodes[0].affectedSteps).toBeDefined();
    });

    it('should work with ask mode (returns suspicious nodes for UI)', async () => {
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
