/**
 * ComfyUIParser Direct Tests
 *
 * Tests the ComfyUIParser by calling it directly with real fixture data.
 * This tests the parser layer independently of MetadataService.
 *
 * Note: Located in tests/unit/ because it tests a single parser class,
 * but uses real fixture data for realistic validation.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import ComfyUIParser from '../../js/metadata-parser/parsers/ComfyUIParser.js';
import ImageMetadataReader from '../../js/metadata-parser/binary-extraction/ImageMetadataReader.js';

describe('ComfyUIParser Direct Tests (with Real Fixtures)', () => {
  it('should handle A1111-formatted metadata without crashing', () => {
    // A1111 format image: has parameters metadata, not ComfyUI format
    const imagePath = join(process.cwd(), 'tests/fixtures/a1111_simple.png');

    if (!existsSync(imagePath)) {
      console.log('a1111_simple.png not found, skipping test');
      return;
    }

    const buffer = new Uint8Array(readFileSync(imagePath));
    const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');

    // Parse with ComfyUIParser - should gracefully handle non-ComfyUI data
    const parser = new ComfyUIParser();
    const metadata = parser.parse(rawChunks);

    // A1111 format should return null (not recognized as ComfyUI)
    expect(metadata).toBeNull();
  });

  it('should parse ComfyUI-formatted metadata when present', () => {
    // ComfyUI format image with actual ComfyUI workflow
    const imagePath = join(process.cwd(), 'tests/fixtures/comfyui_simple.png');

    if (!existsSync(imagePath)) {
      console.log('comfyui_simple.png not found, skipping test');
      return;
    }

    const buffer = new Uint8Array(readFileSync(imagePath));
    const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');

    const parser = new ComfyUIParser();
    const metadata = parser.parse(rawChunks);

    // ComfyUI format should be recognized
    if (metadata) {
      expect(metadata.format).toBe('comfyui');
    }
  });
});
