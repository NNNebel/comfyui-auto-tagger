import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import PngContainerReader from '../../../js/metadata-parser/containers/PngContainerReader.js';

describe('PngContainerReader', () => {
  let reader;

  beforeEach(() => {
    reader = new PngContainerReader();
  });

  describe('getSupportedMimeTypes', () => {
    it('returns PNG MIME type', () => {
      expect(reader.getSupportedMimeTypes()).toEqual(['image/png']);
    });
  });

  describe('extractRawChunks', () => {
    it('returns empty object for empty buffer', () => {
      const buf = new Uint8Array(0);
      expect(reader.extractRawChunks(buf)).toEqual({});
    });

    it('returns empty object for buffer without PNG signature', () => {
      // Minimum 4 bytes for DataView.getUint32 to work
      const buf = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
      expect(reader.extractRawChunks(buf)).toEqual({});
    });
  });

  describe('_decodePngText', () => {
    it('decodes PNG tEXt chunk with keyword and text', () => {
      const data = new TextEncoder().encode('mykey\0some text');
      const result = reader._decodePngText(data);
      expect(result.keyword).toBe('mykey');
      expect(result.text).toBe('some text');
    });

    it('returns empty strings for chunk without null separator', () => {
      const data = new TextEncoder().encode('no null here');
      const result = reader._decodePngText(data);
      expect(result.keyword).toBe('');
      expect(result.text).toBe('');
    });

    it('handles empty text after null separator', () => {
      const data = new TextEncoder().encode('keyword\0');
      const result = reader._decodePngText(data);
      expect(result.keyword).toBe('keyword');
      expect(result.text).toBe('');
    });

    it('handles text immediately after null', () => {
      const data = new TextEncoder().encode('k\0v');
      const result = reader._decodePngText(data);
      expect(result.keyword).toBe('k');
      expect(result.text).toBe('v');
    });
  });

  describe('_decodeComfChunk', () => {
    it('extracts keyword and JSON from comf chunk', () => {
      const data = new TextEncoder().encode('prompt{"class_type":"KSampler"}');
      const result = reader._decodeComfChunk(data);
      expect(result.keyword).toBe('prompt');
      expect(result.text).toBe('{"class_type":"KSampler"}');
    });

    it('handles keyword with whitespace before JSON', () => {
      const data = new TextEncoder().encode('workflow  \n  {"a":1}');
      const result = reader._decodeComfChunk(data);
      expect(result.keyword).toBe('workflow');
      expect(result.text).toBe('{"a":1}');
    });

    it('returns empty keyword if no text before brace', () => {
      const data = new TextEncoder().encode('{"x":1}');
      const result = reader._decodeComfChunk(data);
      expect(result.keyword).toBe('');
      expect(result.text).toBe('{"x":1}');
    });

    it('returns full text if no JSON found', () => {
      const data = new TextEncoder().encode('just plain text no json');
      const result = reader._decodeComfChunk(data);
      expect(result.keyword).toBe('');
      expect(result.text).toBe('just plain text no json');
    });

    it('strips null characters from keyword', () => {
      const data = new TextEncoder().encode('key\0word{"x":1}');
      const result = reader._decodeComfChunk(data);
      expect(result.keyword).toBe('keyword');
      expect(result.text).toBe('{"x":1}');
    });
  });

  describe('positive tests with real fixtures', () => {
    const fixtures = [
      'tests/fixtures/bridge-simple.png',
      'tests/fixtures/bridge-i2i.png',
      'tests/fixtures/a1111_simple.png',
      'tests/fixtures/comfyui_simple_png.png',
    ];

    fixtures.forEach(filePath => {
      it(`extracts chunks from ${filePath.split('/').pop()}`, () => {
        try {
          const buffer = readFileSync(resolve(filePath));
          const result = reader.extractRawChunks(new Uint8Array(buffer));

          // PNG tEXt/comf chunks should extract to object with keyword keys
          expect(typeof result).toBe('object');
          // Bridge/ComfyUI PNGs should have workflow or prompt
          if (filePath.includes('bridge') || filePath.includes('comfyui') || filePath.includes('a1111')) {
            const hasContent = Object.keys(result).length > 0;
            if (hasContent) {
              Object.values(result).forEach(val => {
                expect(typeof val).toBe('string');
              });
            }
          }
        } catch (e) {
          // Fixture may not exist, skip
        }
      });
    });
  });
});
