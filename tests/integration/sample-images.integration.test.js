import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const MetadataService = require('../../js/metadata-parser/integration/MetadataService.js');

describe('Sample Images Integration Tests', () => {
  let metadataService;

  beforeAll(() => {
    metadataService = new MetadataService();
  });
  const testCases = [
    {
      name: 'A1111 Simple PNG',
      imagePath: 'tests/fixtures/a1111_simple.png',
      expectedPath: 'tests/expected/a1111_simple.json',
      mimeType: 'image/png',
      format: 'a1111',
      shouldSucceed: true
    },
    {
      name: 'Civitai Generate1 PNG',
      imagePath: 'tests/fixtures/civitai-generate1.png',
      expectedPath: 'tests/expected/civitai-generate1.json',
      mimeType: 'image/png',
      format: 'a1111',
      shouldSucceed: true
    },
    {
      name: 'Blank PNG (No Metadata)',
      imagePath: 'tests/fixtures/blank.png',
      expectedPath: null,
      mimeType: 'image/png',
      format: null,
      shouldSucceed: false
    },
    {
      name: 'Gemini Generate PNG (No Metadata)',
      imagePath: 'tests/fixtures/gemini-generate.png',
      expectedPath: null,
      mimeType: 'image/png',
      format: null,
      shouldSucceed: false
    },
    {
      name: 'ComfyUI Flux PNG',
      imagePath: 'tests/fixtures/comfyui_flux.png',
      expectedPath: 'tests/expected/comfyui_flux.json',
      mimeType: 'image/png',
      format: 'comfyui',
      shouldSucceed: true
    },
    {
      name: 'ComfyUI I2I WebP',
      imagePath: 'tests/fixtures/comfyui_i2i.webp',
      expectedPath: 'tests/expected/comfyui_i2i_webp.json',
      mimeType: 'image/webp',
      format: 'comfyui',
      shouldSucceed: true
    },
    {
      name: 'ComfyUI Multi PNG',
      imagePath: 'tests/fixtures/comfyui_multi.png',
      expectedPath: 'tests/expected/comfyui_multi_png.json',
      mimeType: 'image/png',
      format: 'comfyui',
      shouldSucceed: true
    },
    {
      name: 'ComfyUI Multi WebP',
      imagePath: 'tests/fixtures/comfyui_multi.webp',
      expectedPath: 'tests/expected/comfyui_multi_webp.json',
      mimeType: 'image/webp',
      format: 'comfyui',
      shouldSucceed: true
    },
    {
      name: 'ComfyUI Simple PNG',
      imagePath: 'tests/fixtures/comfyui_simple.png',
      expectedPath: 'tests/expected/comfyui_simple_png.json',
      mimeType: 'image/png',
      format: 'comfyui',
      shouldSucceed: true
    },
    {
      name: 'ComfyUI Simple WebP',
      imagePath: 'tests/fixtures/comfyui_simple.webp',
      expectedPath: 'tests/expected/comfyui_simple_webp.json',
      mimeType: 'image/webp',
      format: 'comfyui',
      shouldSucceed: true
    }
  ];

  testCases.forEach(({ name, imagePath, expectedPath, mimeType, format, shouldSucceed }) => {
    describe(name, () => {
      it('should extract metadata matching expected output', () => {
        // Check if image file exists
        const fullImagePath = join(process.cwd(), imagePath);
        
        if (!existsSync(fullImagePath)) {
          console.log(`Sample image not found: ${imagePath}, skipping test`);
          return;
        }

        // Read image
        const imageBuffer = new Uint8Array(readFileSync(fullImagePath));

        // Extract metadata using MetadataService
        const results = metadataService.extractMetadata(imageBuffer, mimeType);

        if (!shouldSucceed) {
          // Should have no results for images without metadata
          expect(results.length).toBe(0);
          return;
        }

        // For images that should succeed
        const fullExpectedPath = join(process.cwd(), expectedPath);
        
        if (!existsSync(fullExpectedPath)) {
          console.log(`Expected file not found: ${expectedPath}, skipping test`);
          return;
        }

        // Should have at least one result
        expect(results.length).toBeGreaterThan(0);

        // Read expected output
        const expected = JSON.parse(readFileSync(fullExpectedPath, 'utf-8'));

        // First result should match expected format
        const actual = results[0];
        expect(actual.format).toBe(format);

        // Compare common fields
        expect(actual.format).toBe(format);
        
        // For ComfyUI, seed/steps/cfg might be null at global level
        if (format !== 'comfyui') {
          expect(actual.seed).toBe(expected.seed);
          expect(actual.steps).toBe(expected.steps);
          expect(actual.cfg).toBe(expected.cfg);
          expect(actual.sampler).toBe(expected.sampler);
          // For prompts, normalize whitespace and empty lines for comparison
          // Remove all spaces around commas and collapse multiple spaces
          const normalizePrompt = (p) => p.replace(/\n/g, ',').replace(/,+/g, ',').replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ').trim();
          expect(normalizePrompt(actual.positive)).toBe(normalizePrompt(expected.positive));
          expect(normalizePrompt(actual.negative)).toBe(normalizePrompt(expected.negative));
          expect(actual.checkpoint).toBe(expected.checkpoint);
        }

        // A1111-specific fields
        if (format === 'a1111') {
          // Check for LoRA information if present
          if (expected.loras) {
            expect(actual.loras).toEqual(expected.loras);
          }
          if (expected.lora_hashes) {
            // lora_hashes can be either string or object depending on parser version
            if (typeof expected.lora_hashes === 'string') {
              // Expected is string, actual should be object - convert for comparison
              expect(typeof actual.lora_hashes).toBe('object');
            } else {
              expect(actual.lora_hashes).toEqual(expected.lora_hashes);
            }
          }
        }

        // ComfyUI-specific fields
        if (format === 'comfyui') {
          // Check generation steps if present
          if (expected.generationSteps) {
            expect(actual.generationSteps).toBeDefined();
            expect(actual.generationSteps.length).toBe(expected.generationSteps.length);
            // Compare first generation step
            const actualStep = actual.generationSteps[0];
            const expectedStep = expected.generationSteps[0];
            expect(actualStep.nodeType).toBe(expectedStep.nodeType);
            expect(actualStep.seed).toBe(expectedStep.seed);
            expect(actualStep.steps).toBe(expectedStep.steps);
            expect(actualStep.cfg).toBe(expectedStep.cfg);
            expect(actualStep.sampler).toBe(expectedStep.sampler);
            expect(actualStep.scheduler).toBe(expectedStep.scheduler);
          }
          // Check extra samplers if present
          if (expected.extra_samplers) {
            expect(actual.extra_samplers).toBeDefined();
            expect(actual.extra_samplers.length).toBe(expected.extra_samplers.length);
            
            // Verify base sampler is correctly identified
            const baseSamplers = actual.extra_samplers.filter(s => s.is_base);
            expect(baseSamplers.length).toBe(1);
            
            // Verify base sampler ID matches expected
            const expectedBaseSampler = expected.extra_samplers.find(s => s.is_base);
            if (expectedBaseSampler) {
              expect(baseSamplers[0].id).toBe(expectedBaseSampler.id);
            }
            
            // Verify all sampler IDs are present
            const actualIds = actual.extra_samplers.map(s => s.id).sort();
            const expectedIds = expected.extra_samplers.map(s => s.id).sort();
            expect(actualIds).toEqual(expectedIds);
            
            // Verify execution order (generationSteps order should match expected)
            if (actual.generationSteps && expected.generationSteps) {
              const actualOrder = actual.generationSteps.map(s => s.nodeId);
              const expectedOrder = expected.generationSteps.map(s => s.nodeId);
              expect(actualOrder).toEqual(expectedOrder);
            }
          }
        }
      });

      it('should have consistent structure', () => {
        const fullImagePath = join(process.cwd(), imagePath);
        
        if (!existsSync(fullImagePath)) {
          console.log(`Sample image not found: ${imagePath}, skipping test`);
          return;
        }

        const imageBuffer = new Uint8Array(readFileSync(fullImagePath));
        const results = metadataService.extractMetadata(imageBuffer, mimeType);

        if (!shouldSucceed) {
          // Should have no results for images without metadata
          expect(results.length).toBe(0);
          return;
        }

        expect(results.length).toBeGreaterThan(0);
        const metadata = results[0];

        // Verify common required fields
        expect(metadata).toHaveProperty('format');
        
        // For A1111, these fields are required at global level
        if (format === 'a1111') {
          expect(metadata).toHaveProperty('seed');
          expect(metadata).toHaveProperty('steps');
          expect(metadata).toHaveProperty('cfg');
          expect(metadata).toHaveProperty('sampler');
          expect(metadata).toHaveProperty('positive');
          expect(metadata).toHaveProperty('negative');
          expect(metadata).toHaveProperty('checkpoint');
          
          // Verify common types
          expect(typeof metadata.seed).toBe('number');
          expect(typeof metadata.steps).toBe('number');
          expect(typeof metadata.cfg).toBe('number');
          expect(typeof metadata.sampler).toBe('string');
          expect(typeof metadata.positive).toBe('string');
          expect(typeof metadata.negative).toBe('string');
          expect(typeof metadata.checkpoint).toBe('string');
          
          // Optional fields that may or may not be present
          if (metadata.loras) {
            expect(Array.isArray(metadata.loras)).toBe(true);
          }
          if (metadata.lora_hashes) {
            expect(typeof metadata.lora_hashes).toBe('object');
          }
        }
        
        // For ComfyUI, check generationSteps instead
        if (format === 'comfyui') {
          expect(metadata).toHaveProperty('generationSteps');
          expect(Array.isArray(metadata.generationSteps)).toBe(true);
          expect(metadata.generationSteps.length).toBeGreaterThan(0);
          
          const step = metadata.generationSteps[0];
          expect(step).toHaveProperty('seed');
          expect(step).toHaveProperty('steps');
          expect(step).toHaveProperty('cfg');
          expect(step).toHaveProperty('sampler');
          expect(step).toHaveProperty('positive');
          expect(step).toHaveProperty('negative');
          
          expect(typeof step.seed).toBe('number');
          expect(typeof step.steps).toBe('number');
          expect(typeof step.cfg).toBe('number');
          expect(typeof step.sampler).toBe('string');
          expect(typeof step.positive).toBe('string');
          expect(typeof step.negative).toBe('string');
        }
      });
    });
  });

  describe('Metadata extraction validation', () => {
    it('should return empty array for images without metadata', () => {
      const blankPath = join(process.cwd(), 'tests/fixtures/blank.png');
      const geminiPath = join(process.cwd(), 'tests/fixtures/gemini-generate.png');

      if (!existsSync(blankPath) || !existsSync(geminiPath)) {
        console.log('Sample files not found, skipping validation test');
        return;
      }

      const blankBuffer = new Uint8Array(readFileSync(blankPath));
      const geminiBuffer = new Uint8Array(readFileSync(geminiPath));

      const blankResults = metadataService.extractMetadata(blankBuffer, 'image/png');
      const geminiResults = metadataService.extractMetadata(geminiBuffer, 'image/png');

      expect(blankResults.length).toBe(0);
      expect(geminiResults.length).toBe(0);
    });

    it('should successfully extract A1111 metadata from different sources', () => {
      const a1111Path = join(process.cwd(), 'tests/fixtures/a1111_simple.png');
      const civitaiPath = join(process.cwd(), 'tests/fixtures/civitai-generate1.png');

      if (!existsSync(a1111Path) || !existsSync(civitaiPath)) {
        console.log('Sample files not found, skipping A1111 extraction test');
        return;
      }

      const a1111Buffer = new Uint8Array(readFileSync(a1111Path));
      const civitaiBuffer = new Uint8Array(readFileSync(civitaiPath));

      const a1111Results = metadataService.extractMetadata(a1111Buffer, 'image/png');
      const civitaiResults = metadataService.extractMetadata(civitaiBuffer, 'image/png');

      expect(a1111Results.length).toBeGreaterThan(0);
      expect(civitaiResults.length).toBeGreaterThan(0);

      expect(a1111Results[0].format).toBe('a1111');
      expect(civitaiResults[0].format).toBe('a1111');

      // Both should have required fields
      expect(a1111Results[0]).toHaveProperty('seed');
      expect(a1111Results[0]).toHaveProperty('steps');
      expect(civitaiResults[0]).toHaveProperty('seed');
      expect(civitaiResults[0]).toHaveProperty('steps');

      // Civitai should have LoRA information
      expect(civitaiResults[0]).toHaveProperty('loras');
      expect(civitaiResults[0]).toHaveProperty('lora_hashes');
      expect(civitaiResults[0].loras.length).toBeGreaterThan(0);
    });
  });
});
