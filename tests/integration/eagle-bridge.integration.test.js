/**
 * eagle-bridge.integration.test.js
 *
 * Integration tests for the eagle_bridge deterministic tracing path.
 * Tests the complete pipeline: binary PNG buffer → ImageMetadataReader
 * → eagle_bridge detection → ComfyUIParser → deterministic ancestor tracing.
 *
 * These tests use synthetic PNG buffers built with createPngWithMetadata()
 * so they don't require external fixture files.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';
import { createPngWithMetadata } from '../helpers/createSampleImages.js';

const require = createRequire(import.meta.url);
const MetadataService = require('../../js/metadata-parser/integration/MetadataService.js');

// ---------------------------------------------------------------------------
// Shared workflow definitions
// ---------------------------------------------------------------------------

/** Simple single-pipeline workflow */
const SIMPLE_PROMPT = {
  '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'dreamshaper_8.safetensors' } },
  '2': { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: 'a cat in a garden' } },
  '3': { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: 'blurry, ugly' } },
  '4': {
    class_type: 'KSampler',
    inputs: {
      model: ['1', 0], positive: ['2', 0], negative: ['3', 0],
      latent_image: ['1', 3],
      seed: 12345, steps: 20, cfg: 7, sampler_name: 'euler', scheduler: 'normal'
    }
  },
  '5': { class_type: 'VAEDecode', inputs: { samples: ['4', 0], vae: ['1', 2] } },
  '6': { class_type: 'SaveImage', inputs: { images: ['5', 0] } }
};

/** Dual-pipeline workflow – two independent generation chains */
const DUAL_PROMPT = {
  // Pipeline A
  '10': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'pipelineA.safetensors' } },
  '11': { class_type: 'CLIPTextEncode', inputs: { clip: ['10', 1], text: 'pipeline A positive' } },
  '12': { class_type: 'CLIPTextEncode', inputs: { clip: ['10', 1], text: 'pipeline A negative' } },
  '13': {
    class_type: 'KSampler',
    inputs: {
      model: ['10', 0], positive: ['11', 0], negative: ['12', 0],
      latent_image: ['10', 3], seed: 111, steps: 10, cfg: 6, sampler_name: 'dpm_2', scheduler: 'karras'
    }
  },
  '14': { class_type: 'VAEDecode', inputs: { samples: ['13', 0], vae: ['10', 2] } },
  '15': { class_type: 'SaveImage', inputs: { images: ['14', 0] } },

  // Pipeline B
  '20': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'pipelineB.safetensors' } },
  '21': { class_type: 'CLIPTextEncode', inputs: { clip: ['20', 1], text: 'pipeline B positive' } },
  '22': { class_type: 'CLIPTextEncode', inputs: { clip: ['20', 1], text: 'pipeline B negative' } },
  '23': {
    class_type: 'KSampler',
    inputs: {
      model: ['20', 0], positive: ['21', 0], negative: ['22', 0],
      latent_image: ['20', 3], seed: 222, steps: 30, cfg: 9, sampler_name: 'euler_a', scheduler: 'normal'
    }
  },
  '24': { class_type: 'VAEDecode', inputs: { samples: ['23', 0], vae: ['20', 2] } },
  '25': { class_type: 'SaveImage', inputs: { images: ['24', 0] } }
};

/** Hi-res fix workflow – two samplers in series (base → hires) */
const HIRESFIX_PROMPT = {
  '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'realvisxl.safetensors' } },
  '2': { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: 'a mountain landscape' } },
  '3': { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: 'low quality' } },
  // EmptyLatentImage as source
  '4': { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 512, batch_size: 1 } },
  // Base sampler
  '5': {
    class_type: 'KSampler',
    inputs: {
      model: ['1', 0], positive: ['2', 0], negative: ['3', 0],
      latent_image: ['4', 0], seed: 999, steps: 20, cfg: 7, sampler_name: 'euler', scheduler: 'normal'
    }
  },
  // Upscale chain
  '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
  '7': { class_type: 'ImageScaleBy', inputs: { image: ['6', 0], scale_by: 2.0 } },
  '8': { class_type: 'VAEEncode', inputs: { pixels: ['7', 0], vae: ['1', 2] } },
  // Hires sampler
  '9': {
    class_type: 'KSampler',
    inputs: {
      model: ['1', 0], positive: ['2', 0], negative: ['3', 0],
      latent_image: ['8', 0], seed: 999, steps: 10, cfg: 7, sampler_name: 'euler', scheduler: 'normal'
    }
  },
  '10': { class_type: 'VAEDecode', inputs: { samples: ['9', 0], vae: ['1', 2] } },
  '11': { class_type: 'SaveImage', inputs: { images: ['10', 0] } }
};

// ---------------------------------------------------------------------------
// Helper: build a PNG buffer with eagle_bridge metadata
// ---------------------------------------------------------------------------
function buildEagleBridgePng(promptData, finalNodeId, extraChunks = []) {
  return createPngWithMetadata([
    { keyword: 'prompt', text: JSON.stringify(promptData) },
    { keyword: 'eagle_bridge', text: JSON.stringify({ version: 1, final_node_id: String(finalNodeId) }) },
    ...extraChunks
  ]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('eagle_bridge integration – full MetadataService pipeline', () => {
  let service;

  beforeAll(() => {
    service = new MetadataService();
  });

  // -----------------------------------------------------------------------
  // Basic extraction
  // -----------------------------------------------------------------------
  describe('basic extraction through MetadataService', () => {
    it('extracts comfyui format from PNG with eagle_bridge chunk', () => {
      const buffer = buildEagleBridgePng(SIMPLE_PROMPT, '6');
      const results = service.extractMetadata(buffer, 'image/png');
      expect(results).toBeDefined();
      const comfy = results.find(r => r.format === 'comfyui');
      expect(comfy).toBeDefined();
    });

    it('extracts checkpoint correctly from eagle_bridge PNG', () => {
      const buffer = buildEagleBridgePng(SIMPLE_PROMPT, '6');
      const results = service.extractMetadata(buffer, 'image/png');
      const comfy = results.find(r => r.format === 'comfyui');
      expect(comfy.checkpoint).toBe('dreamshaper_8.safetensors');
    });

    it('extracts sampler parameters correctly', () => {
      const buffer = buildEagleBridgePng(SIMPLE_PROMPT, '6');
      const results = service.extractMetadata(buffer, 'image/png');
      const comfy = results.find(r => r.format === 'comfyui');
      expect(comfy.seed).toBe(12345);
      expect(comfy.steps).toBe(20);
      expect(comfy.cfg).toBe(7);
      expect(comfy.sampler).toBe('euler');
      expect(comfy.scheduler).toBe('normal');
    });

    it('extracts positive and negative prompts', () => {
      const buffer = buildEagleBridgePng(SIMPLE_PROMPT, '6');
      const results = service.extractMetadata(buffer, 'image/png');
      const comfy = results.find(r => r.format === 'comfyui');
      expect(comfy.positive).toContain('a cat in a garden');
      expect(comfy.negative).toContain('blurry, ugly');
    });
  });

  // -----------------------------------------------------------------------
  // Deterministic pipeline selection (dual pipeline)
  // -----------------------------------------------------------------------
  describe('deterministic pipeline selection', () => {
    it('selects pipeline A when eagle_bridge points to pipeline A output', () => {
      const buffer = buildEagleBridgePng(DUAL_PROMPT, '15');
      const results = service.extractMetadata(buffer, 'image/png');
      const comfy = results.find(r => r.format === 'comfyui');
      expect(comfy.seed).toBe(111);
      expect(comfy.steps).toBe(10);
      expect(comfy.sampler).toBe('dpm_2');
      expect(comfy.checkpoint).toBe('pipelineA.safetensors');
      expect(comfy.positive).toContain('pipeline A positive');
    });

    it('selects pipeline B when eagle_bridge points to pipeline B output', () => {
      const buffer = buildEagleBridgePng(DUAL_PROMPT, '25');
      const results = service.extractMetadata(buffer, 'image/png');
      const comfy = results.find(r => r.format === 'comfyui');
      expect(comfy.seed).toBe(222);
      expect(comfy.steps).toBe(30);
      expect(comfy.sampler).toBe('euler_a');
      expect(comfy.checkpoint).toBe('pipelineB.safetensors');
      expect(comfy.positive).toContain('pipeline B positive');
    });

    it('pipeline A result does NOT contain pipeline B metadata', () => {
      const buffer = buildEagleBridgePng(DUAL_PROMPT, '15');
      const results = service.extractMetadata(buffer, 'image/png');
      const comfy = results.find(r => r.format === 'comfyui');
      // Should not have pipeline B data
      expect(comfy.seed).not.toBe(222);
      expect(comfy.checkpoint).not.toBe('pipelineB.safetensors');
      expect(comfy.positive).not.toContain('pipeline B');
    });

    it('pipeline B result does NOT contain pipeline A metadata', () => {
      const buffer = buildEagleBridgePng(DUAL_PROMPT, '25');
      const results = service.extractMetadata(buffer, 'image/png');
      const comfy = results.find(r => r.format === 'comfyui');
      expect(comfy.seed).not.toBe(111);
      expect(comfy.checkpoint).not.toBe('pipelineA.safetensors');
      expect(comfy.positive).not.toContain('pipeline A');
    });
  });

  // -----------------------------------------------------------------------
  // Hi-res fix workflow – base sampler selection
  // -----------------------------------------------------------------------
  describe('hi-res fix workflow', () => {
    it('selects the base sampler (closest to EmptyLatentImage) in a hires-fix workflow', () => {
      const buffer = buildEagleBridgePng(HIRESFIX_PROMPT, '11');
      const results = service.extractMetadata(buffer, 'image/png');
      const comfy = results.find(r => r.format === 'comfyui');
      // Node '5' is base (latent from EmptyLatentImage), node '9' is hires
      // Base has steps=20, hires has steps=10
      expect(comfy.steps).toBe(20);
      expect(comfy.seed).toBe(999);
    });

    it('reports both samplers in generationSteps', () => {
      const buffer = buildEagleBridgePng(HIRESFIX_PROMPT, '11');
      const results = service.extractMetadata(buffer, 'image/png');
      const comfy = results.find(r => r.format === 'comfyui');
      // Should have 2 generation steps (base + hires)
      expect(comfy.generationSteps).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------------
  // Fallback: no eagle_bridge chunk → heuristic mode
  // -----------------------------------------------------------------------
  describe('heuristic fallback when eagle_bridge is absent', () => {
    it('still extracts metadata when no eagle_bridge chunk is present', () => {
      const buffer = createPngWithMetadata([
        { keyword: 'prompt', text: JSON.stringify(SIMPLE_PROMPT) }
      ]);
      const results = service.extractMetadata(buffer, 'image/png');
      const comfy = results.find(r => r.format === 'comfyui');
      expect(comfy).toBeDefined();
      expect(comfy.format).toBe('comfyui');
    });

    it('heuristic mode extracts some metadata from dual-pipeline without eagle_bridge', () => {
      const buffer = createPngWithMetadata([
        { keyword: 'prompt', text: JSON.stringify(DUAL_PROMPT) }
      ]);
      const results = service.extractMetadata(buffer, 'image/png');
      const comfy = results.find(r => r.format === 'comfyui');
      // Heuristic picks one sampler – just verify it doesn't crash
      expect(comfy).toBeDefined();
      expect([111, 222]).toContain(comfy.seed);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles eagle_bridge with final_node_id pointing to a non-existent node', () => {
      const buffer = buildEagleBridgePng(SIMPLE_PROMPT, '999'); // node 999 doesn't exist
      expect(() => service.extractMetadata(buffer, 'image/png')).not.toThrow();
    });

    it('handles eagle_bridge chunk with missing final_node_id field', () => {
      const buffer = createPngWithMetadata([
        { keyword: 'prompt', text: JSON.stringify(SIMPLE_PROMPT) },
        { keyword: 'eagle_bridge', text: JSON.stringify({ version: 1 }) }
      ]);
      expect(() => service.extractMetadata(buffer, 'image/png')).not.toThrow();
      const results = service.extractMetadata(buffer, 'image/png');
      // Falls back to heuristic
      const comfy = results.find(r => r.format === 'comfyui');
      expect(comfy).toBeDefined();
    });

    it('isFallback is false when eagle_bridge successfully resolves a sampler', () => {
      const buffer = buildEagleBridgePng(SIMPLE_PROMPT, '6');
      const results = service.extractMetadata(buffer, 'image/png');
      const comfy = results.find(r => r.format === 'comfyui');
      expect(comfy.sampler_fallback).toBe(false);
    });
  });
});
