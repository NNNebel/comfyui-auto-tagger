import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import MetadataService from '../../js/metadata-parser/integration/MetadataService.js';
import TagGenerator from '../../js/metadata-processor/TagGenerator.js';

describe('Tag Generation Integration Tests', () => {
  describe('Multi-sampler workflows - includeAllSamplers: true', () => {
    it('should generate tags from all samplers in comfyui_multi.webp', async () => {
      const imagePath = path.join(process.cwd(), 'tests/fixtures/comfyui_multi.webp');
      
      // Skip if fixture doesn't exist
      if (!fs.existsSync(imagePath)) {
        console.warn('Skipping test: comfyui_multi.webp not found');
        return;
      }
      
      const buffer = fs.readFileSync(imagePath);
      
      // Parse metadata
      const service = new MetadataService();
      const results = await service.extractMetadata(buffer, 'image/webp');
      
      expect(results).toHaveLength(1);
      const metadata = results[0];
      
      // Verify generationSteps exists
      expect(metadata.generationSteps).toBeDefined();
      expect(metadata.generationSteps).toHaveLength(4);
      
      // Generate tags with includeAllSamplers: true
      const settings = {
        checkpoint: true,
        lora: true,
        positive: true,
        negative: true,
        seed: true,
        steps: true,
        cfg: true,
        sampler: true,
        includeAllSamplers: true  // Include all samplers
      };
      
      const result = TagGenerator.generate(metadata, settings);
      
      // Verify all seeds are present
      expect(result.tags.has('seed:111111')).toBe(true);
      expect(result.tags.has('seed:222222')).toBe(true);
      expect(result.tags.has('seed:333333')).toBe(true);
      expect(result.tags.has('seed:444444')).toBe(true);
      
      // Verify all unique steps values are present
      expect(result.tags.has('steps:30')).toBe(true);
      expect(result.tags.has('steps:20')).toBe(true);
      expect(result.tags.has('steps:2')).toBe(true);
      
      // Verify all unique cfg values are present
      expect(result.tags.has('cfg:6.00')).toBe(true);
      expect(result.tags.has('cfg:7.00')).toBe(true);
      expect(result.tags.has('cfg:2.00')).toBe(true);
      
      // Verify sampler is present
      expect(result.tags.has('sampler:dpmpp_2m')).toBe(true);
      
      // Verify checkpoint and LoRA tags
      expect(result.tags.has('boleromixillustrious_v700')).toBe(true);
      expect(result.tags.has('little red riding hood_illustrious_v1.0')).toBe(true);
      expect(result.tags.has('choker_illustrious_v1.0')).toBe(true);
      
      // Verify some prompt tags from different steps
      expect(result.tags.has('masterpiece')).toBe(true);
      expect(result.tags.has('beautiful eyes')).toBe(true);
      expect(result.tags.has('super resolution')).toBe(true); // From step 2
      expect(result.tags.has('amazing quality')).toBe(true); // From step 3
      expect(result.tags.has('4 sampler positive pronpt')).toBe(true); // From step 4
      
      // Verify negative tags
      expect(result.tags.has('neg:worst quality')).toBe(true);
      expect(result.tags.has('neg:character sheet')).toBe(true); // From step 2
      expect(result.tags.has('neg:curvy')).toBe(true); // From step 3
    });

    it('should generate tags from all samplers in comfyui_multi.png', async () => {
      const imagePath = path.join(process.cwd(), 'tests/fixtures/comfyui_multi.png');
      
      // Skip if fixture doesn't exist
      if (!fs.existsSync(imagePath)) {
        console.warn('Skipping test: comfyui_multi.png not found');
        return;
      }
      
      const buffer = fs.readFileSync(imagePath);
      
      // Parse metadata
      const service = new MetadataService();
      const results = await service.extractMetadata(buffer, 'image/png');
      
      expect(results).toHaveLength(1);
      const metadata = results[0];
      
      // Verify generationSteps exists
      expect(metadata.generationSteps).toBeDefined();
      expect(metadata.generationSteps).toHaveLength(4);
      
      // Generate tags with includeAllSamplers: true
      const settings = {
        seed: true,
        steps: true,
        cfg: true,
        sampler: true,
        includeAllSamplers: true  // Include all samplers
      };
      
      const result = TagGenerator.generate(metadata, settings);
      
      // Verify all seeds are present
      expect(result.tags.has('seed:111111')).toBe(true);
      expect(result.tags.has('seed:222222')).toBe(true);
      expect(result.tags.has('seed:333333')).toBe(true);
      expect(result.tags.has('seed:444444')).toBe(true);
      
      // Verify all unique cfg values are present
      expect(result.tags.has('cfg:6.00')).toBe(true);
      expect(result.tags.has('cfg:7.00')).toBe(true);
      expect(result.tags.has('cfg:2.00')).toBe(true);
    });
  });

  describe('Multi-sampler workflows - includeAllSamplers: false (default)', () => {
    it('should generate tags from first sampler only in comfyui_multi.webp', async () => {
      const imagePath = path.join(process.cwd(), 'tests/fixtures/comfyui_multi.webp');
      
      // Skip if fixture doesn't exist
      if (!fs.existsSync(imagePath)) {
        console.warn('Skipping test: comfyui_multi.webp not found');
        return;
      }
      
      const buffer = fs.readFileSync(imagePath);
      
      // Parse metadata
      const service = new MetadataService();
      const results = await service.extractMetadata(buffer, 'image/webp');
      
      expect(results).toHaveLength(1);
      const metadata = results[0];
      
      // Verify generationSteps exists
      expect(metadata.generationSteps).toBeDefined();
      expect(metadata.generationSteps).toHaveLength(4);
      
      // Generate tags with includeAllSamplers: false (default)
      const settings = {
        positive: true,
        negative: true,
        seed: true,
        steps: true,
        cfg: true,
        sampler: true,
        includeAllSamplers: false  // First sampler only
      };
      
      const result = TagGenerator.generate(metadata, settings);
      
      // Only first sampler's parameters should be present
      expect(result.tags.has('seed:111111')).toBe(true);
      expect(result.tags.has('seed:222222')).toBe(false);
      expect(result.tags.has('seed:333333')).toBe(false);
      expect(result.tags.has('seed:444444')).toBe(false);
      
      expect(result.tags.has('steps:30')).toBe(true);
      expect(result.tags.has('steps:20')).toBe(false);
      expect(result.tags.has('steps:2')).toBe(false);
      
      expect(result.tags.has('cfg:6.00')).toBe(true);
      expect(result.tags.has('cfg:7.00')).toBe(false);
      expect(result.tags.has('cfg:2.00')).toBe(false);
      
      expect(result.tags.has('sampler:dpmpp_2m')).toBe(true);
      
      // Prompts should still include all steps (not affected by includeAllSamplers)
      expect(result.tags.has('masterpiece')).toBe(true);
      expect(result.tags.has('super resolution')).toBe(true);
      expect(result.tags.has('amazing quality')).toBe(true);
    });

    it('should generate tags from first sampler only in comfyui_multi.png', async () => {
      const imagePath = path.join(process.cwd(), 'tests/fixtures/comfyui_multi.png');
      
      // Skip if fixture doesn't exist
      if (!fs.existsSync(imagePath)) {
        console.warn('Skipping test: comfyui_multi.png not found');
        return;
      }
      
      const buffer = fs.readFileSync(imagePath);
      
      // Parse metadata
      const service = new MetadataService();
      const results = await service.extractMetadata(buffer, 'image/png');
      
      expect(results).toHaveLength(1);
      const metadata = results[0];
      
      // Generate tags with includeAllSamplers: false (default)
      const settings = {
        seed: true,
        steps: true,
        cfg: true,
        sampler: true,
        includeAllSamplers: false  // First sampler only
      };
      
      const result = TagGenerator.generate(metadata, settings);
      
      // Only first sampler's parameters
      expect(result.tags.has('seed:111111')).toBe(true);
      expect(result.tags.has('seed:222222')).toBe(false);
      expect(result.tags.has('seed:333333')).toBe(false);
      expect(result.tags.has('seed:444444')).toBe(false);
    });
  });

  describe('Simple workflows', () => {
    it('should generate tags from base sampler in comfyui_simple.png', async () => {
      const imagePath = path.join(process.cwd(), 'tests/fixtures/comfyui_simple.png');
      
      // Skip if fixture doesn't exist
      if (!fs.existsSync(imagePath)) {
        console.warn('Skipping test: comfyui_simple.png not found');
        return;
      }
      
      const buffer = fs.readFileSync(imagePath);
      
      // Parse metadata
      const service = new MetadataService();
      const results = await service.extractMetadata(buffer, 'image/png');
      
      expect(results).toHaveLength(1);
      const metadata = results[0];
      
      // Generate tags (includeAllSamplers doesn't matter for simple workflows)
      const settings = {
        seed: true,
        steps: true,
        cfg: true,
        sampler: true,
        includeAllSamplers: false
      };
      
      const result = TagGenerator.generate(metadata, settings);
      
      // Verify base sampler parameters are present
      expect(result.cats.param.size).toBeGreaterThan(0);
      
      // Should have exactly one seed, steps, cfg, sampler
      const seedTags = [...result.tags].filter(t => t.startsWith('seed:'));
      const stepsTags = [...result.tags].filter(t => t.startsWith('steps:'));
      const cfgTags = [...result.tags].filter(t => t.startsWith('cfg:'));
      const samplerTags = [...result.tags].filter(t => t.startsWith('sampler:'));
      
      expect(seedTags.length).toBe(1);
      expect(stepsTags.length).toBe(1);
      expect(cfgTags.length).toBe(1);
      expect(samplerTags.length).toBe(1);
    });
  });
});
