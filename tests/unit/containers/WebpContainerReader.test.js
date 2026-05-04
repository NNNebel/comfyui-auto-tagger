import { describe, it, expect, beforeEach } from 'vitest';
import WebpContainerReader from '../../../js/metadata-parser/containers/WebpContainerReader.js';

describe('WebpContainerReader', () => {
  let reader;

  beforeEach(() => {
    reader = new WebpContainerReader();
  });

  describe('getSupportedMimeTypes', () => {
    it('returns WebP MIME type', () => {
      expect(reader.getSupportedMimeTypes()).toEqual(['image/webp']);
    });
  });

  describe('extractRawChunks', () => {
    it('returns empty object for buffer without WebP signature', () => {
      const buf = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG signature
      expect(reader.extractRawChunks(buf)).toEqual({});
    });

    it('returns empty object for short buffer', () => {
      const buf = new Uint8Array([0x52, 0x49, 0x46, 0x46]); // RIFF only
      expect(reader.extractRawChunks(buf)).toEqual({});
    });

    it('returns empty object for buffer with RIFF but not WEBP', () => {
      const buf = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00, // size
        0x41, 0x56, 0x49, 0x20  // AVI (not WEBP)
      ]);
      expect(reader.extractRawChunks(buf)).toEqual({});
    });
  });

  describe('inherited _extractFromBinary', () => {
    it('extracts JSON from binary data via inheritance', () => {
      const result = {};
      const payload = 'workflow: {"a":1} prompt: {"b":2}';
      const buf = new TextEncoder().encode(payload);
      reader._extractFromBinary(buf, result);
      expect(result.workflow).toBe('{"a":1}');
      expect(result.prompt).toBe('{"b":2}');
    });
  });

  describe('inherited _extractJsonStringFromPos', () => {
    it('extracts JSON string from position', () => {
      const json = '{"x":1}';
      const buf = new TextEncoder().encode(json);
      expect(reader._extractJsonStringFromPos(buf, 0)).toBe(json);
    });
  });
});
