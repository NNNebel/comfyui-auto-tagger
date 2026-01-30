import { describe, it, expect } from 'vitest';
import ImageMetadataReader from '../../js/metadata-parser/binary-extraction/ImageMetadataReader.js';

describe('ImageMetadataReader Integration', () => {
  describe('Compatibility with ImageMetadataReader', () => {
    it('should extract PNG data correctly', () => {
      // Create a PNG with tEXt chunks
      const pngSignature = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
      ]);
      
      // Create workflow tEXt chunk
      const keyword = 'workflow';
      const jsonText = '{"nodes":[{"id":1,"type":"test"}]}';
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
      
      const result = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
      
      expect(result.workflow).toEqual({ nodes: [{ id: 1, type: 'test' }] });
    });

    it('should extract WebP data correctly', () => {
      // Create a minimal WebP with RIFF/WEBP signature
      const buffer = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // 'RIFF'
        0x10, 0x00, 0x00, 0x00, // File size
        0x57, 0x45, 0x42, 0x50, // 'WEBP'
        // VP8 chunk
        0x56, 0x50, 0x38, 0x20, // 'VP8 '
        0x00, 0x00, 0x00, 0x00  // Size
      ]);
      
      const result = ImageMetadataReader.extractRawMetadata(buffer, 'image/webp');
      
      expect(result).toEqual({});
    });

    it('should handle multiple PNG tEXt chunks correctly', () => {
      const pngSignature = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
      ]);
      
      // Helper to create tEXt chunk
      const createTextChunk = (keyword, text) => {
        const chunkData = new TextEncoder().encode(keyword + '\0' + text);
        const chunkLength = chunkData.length;
        const chunk = new Uint8Array(4 + 4 + chunkLength + 4);
        const view = new DataView(chunk.buffer);
        
        view.setUint32(0, chunkLength);
        chunk[4] = 0x74; chunk[5] = 0x45; chunk[6] = 0x58; chunk[7] = 0x74;
        chunk.set(chunkData, 8);
        view.setUint32(8 + chunkLength, 0);
        
        return chunk;
      };
      
      const chunk1 = createTextChunk('workflow', '{"nodes":[]}');
      const chunk2 = createTextChunk('prompt', '{"1":{"class_type":"test"}}');
      const chunk3 = createTextChunk('parameters', 'test parameters');
      
      const buffer = new Uint8Array(
        pngSignature.length + chunk1.length + chunk2.length + chunk3.length
      );
      buffer.set(pngSignature, 0);
      buffer.set(chunk1, pngSignature.length);
      buffer.set(chunk2, pngSignature.length + chunk1.length);
      buffer.set(chunk3, pngSignature.length + chunk1.length + chunk2.length);
      
      const result = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
      
      expect(result.workflow).toEqual({ nodes: [] });
      expect(result.prompt).toEqual({ "1": { class_type: "test" } });
      expect(result.parameters).toBe('test parameters');
    });

    it('should handle invalid PNG correctly', () => {
      const buffer = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
      
      const result = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
      
      expect(result).toEqual({});
    });

    it('should handle unsupported format correctly', () => {
      const buffer = new Uint8Array([0, 1, 2, 3]);
      
      const result = ImageMetadataReader.extractRawMetadata(buffer, 'image/jpeg');
      
      expect(result).toEqual({});
    });
  });

  describe('Error handling', () => {
    it('should handle corrupted PNG gracefully', () => {
      // PNG signature but truncated data
      const buffer = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x10 // Chunk length claims 16 bytes but no data follows
      ]);
      
      const result = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
      expect(result).toEqual({});
    });

    it('should handle corrupted WebP gracefully', () => {
      // WebP signature but truncated data
      const buffer = new Uint8Array([
        0x52, 0x49, 0x46, 0x46,
        0xFF, 0xFF, 0xFF, 0xFF, // Claims huge file size
        0x57, 0x45, 0x42, 0x50
      ]);
      
      const result = ImageMetadataReader.extractRawMetadata(buffer, 'image/webp');
      expect(result).toEqual({});
    });

    it('should handle malformed JSON in PNG tEXt chunk', () => {
      const pngSignature = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
      ]);
      
      const keyword = 'workflow';
      const badJson = '{invalid json}';
      const chunkData = new TextEncoder().encode(keyword + '\0' + badJson);
      
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
      
      const result = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
      // Should store as text when JSON parsing fails
      expect(result.workflow).toBe(badJson);
    });
  });
});
