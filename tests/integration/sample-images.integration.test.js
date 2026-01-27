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
      name: 'ComfyUI Simple PNG',
      imagePath: 'tests/samples/comfyui_simple.png',
      expectedPath: 'tests/expected/sample/comfyui_simple_png.json',
      mimeType: 'image/png',
      format: 'comfyui'
    },
    {
      name: 'ComfyUI Simple WebP',
      imagePath: 'tests/samples/comfyui_simple.webp',
      expectedPath: 'tests/expected/sample/comfyui_simple_webp.json',
      mimeType: 'image/webp',
      format: 'comfyui'
    },
    {
      name: 'ComfyUI Multi PNG',
      imagePath: 'tests/samples/comfyui_multi.png',
      expectedPath: 'tests/expected/sample/comfyui_multi_png.json',
      mimeType: 'image/png',
      format: 'comfyui'
    },
    {
      name: 'ComfyUI Multi WebP',
      imagePath: 'tests/samples/comfyui_multi.webp',
      expectedPath: 'tests/expected/sample/comfyui_multi_webp.json',
      mimeType: 'image/webp',
      format: 'comfyui'
    },
    {
      name: 'A1111 Simple PNG',
      imagePath: 'tests/samples/a1111_simple.png',
      expectedPath: 'tests/expected/sample/a1111_simple.json',
      mimeType: 'image/png',
      format: 'a1111'
    }
  ];

  testCases.forEach(({ name, imagePath, expectedPath, mimeType, format }) => {
    describe(name, () => {
      it('should extract metadata matching expected output', () => {
        // Check if files exist
        const fullImagePath = join(process.cwd(), imagePath);
        const fullExpectedPath = join(process.cwd(), expectedPath);
        
        if (!existsSync(fullImagePath)) {
          console.log(`Sample image not found: ${imagePath}, skipping test`);
          return;
        }
        
        if (!existsSync(fullExpectedPath)) {
          console.log(`Expected file not found: ${expectedPath}, skipping test`);
          return;
        }

        // Read image and expected output
        const imageBuffer = new Uint8Array(readFileSync(fullImagePath));
        const expected = JSON.parse(readFileSync(fullExpectedPath, 'utf-8'));

        // Extract metadata using MetadataService
        const results = metadataService.extractMetadata(imageBuffer, mimeType);

        // Should have at least one result
        expect(results.length).toBeGreaterThan(0);

        // First result should match expected format
        const actual = results[0];
        expect(actual.format).toBe(format);

        // Compare common fields
        expect(actual.seed).toBe(expected.seed);
        expect(actual.steps).toBe(expected.steps);
        expect(actual.cfg).toBe(expected.cfg);
        expect(actual.sampler).toBe(expected.sampler);
        expect(actual.positive).toBe(expected.positive);
        expect(actual.negative).toBe(expected.negative);
        expect(actual.checkpoint).toBe(expected.checkpoint);

        // ComfyUI-specific fields
        if (format === 'comfyui') {
          expect(actual.scheduler).toBe(expected.scheduler);
          expect(actual.sampler_fallback).toBe(expected.sampler_fallback);

          // Compare extra_samplers array
          expect(actual.extra_samplers).toHaveLength(expected.extra_samplers.length);
          
          actual.extra_samplers.forEach((actualSampler, index) => {
            const expectedSampler = expected.extra_samplers[index];
            expect(actualSampler.id).toBe(expectedSampler.id);
            expect(actualSampler.seed).toBe(expectedSampler.seed);
            expect(actualSampler.steps).toBe(expectedSampler.steps);
            expect(actualSampler.cfg).toBe(expectedSampler.cfg);
            expect(actualSampler.sampler).toBe(expectedSampler.sampler);
            expect(actualSampler.scheduler).toBe(expectedSampler.scheduler);
            expect(actualSampler.is_base).toBe(expectedSampler.is_base);
          });
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

        expect(results.length).toBeGreaterThan(0);
        const metadata = results[0];

        // Verify common required fields
        expect(metadata).toHaveProperty('format');
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

        // ComfyUI-specific fields
        if (format === 'comfyui') {
          expect(metadata).toHaveProperty('scheduler');
          expect(metadata).toHaveProperty('extra_samplers');
          expect(metadata).toHaveProperty('sampler_fallback');
          
          expect(typeof metadata.scheduler).toBe('string');
          expect(Array.isArray(metadata.extra_samplers)).toBe(true);
          expect(typeof metadata.sampler_fallback).toBe('boolean');
        }
      });
    });
  });

  describe('Cross-format consistency', () => {
    it('should extract same metadata from PNG and WebP versions', () => {
      const pngPath = join(process.cwd(), 'tests/samples/comfyui_simple.png');
      const webpPath = join(process.cwd(), 'tests/samples/comfyui_simple.webp');

      if (!existsSync(pngPath) || !existsSync(webpPath)) {
        console.log('Sample files not found, skipping cross-format test');
        return;
      }

      const pngBuffer = new Uint8Array(readFileSync(pngPath));
      const webpBuffer = new Uint8Array(readFileSync(webpPath));

      const pngResults = metadataService.extractMetadata(pngBuffer, 'image/png');
      const webpResults = metadataService.extractMetadata(webpBuffer, 'image/webp');

      expect(pngResults.length).toBeGreaterThan(0);
      expect(webpResults.length).toBeGreaterThan(0);

      const pngMetadata = pngResults[0];
      const webpMetadata = webpResults[0];

      // Core fields should match
      expect(pngMetadata.seed).toBe(webpMetadata.seed);
      expect(pngMetadata.steps).toBe(webpMetadata.steps);
      expect(pngMetadata.cfg).toBe(webpMetadata.cfg);
      expect(pngMetadata.sampler).toBe(webpMetadata.sampler);
      expect(pngMetadata.scheduler).toBe(webpMetadata.scheduler);
      expect(pngMetadata.checkpoint).toBe(webpMetadata.checkpoint);
    });

    it('should extract same metadata from multi-sampler PNG and WebP versions', () => {
      const pngPath = join(process.cwd(), 'tests/samples/comfyui_multi.png');
      const webpPath = join(process.cwd(), 'tests/samples/comfyui_multi.webp');

      if (!existsSync(pngPath) || !existsSync(webpPath)) {
        console.log('Sample files not found, skipping cross-format test');
        return;
      }

      const pngBuffer = new Uint8Array(readFileSync(pngPath));
      const webpBuffer = new Uint8Array(readFileSync(webpPath));

      const pngResults = metadataService.extractMetadata(pngBuffer, 'image/png');
      const webpResults = metadataService.extractMetadata(webpBuffer, 'image/webp');

      expect(pngResults.length).toBeGreaterThan(0);
      expect(webpResults.length).toBeGreaterThan(0);

      const pngMetadata = pngResults[0];
      const webpMetadata = webpResults[0];

      // Should have same number of extra samplers
      expect(pngMetadata.extra_samplers.length).toBe(webpMetadata.extra_samplers.length);
      expect(pngMetadata.extra_samplers.length).toBe(4);

      // Each sampler should match
      pngMetadata.extra_samplers.forEach((pngSampler, index) => {
        const webpSampler = webpMetadata.extra_samplers[index];
        expect(pngSampler.id).toBe(webpSampler.id);
        expect(pngSampler.seed).toBe(webpSampler.seed);
        expect(pngSampler.steps).toBe(webpSampler.steps);
        expect(pngSampler.is_base).toBe(webpSampler.is_base);
      });
    });
  });
});
