import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Import modules
const ComfyUIParser = require('../../js/metadata-parser/parsers/ComfyUIParser.js');
const ComfyUIGraph = require('../../js/metadata-parser/graph/ComfyUIGraph.js');
const ComfyUISamplerAnalyzer = require('../../js/metadata-parser/graph/ComfyUISamplerAnalyzer.js');
const ImageMetadataReader = require('../../js/metadata-parser/binary-extraction/ImageMetadataReader.js');

// Helper function to check if fixture file exists
function fixtureExists(filename) {
  const fixturePath = path.join(__dirname, '../fixtures', filename);
  return fs.existsSync(fixturePath);
}

describe('Suspicious Nodes - Affected Steps Detection', () => {
  let parser;

  beforeEach(() => {
    parser = new ComfyUIParser();
  });

  describe('affectedSteps field in suspicious nodes', () => {
    it.skipIf(!fixtureExists('comfyui_suspicious_node_dualpath.webp'))('should include affectedSteps when suspicious nodes are detected', () => {
      // Load test fixture with suspicious nodes from actual image
      const imageBuffer = fs.readFileSync(path.join(__dirname, '../fixtures/comfyui_suspicious_node_dualpath.webp'));
      const rawMetadata = ImageMetadataReader.extractRawMetadata(imageBuffer, 'image/webp');
      const fixtureData = typeof rawMetadata.prompt === 'string' ? JSON.parse(rawMetadata.prompt) : rawMetadata.prompt;

      const metadata = {};
      parser.extractFromPrompt(fixtureData, metadata, { suspiciousNodeHandling: 'exclude' });

      // Should have suspicious nodes
      expect(metadata.suspiciousNodes).toBeDefined();
      expect(metadata.suspiciousNodes.length).toBeGreaterThan(0);

      // Each suspicious node should have affectedSteps if it affects any steps
      metadata.suspiciousNodes.forEach(node => {
        if (node.affectedSteps) {
          expect(Array.isArray(node.affectedSteps)).toBe(true);
          node.affectedSteps.forEach(step => {
            expect(step).toHaveProperty('stepIndex');
            expect(step).toHaveProperty('stepNodeId');
            expect(step).toHaveProperty('stepNodeType');
            expect(typeof step.stepIndex).toBe('number');
            expect(typeof step.stepNodeId).toBe('string');
            expect(typeof step.stepNodeType).toBe('string');
          });
        }
      });
    });

    it.skipIf(!fixtureExists('comfyui_suspicious_node_dualpath.webp'))('should correctly identify which steps are affected by suspicious nodes', () => {
      // Load comfyui_suspicious_node fixture from actual image
      const imageBuffer = fs.readFileSync(path.join(__dirname, '../fixtures/comfyui_suspicious_node_dualpath.webp'));
      const rawMetadata = ImageMetadataReader.extractRawMetadata(imageBuffer, 'image/webp');
      const fixtureData = typeof rawMetadata.prompt === 'string' ? JSON.parse(rawMetadata.prompt) : rawMetadata.prompt;

      const metadata = {};
      parser.extractFromPrompt(fixtureData, metadata, { suspiciousNodeHandling: 'exclude' });

      // Find the suspicious node (ImageUpscaleWithModel ID: 171)
      const suspiciousNode = metadata.suspiciousNodes.find(n => n.nodeId === '171');
      expect(suspiciousNode).toBeDefined();

      // Should have affectedSteps
      expect(suspiciousNode.affectedSteps).toBeDefined();
      expect(suspiciousNode.affectedSteps.length).toBeGreaterThan(0);

      // Should affect step 2 (KSampler ID: 32)
      const affectedStep = suspiciousNode.affectedSteps.find(s => s.stepNodeId === '32');
      expect(affectedStep).toBeDefined();
      expect(affectedStep.stepIndex).toBe(2);
      expect(affectedStep.stepNodeType).toContain('Sampler');
    });

    it('should not include affectedSteps if no steps are affected', () => {
      // Create a workflow where suspicious node doesn't affect any samplers
      const isolatedWorkflow = {
        "1": {
          "class_type": "CheckpointLoaderSimple",
          "inputs": { "ckpt_name": "test.safetensors" }
        },
        "2": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 123,
            "steps": 20,
            "cfg": 7,
            "sampler_name": "euler",
            "scheduler": "normal",
            "model": ["1", 0],
            "positive": ["3", 0],
            "negative": ["4", 0],
            "latent_image": ["5", 0]
          }
        },
        "3": { "class_type": "CLIPTextEncode", "inputs": { "text": "test", "clip": ["1", 1] } },
        "4": { "class_type": "CLIPTextEncode", "inputs": { "text": "bad", "clip": ["1", 1] } },
        "5": { "class_type": "EmptyLatentImage", "inputs": { "width": 512, "height": 512 } },
        "6": {
          "class_type": "ImageUpscaleWithModel",
          "inputs": {
            // No image input - suspicious node, but isolated from sampler
            "upscale_model": ["7", 0]
          }
        },
        "7": { "class_type": "UpscaleModelLoader", "inputs": { "model_name": "test.pth" } }
      };

      const metadata = {};
      parser.extractFromPrompt(isolatedWorkflow, metadata, { suspiciousNodeHandling: 'exclude' });

      // Should have suspicious node
      const suspiciousNode = metadata.suspiciousNodes?.find(n => n.nodeId === '6');
      if (suspiciousNode) {
        // Should not have affectedSteps or have empty array
        expect(suspiciousNode.affectedSteps === undefined || suspiciousNode.affectedSteps.length === 0).toBe(true);
      }
    });
  });

  describe('integration with suspiciousNodeHandling options', () => {
    it.skipIf(!fixtureExists('comfyui_suspicious_node_dualpath.webp'))('should include affectedSteps regardless of handling mode', () => {
      // Load from actual image
      const imageBuffer = fs.readFileSync(path.join(__dirname, '../fixtures/comfyui_suspicious_node_dualpath.webp'));
      const rawMetadata = ImageMetadataReader.extractRawMetadata(imageBuffer, 'image/webp');
      const fixtureData = typeof rawMetadata.prompt === 'string' ? JSON.parse(rawMetadata.prompt) : rawMetadata.prompt;

      // Test with 'exclude' mode
      const metadataExclude = {};
      parser.extractFromPrompt(fixtureData, metadataExclude, { suspiciousNodeHandling: 'exclude' });
      expect(metadataExclude.suspiciousNodes).toBeDefined();
      expect(metadataExclude.suspiciousNodes[0].affectedSteps).toBeDefined();

      // Test with 'include' mode
      const metadataInclude = {};
      parser.extractFromPrompt(fixtureData, metadataInclude, { suspiciousNodeHandling: 'include' });
      expect(metadataInclude.suspiciousNodes).toBeDefined();
      expect(metadataInclude.suspiciousNodes[0].affectedSteps).toBeDefined();
    });

    it.skipIf(!fixtureExists('comfyui_suspicious_node_dualpath.webp'))('should work with overrides', () => {
      // Load from actual image
      const imageBuffer = fs.readFileSync(path.join(__dirname, '../fixtures/comfyui_suspicious_node_dualpath.webp'));
      const rawMetadata = ImageMetadataReader.extractRawMetadata(imageBuffer, 'image/webp');
      const fixtureData = typeof rawMetadata.prompt === 'string' ? JSON.parse(rawMetadata.prompt) : rawMetadata.prompt;

      const metadata = {};
      parser.extractFromPrompt(fixtureData, metadata, {
        suspiciousNodeHandling: 'exclude',
        overrides: {
          '171': { forceInclude: true }
        }
      });

      // Suspicious node should still be reported with affectedSteps
      const suspiciousNode = metadata.suspiciousNodes?.find(n => n.nodeId === '171');
      if (suspiciousNode) {
        expect(suspiciousNode.affectedSteps).toBeDefined();
      }
    });
  });

  describe('multiple suspicious nodes affecting different steps', () => {
    it('should correctly map each suspicious node to its affected steps', () => {
      // Create workflow with multiple suspicious nodes affecting different samplers
      const multiSuspiciousWorkflow = {
        "1": {
          "class_type": "CheckpointLoaderSimple",
          "inputs": { "ckpt_name": "test.safetensors" }
        },
        "2": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 123,
            "steps": 20,
            "cfg": 7,
            "sampler_name": "euler",
            "scheduler": "normal",
            "model": ["1", 0],
            "positive": ["3", 0],
            "negative": ["4", 0],
            "latent_image": ["5", 0]
          }
        },
        "3": { "class_type": "CLIPTextEncode", "inputs": { "text": "test", "clip": ["1", 1] } },
        "4": { "class_type": "CLIPTextEncode", "inputs": { "text": "bad", "clip": ["1", 1] } },
        "5": { "class_type": "EmptyLatentImage", "inputs": { "width": 512, "height": 512 } },
        "6": {
          "class_type": "KSampler",
          "inputs": {
            "seed": 456,
            "steps": 30,
            "cfg": 8,
            "sampler_name": "dpmpp_2m",
            "scheduler": "karras",
            "model": ["1", 0],
            "positive": ["3", 0],
            "negative": ["4", 0],
            "latent_image": ["2", 0]
          }
        },
        "7": {
          "class_type": "ImageUpscaleWithModel",
          "inputs": {
            // No image input - affects sampler 2
            "upscale_model": ["8", 0]
          }
        },
        "8": { "class_type": "UpscaleModelLoader", "inputs": { "model_name": "test.pth" } }
      };

      const metadata = {};
      parser.extractFromPrompt(multiSuspiciousWorkflow, metadata, { suspiciousNodeHandling: 'exclude' });

      if (metadata.suspiciousNodes && metadata.suspiciousNodes.length > 0) {
        // Each suspicious node should have its own affectedSteps
        metadata.suspiciousNodes.forEach(node => {
          if (node.affectedSteps) {
            // Verify step indices are valid
            node.affectedSteps.forEach(step => {
              expect(step.stepIndex).toBeGreaterThan(0);
              expect(step.stepIndex).toBeLessThanOrEqual(metadata.generationSteps.length);
            });
          }
        });
      }
    });
  });
});
