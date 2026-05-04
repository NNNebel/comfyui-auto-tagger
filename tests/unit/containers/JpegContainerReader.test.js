import { describe, it, expect, beforeEach } from 'vitest';
import JpegContainerReader from '../../../js/metadata-parser/containers/JpegContainerReader.js';

describe('JpegContainerReader', () => {
  let reader;

  beforeEach(() => {
    reader = new JpegContainerReader();
  });

  describe('getSupportedMimeTypes', () => {
    it('returns JPEG MIME types', () => {
      expect(reader.getSupportedMimeTypes()).toEqual(['image/jpeg', 'image/jpg']);
    });
  });

  describe('extractRawChunks', () => {
    it('returns empty object for buffer without JPEG signature', () => {
      const buf = new Uint8Array([0x89, 0x50, 0x4E, 0x47]); // PNG signature
      expect(reader.extractRawChunks(buf)).toEqual({});
    });

    it('returns empty object for short buffer', () => {
      const buf = new Uint8Array([0xFF]);
      expect(reader.extractRawChunks(buf)).toEqual({});
    });

    it('returns empty object for buffer without proper JPEG header', () => {
      const buf = new Uint8Array([0xFF, 0xD7]); // FF but not D8 (SOI)
      expect(reader.extractRawChunks(buf)).toEqual({});
    });
  });

  describe('_extractTiffAsciiStrings', () => {
    it('returns empty array for short TIFF data', () => {
      const buf = new Uint8Array([0x4D, 0x4D]); // MM (big-endian) only
      expect(reader._extractTiffAsciiStrings(buf)).toEqual([]);
    });

    it('returns empty array for invalid TIFF offset', () => {
      const buf = new Uint8Array([
        0x4D, 0x4D, // MM (big-endian)
        0x00, 0x2A, // TIFF version
        0xFF, 0xFF, 0xFF, 0xFF // invalid offset (beyond buffer)
      ]);
      expect(reader._extractTiffAsciiStrings(buf)).toEqual([]);
    });
  });

  describe('inherited _extractFromBinary', () => {
    it('extracts JSON from binary via inheritance', () => {
      const result = {};
      const payload = 'workflow: {"nodes":[]}';
      const buf = new TextEncoder().encode(payload);
      reader._extractFromBinary(buf, result);
      expect(result.workflow).toBe('{"nodes":[]}');
    });
  });

  describe('inherited _extractJsonStringFromPos', () => {
    it('extracts JSON string from position', () => {
      const json = '{"class_type":"KSampler"}';
      const buf = new TextEncoder().encode(json);
      expect(reader._extractJsonStringFromPos(buf, 0)).toBe(json);
    });
  });
});
