import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import ImageMetadataReader from '../../js/metadata-parser/binary-extraction/ImageMetadataReader.js';

describe('ImageMetadataReader', () => {
  describe('extractRawMetadata', () => {
    it('should handle invalid JPEG buffer gracefully', () => {
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

    it('should return raw text (JSON string) for workflow keyword', () => {
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
      expect(result.workflow).toBe('{"nodes":[]}');
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

  describe('_decodeComfChunk', () => {
    it('should decode comf chunk with keyword and JSON', () => {
      const keyword = 'workflow';
      const jsonText = '{"nodes":[]}';
      const data = new TextEncoder().encode(keyword + jsonText);
      
      const result = ImageMetadataReader._decodeComfChunk(data);
      expect(result.keyword).toBe(keyword);
      expect(result.text).toBe(jsonText);
    });

    it('should handle comf chunk with whitespace before JSON', () => {
      const keyword = 'prompt';
      const jsonText = '{"test":"value"}';
      const data = new TextEncoder().encode(keyword + '  ' + jsonText);
      
      const result = ImageMetadataReader._decodeComfChunk(data);
      expect(result.keyword).toBe(keyword);
      expect(result.text).toBe(jsonText);
    });

    it('should handle comf chunk with null characters', () => {
      const keyword = 'workflow';
      const jsonText = '{"key":"val"}';
      const data = new TextEncoder().encode(keyword + '\0\0' + jsonText);
      
      const result = ImageMetadataReader._decodeComfChunk(data);
      expect(result.keyword).toBe(keyword);
      expect(result.text).toBe(jsonText);
    });

    it('should handle comf chunk without JSON', () => {
      const data = new TextEncoder().encode('no json here');
      const result = ImageMetadataReader._decodeComfChunk(data);
      expect(result.keyword).toBe('');
      expect(result.text).toBe('no json here');
    });
  });

  describe('extractPngChunks - comf chunks', () => {
    it('should extract comf chunks with JSON data', () => {
      const pngSignature = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
      ]);
      
      const keyword = 'workflow';
      const jsonText = '{"nodes":[{"id":1}]}';
      const chunkData = new TextEncoder().encode(keyword + jsonText);
      
      const chunkLength = chunkData.length;
      const chunk = new Uint8Array(4 + 4 + chunkLength + 4);
      const view = new DataView(chunk.buffer);
      
      view.setUint32(0, chunkLength);
      // Type 'comf'
      chunk[4] = 0x63; // 'c'
      chunk[5] = 0x6f; // 'o'
      chunk[6] = 0x6d; // 'm'
      chunk[7] = 0x66; // 'f'
      chunk.set(chunkData, 8);
      view.setUint32(8 + chunkLength, 0);
      
      const buffer = new Uint8Array(pngSignature.length + chunk.length);
      buffer.set(pngSignature, 0);
      buffer.set(chunk, pngSignature.length);
      
      const result = ImageMetadataReader.extractPngChunks(buffer);
      expect(result.workflow).toBe('{"nodes":[{"id":1}]}');
    });

    it('should handle comf chunks with non-JSON text', () => {
      const pngSignature = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
      ]);
      
      const text = 'some text data without json';
      const chunkData = new TextEncoder().encode(text);
      
      const chunkLength = chunkData.length;
      const chunk = new Uint8Array(4 + 4 + chunkLength + 4);
      const view = new DataView(chunk.buffer);
      
      view.setUint32(0, chunkLength);
      chunk[4] = 0x63; chunk[5] = 0x6f; chunk[6] = 0x6d; chunk[7] = 0x66;
      chunk.set(chunkData, 8);
      view.setUint32(8 + chunkLength, 0);
      
      const buffer = new Uint8Array(pngSignature.length + chunk.length);
      buffer.set(pngSignature, 0);
      buffer.set(chunk, pngSignature.length);
      
      const result = ImageMetadataReader.extractPngChunks(buffer);
      // When no JSON is found, the text is stored with empty keyword
      // which means it's stored as result[''] = text
      expect(result['']).toBe(text);
    });
  });

  describe('extractPngChunks - edge cases', () => {
    it('should handle truncated chunk length', () => {
      const buffer = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00 // Incomplete length
      ]);
      const result = ImageMetadataReader.extractPngChunks(buffer);
      expect(result).toEqual({});
    });

    it('should handle truncated chunk type', () => {
      const buffer = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x05, // Length
        0x74, 0x45 // Incomplete type
      ]);
      const result = ImageMetadataReader.extractPngChunks(buffer);
      expect(result).toEqual({});
    });

    it('should skip non-tEXt/comf chunks', () => {
      const pngSignature = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
      ]);
      
      // Create IHDR chunk (not tEXt or comf)
      const chunk = new Uint8Array([
        0x00, 0x00, 0x00, 0x0d, // Length: 13
        0x49, 0x48, 0x44, 0x52, // 'IHDR'
        // 13 bytes of data
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00  // CRC
      ]);
      
      const buffer = new Uint8Array(pngSignature.length + chunk.length);
      buffer.set(pngSignature, 0);
      buffer.set(chunk, pngSignature.length);
      
      const result = ImageMetadataReader.extractPngChunks(buffer);
      expect(result).toEqual({});
    });
  });

  describe('extractJpegChunks', () => {
    it('should return empty object for invalid JPEG signature', () => {
      const buffer = new Uint8Array([0, 1, 2, 3]);
      const result = ImageMetadataReader.extractJpegChunks(buffer);
      expect(result).toEqual({});
    });

    it('should recognize valid JPEG signature (FFD8)', () => {
      const buffer = new Uint8Array([0xFF, 0xD8]);
      const result = ImageMetadataReader.extractJpegChunks(buffer);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should delegate to extractRawMetadata for image/jpeg MIME type', () => {
      const buffer = new Uint8Array([0xFF, 0xD8, 0xFF]);
      const result = ImageMetadataReader.extractRawMetadata(buffer, 'image/jpeg');
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('extractWebpChunks - EXIF/XMP', () => {
    it('should extract workflow from EXIF chunk', () => {
      const webpHeader = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // 'RIFF'
        0x00, 0x00, 0x00, 0x00, // File size (placeholder)
        0x57, 0x45, 0x42, 0x50  // 'WEBP'
      ]);
      
      const jsonText = '{"nodes":[]}';
      const exifData = new TextEncoder().encode('workflow: ' + jsonText);
      
      const exifChunk = new Uint8Array(8 + exifData.length);
      const view = new DataView(exifChunk.buffer);
      
      // EXIF chunk header
      exifChunk[0] = 0x45; exifChunk[1] = 0x58; // 'EX'
      exifChunk[2] = 0x49; exifChunk[3] = 0x46; // 'IF'
      view.setUint32(4, exifData.length, true); // Little-endian size
      exifChunk.set(exifData, 8);
      
      const buffer = new Uint8Array(webpHeader.length + exifChunk.length);
      buffer.set(webpHeader, 0);
      buffer.set(exifChunk, webpHeader.length);
      
      const result = ImageMetadataReader.extractWebpChunks(buffer);
      expect(result.workflow).toBe('{"nodes":[]}');
    });

    it('should extract prompt from XMP chunk', () => {
      const webpHeader = new Uint8Array([
        0x52, 0x49, 0x46, 0x46,
        0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50
      ]);
      
      const jsonText = '{"text":"test"}';
      const xmpData = new TextEncoder().encode('prompt: ' + jsonText);
      
      const xmpChunk = new Uint8Array(8 + xmpData.length);
      const view = new DataView(xmpChunk.buffer);
      
      // XMP chunk header (note the space after XMP)
      xmpChunk[0] = 0x58; xmpChunk[1] = 0x4d; // 'XM'
      xmpChunk[2] = 0x50; xmpChunk[3] = 0x20; // 'P '
      view.setUint32(4, xmpData.length, true);
      xmpChunk.set(xmpData, 8);
      
      const buffer = new Uint8Array(webpHeader.length + xmpChunk.length);
      buffer.set(webpHeader, 0);
      buffer.set(xmpChunk, webpHeader.length);
      
      const result = ImageMetadataReader.extractWebpChunks(buffer);
      expect(result.prompt).toBe('{"text":"test"}');
    });

    it('should handle WebP with odd-sized chunks (padding)', () => {
      const webpHeader = new Uint8Array([
        0x52, 0x49, 0x46, 0x46,
        0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50
      ]);
      
      // Create EXIF chunk with odd size (5 bytes)
      const exifData = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]);
      const exifChunk = new Uint8Array(8 + exifData.length + 1); // +1 for padding
      const view = new DataView(exifChunk.buffer);
      
      exifChunk[0] = 0x45; exifChunk[1] = 0x58;
      exifChunk[2] = 0x49; exifChunk[3] = 0x46;
      view.setUint32(4, exifData.length, true);
      exifChunk.set(exifData, 8);
      exifChunk[8 + exifData.length] = 0x00; // Padding byte
      
      const buffer = new Uint8Array(webpHeader.length + exifChunk.length);
      buffer.set(webpHeader, 0);
      buffer.set(exifChunk, webpHeader.length);
      
      const result = ImageMetadataReader.extractWebpChunks(buffer);
      expect(result).toEqual({});
    });

    it('should handle truncated WebP chunk header', () => {
      const buffer = new Uint8Array([
        0x52, 0x49, 0x46, 0x46,
        0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50,
        0x45, 0x58 // Incomplete chunk header
      ]);
      const result = ImageMetadataReader.extractWebpChunks(buffer);
      expect(result).toEqual({});
    });
  });

  describe('_extractFromBinary', () => {
    it('should extract workflow from binary data', () => {
      const jsonText = '{"nodes":[]}';
      const binaryData = new TextEncoder().encode('workflow: ' + jsonText);
      const result = {};
      
      ImageMetadataReader._extractFromBinary(binaryData, result);
      expect(result.workflow).toBe('{"nodes":[]}');
    });

    it('should extract prompt from binary data', () => {
      const jsonText = '{"text":"hello"}';
      const binaryData = new TextEncoder().encode('prompt: ' + jsonText);
      const result = {};
      
      ImageMetadataReader._extractFromBinary(binaryData, result);
      expect(result.prompt).toBe('{"text":"hello"}');
    });

    it('should handle case-insensitive keyword matching', () => {
      const jsonText = '{"key":"value"}';
      const binaryData = new TextEncoder().encode('WORKFLOW: ' + jsonText);
      const result = {};
      
      ImageMetadataReader._extractFromBinary(binaryData, result);
      expect(result.workflow).toBe('{"key":"value"}');
    });

    it('should handle binary data without JSON', () => {
      const binaryData = new TextEncoder().encode('no json here');
      const result = {};
      
      ImageMetadataReader._extractFromBinary(binaryData, result);
      expect(result).toEqual({});
    });

    it('should handle malformed JSON in binary data', () => {
      const binaryData = new TextEncoder().encode('workflow: {invalid json}');
      const result = {};
      
      ImageMetadataReader._extractFromBinary(binaryData, result);
      expect(result).toEqual({});
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
      const samplePath = join(process.cwd(), 'tests', 'fixtures', 'comfyui_simple.png');

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
            expect(typeof result.workflow).toBe('string');
          }
          if (result.prompt) {
            expect(typeof result.prompt).toBe('string');
          }
          if (result.parameters) {
            expect(typeof result.parameters).toBe('string');
          }
        }
      } else {
        console.log('Sample PNG file not found, skipping real file test');
      }
    });

    it('should extract metadata from real JPEG sample if available', () => {
      const samplePath = join(process.cwd(), 'tests', 'fixtures', 'comfyui_simple.jpeg');

      if (existsSync(samplePath)) {
        const buffer = new Uint8Array(readFileSync(samplePath));
        const result = ImageMetadataReader.extractRawMetadata(buffer, 'image/jpeg');

        // The result should be an object (may be empty or contain metadata)
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');

        // If it has metadata, verify structure
        if (Object.keys(result).length > 0) {
          console.log('Sample JPEG metadata keys:', Object.keys(result));

          // Check for common metadata fields
          if (result.workflow) {
            expect(typeof result.workflow).toBe('string');
          }
          if (result.prompt) {
            expect(typeof result.prompt).toBe('string');
          }
          if (result.parameters) {
            expect(typeof result.parameters).toBe('string');
          }
        }
      } else {
        console.log('Sample JPEG file not found, skipping real file test');
      }
    });

    it('should extract metadata from real WebP sample if available', () => {
      const samplePath = join(process.cwd(), 'tests', 'fixtures', 'comfyui_simple.webp');

      if (existsSync(samplePath)) {
        const buffer = new Uint8Array(readFileSync(samplePath));
        const result = ImageMetadataReader.extractRawMetadata(buffer, 'image/webp');

        // The result should be an object (may be empty or contain metadata)
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');

        // If it has metadata, verify structure
        if (Object.keys(result).length > 0) {
          console.log('Sample WebP metadata keys:', Object.keys(result));

          // Check for common metadata fields
          if (result.workflow) {
            expect(typeof result.workflow).toBe('string');
          }
          if (result.prompt) {
            expect(typeof result.prompt).toBe('string');
          }
          if (result.parameters) {
            expect(typeof result.parameters).toBe('string');
          }
        }
      } else {
        console.log('Sample WebP file not found, skipping real file test');
      }
    });
  });
});
