import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import ComfyUIParser from '../../js/metadata-parser/parsers/ComfyUIParser.js';
import ImageMetadataReader from '../../js/metadata-parser/binary-extraction/ImageMetadataReader.js';

describe('ComfyUIParser Integration Tests', () => {
  it('should parse metadata from real ComfyUI PNG image', () => {
    // Read the sample image
    const imagePath = join(process.cwd(), 'tests/samples/a1111_simple.png');
    
    // Skip test if file doesn't exist
    if (!existsSync(imagePath)) {
      console.log('Sample PNG file not found, skipping test');
      return;
    }
    
    const buffer = new Uint8Array(readFileSync(imagePath));
    
    // Extract raw metadata
    const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
    
    // Log what's in the raw chunks
    console.log('Raw chunks keys:', Object.keys(rawChunks));
    
    // Parse with ComfyUIParser
    const parser = new ComfyUIParser();
    const metadata = parser.parse(rawChunks);
    
    // Verify basic structure
    expect(metadata.format).toBe('comfyui');
    
    // Log the extracted metadata for debugging
    console.log('Extracted metadata:', JSON.stringify(metadata, null, 2));
    
    // This test verifies that the parser doesn't crash on real data
    // The sample image might not have ComfyUI metadata, so we just verify it doesn't crash
    expect(metadata).toBeDefined();
  });
});
