import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import ImageMetadataReader from '../../js/metadata-parser/binary-extraction/ImageMetadataReader.js';

describe('ImageMetadataReader', () => {
  describe('extractRawMetadata', () => {
    it('should return empty object for unsupported MIME type', () => {
      const buffer = new Uint8Array([0, 1, 2, 3]);
      const result = ImageMetadataReader.extractRawMetadata(buffer, 'image/jpeg');
      expect(result).toEqual({});
    });

    it('should handle errors gracefully and return empty object', () => {
      const buffer = new Uint8Array([0, 1, 2, 3]);
      const result = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
      expect(result).toEqual({});
    });

    it('should delegate to extractPngChunks for PNG images', () => {
      // Create a minimal valid PNG signature
      const buffer = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, // PNG signature
        0x0d, 0x0a, 0x1a, 0x0a  // PNG signature continued
      ]);
      const result = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
      expect(result).toEqual({});
    });

    it('should delegate to extractWebpChunks for WebP images', () => {
      // Create a minimal valid WebP signature
      const buffer = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // 'RIFF'
        0x00, 0x00, 0x00, 0x00, // File size (placeholder)
        0x57, 0x45, 0x42, 0x50  // 'WEBP'
      ]);
      const result = ImageMetadataReader.extractRawMetadata(buffer, 'image/webp');
      expect(result).toEqual({});
    });
  });

  describe('extractPngChunks', () => {
    it('should return empty object for invalid PNG signature', () => {
      const buffer = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
      const result = ImageMetadataReader.extractPngChunks(buffer);
      expect(result).toEqual({});
    });

    it('should extract tEXt chunks with text data', () => {
      // Create a PNG with a tEXt chunk
      const pngSignature = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
      ]);
      
      // Create tEXt chunk: keyword\0text
      const keyword = 'parameters';
      const text = 'test data';
      const chunkData = new TextEncoder().encode(keyword + '\0' + text);
      
      // Chunk structure: length (4) + type (4) + data + CRC (4)
      const chunkLength = chunkData.length;
      const chunk = new Uint8Array(4 + 4 + chunkLength + 4);
      const view = new DataView(chunk.buffer);
      
      // Length
      view.setUint32(0, chunkLength);
      // Type 'tEXt'
      chunk[4] = 0x74; // 't'
      chunk[5] = 0x45; // 'E'
      chunk[6] = 0x58; // 'X'
      chunk[7] = 0x74; // 't'
      // Data
      chunk.set(chunkData, 8);
      // CRC (dummy)
      view.setUint32(8 + chunkLength, 0);
      
      // Combine signature and chunk
      const buffer = new Uint8Array(pngSignature.length + chunk.length);
      buffer.set(pngSignature, 0);
      buffer.set(chunk, pngSignature.length);
      
      const result = ImageMetadataReader.extractPngChunks(buffer);
      expect(result.parameters).toBe(text);
    });

    it('should parse JSON for workflow and prompt keywords', () => {
      const pngSignature = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
      ]);
      
      const keyword = 'workflow';
      const jsonText = '{"nodes":[]}';
      const chunkData = new TextEncoder().encode(keyword + '\0' + jsonText);
      
      const chunkLength = chunkData.length;
      const chunk = new Uint8Array(4 + 4 + chunkLength + 4);
      const view = new DataView(chunk.buffer);
      
      view.setUint32(0, chunkLength);
      chunk[4] = 0x74; chunk[5] = 0x45; chunk[6] = 0x58; chunk[7] = 0x74;
      chunk.set(chunkData, 8);
      view.setUint32(8 + chunkLength, 0);
      
      const buffer = new Uint8Array(pngSignature.length + chunk.length);
      buffer.set(pngSignature, 0);
      buffer.set(chunk, pngSignature.length);
      
      const result = ImageMetadataReader.extractPngChunks(buffer);
      expect(result.workflow).toEqual({ nodes: [] });
    });
  });

  describe('extractWebpChunks', () => {
    it('should return empty object for invalid WebP signature', () => {
      const buffer = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      const result = ImageMetadataReader.extractWebpChunks(buffer);
      expect(result).toEqual({});
    });

    it('should handle WebP with no EXIF/XMP chunks', () => {
      const buffer = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // 'RIFF'
        0x10, 0x00, 0x00, 0x00, // File size
        0x57, 0x45, 0x42, 0x50, // 'WEBP'
        // VP8 chunk (not EXIF/XMP)
        0x56, 0x50, 0x38, 0x20, // 'VP8 '
        0x00, 0x00, 0x00, 0x00  // Size
      ]);
      const result = ImageMetadataReader.extractWebpChunks(buffer);
      expect(result).toEqual({});
    });
  });

  describe('_decodePngText', () => {
    it('should decode PNG tEXt chunk correctly', () => {
      const keyword = 'test';
      const text = 'value';
      const data = new TextEncoder().encode(keyword + '\0' + text);
      
      const result = ImageMetadataReader._decodePngText(data);
      expect(result.keyword).toBe(keyword);
      expect(result.text).toBe(text);
    });

    it('should handle missing null separator', () => {
      const data = new TextEncoder().encode('no null separator');
      const result = ImageMetadataReader._decodePngText(data);
      expect(result.keyword).toBe('');
      expect(result.text).toBe('');
    });
  });



  describe('_parseJsonFromPos', () => {
    it('should parse JSON from buffer position', () => {
      const jsonStr = '{"key":"value"}';
      const buffer = new TextEncoder().encode(jsonStr);
      const result = ImageMetadataReader._parseJsonFromPos(buffer, 0);
      expect(result).toEqual({ key: 'value' });
    });

    it('should handle nested JSON objects', () => {
      const jsonStr = '{"outer":{"inner":"value"}}';
      const buffer = new TextEncoder().encode(jsonStr);
      const result = ImageMetadataReader._parseJsonFromPos(buffer, 0);
      expect(result).toEqual({ outer: { inner: 'value' } });
    });

    it('should handle JSON with escaped characters', () => {
      const jsonStr = '{"text":"hello \\"world\\""}';
      const buffer = new TextEncoder().encode(jsonStr);
      const result = ImageMetadataReader._parseJsonFromPos(buffer, 0);
      expect(result).toEqual({ text: 'hello "world"' });
    });

    it('should return null for malformed JSON', () => {
      const buffer = new TextEncoder().encode('not json');
      const result = ImageMetadataReader._parseJsonFromPos(buffer, 0);
      expect(result).toBe(null);
    });

    it('should return null if closing brace not found', () => {
      const buffer = new TextEncoder().encode('{"unclosed":');
      const result = ImageMetadataReader._parseJsonFromPos(buffer, 0);
      expect(result).toBe(null);
    });
  });

  describe('Real sample file tests', () => {
    it('should extract metadata from real PNG sample if available', () => {
      const samplePath = join(process.cwd(), 'tests', 'samples', '00151-76682904.png');
      
      if (existsSync(samplePath)) {
        const buffer = new Uint8Array(readFileSync(samplePath));
        const result = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
        
        // The result should be an object (may be empty or contain metadata)
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
        
        // If it has metadata, verify structure
        if (Object.keys(result).length > 0) {
          console.log('Sample PNG metadata keys:', Object.keys(result));
          
          // Check for common metadata fields
          if (result.workflow) {
            expect(typeof result.workflow).toBe('object');
          }
          if (result.prompt) {
            expect(typeof result.prompt).toBe('object');
          }
          if (result.parameters) {
            expect(typeof result.parameters).toBe('string');
          }
        }
      } else {
        console.log('Sample PNG file not found, skipping real file test');
      }
    });
  });
});
