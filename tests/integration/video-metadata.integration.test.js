import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const MetadataService = require('../../js/metadata-parser/integration/MetadataService.js');

describe('Video Metadata Integration Tests (MP4)', () => {
  let metadataService;

  beforeAll(() => {
    metadataService = new MetadataService();
  });

  const testCases = [
    {
      name: 'ComfyUI Soundless Simple MP4',
      videoPath: 'tests/fixtures/comfyui_soundless_simple.mp4',
      expectedPath: 'tests/expected/comfyui_soundless_simple_mp4.json',
      mimeType: 'video/mp4',
      format: 'comfyui',
      shouldSucceed: true
    }
  ];

  testCases.forEach((testCase) => {
    it(`should extract metadata from ${testCase.name}`, () => {
      const filePath = join(process.cwd(), testCase.videoPath);

      if (!existsSync(filePath)) {
        console.warn(`Skipping test: Video file not found at ${filePath}`);
        return;
      }

      const buffer = readFileSync(filePath);
      const result = metadataService.extractPreferredMetadata(buffer, testCase.mimeType, testCase.format);

      if (testCase.shouldSucceed) {
        expect(result).toBeDefined();
        expect(result.format).toBe(testCase.format);

        // Load expected output
        const expectedPath = join(process.cwd(), testCase.expectedPath);
        if (existsSync(expectedPath)) {
          const expectedContent = readFileSync(expectedPath, 'utf-8');
          const expected = JSON.parse(expectedContent);

          // Debug: Log actual result
          console.log('[DEBUG] Actual result:', JSON.stringify(result, null, 2));

          // Check key fields
          expect(result.seed).toBe(expected.seed);
          expect(result.steps).toBe(expected.steps);
          expect(result.cfg).toBe(expected.cfg);
          expect(result.sampler).toBe(expected.sampler);
          expect(result.checkpoint).toBe(expected.checkpoint);
        } else {
          console.warn(`Expected file not found: ${expectedPath}`);
        }
      } else {
        expect(result.format).toBeNull();
      }
    });
  });
});
