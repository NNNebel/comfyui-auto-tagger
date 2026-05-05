import { describe, it, expect, beforeEach } from 'vitest';
import BaseContainerReader from '../../../js/metadata-parser/containers/BaseContainerReader.js';

describe('BaseContainerReader', () => {
  let reader;

  beforeEach(() => {
    reader = new BaseContainerReader();
  });

  describe('getSupportedMimeTypes', () => {
    it('throws when not overridden', () => {
      expect(() => reader.getSupportedMimeTypes())
        .toThrow('BaseContainerReader must implement getSupportedMimeTypes()');
    });
  });

  describe('extractRawChunks', () => {
    it('throws when not overridden', () => {
      expect(() => reader.extractRawChunks(new Uint8Array([0])))
        .toThrow('BaseContainerReader must implement extractRawChunks(buffer)');
    });
  });

  describe('_extractJsonStringFromPos', () => {
    it('extracts simple JSON', () => {
      const json = '{"key":"value"}';
      const buf = new TextEncoder().encode(json);
      expect(reader._extractJsonStringFromPos(buf, 0)).toBe(json);
    });

    it('extracts nested JSON', () => {
      const json = '{"a":{"b":1}}';
      const buf = new TextEncoder().encode(json);
      expect(reader._extractJsonStringFromPos(buf, 0)).toBe(json);
    });

    it('returns null for invalid JSON', () => {
      const buf = new TextEncoder().encode('{invalid}');
      expect(reader._extractJsonStringFromPos(buf, 0)).toBeNull();
    });

    it('returns null when no braces found', () => {
      const buf = new TextEncoder().encode('no json here');
      expect(reader._extractJsonStringFromPos(buf, 0)).toBeNull();
    });

    it('extracts from offset position', () => {
      const json = '{"x":1}';
      const buf = new TextEncoder().encode('prefix:' + json);
      expect(reader._extractJsonStringFromPos(buf, 7)).toBe(json);
    });

    it('handles escaped quotes inside strings', () => {
      const json = '{"key":"val\\"ue"}';
      const buf = new TextEncoder().encode(json);
      expect(reader._extractJsonStringFromPos(buf, 0)).toBe(json);
    });
  });

  describe('_extractFromBinary', () => {
    it('extracts workflow JSON string', () => {
      const result = {};
      const buf = new TextEncoder().encode('workflow: {"nodes":[]}');
      reader._extractFromBinary(buf, result);
      expect(result.workflow).toBe('{"nodes":[]}');
    });

    it('extracts prompt JSON string', () => {
      const result = {};
      const buf = new TextEncoder().encode('prompt: {"1":{"class_type":"KSampler"}}');
      reader._extractFromBinary(buf, result);
      expect(result.prompt).toBe('{"1":{"class_type":"KSampler"}}');
    });

    it('extracts eagle_bridge JSON string', () => {
      const result = {};
      const buf = new TextEncoder().encode('eagle_bridge: {"version":1}');
      reader._extractFromBinary(buf, result);
      expect(result.eagle_bridge).toBe('{"version":1}');
    });

    it('extracts multiple keys', () => {
      const result = {};
      const buf = new TextEncoder().encode('workflow: {"a":1} prompt: {"b":2}');
      reader._extractFromBinary(buf, result);
      expect(result.workflow).toBe('{"a":1}');
      expect(result.prompt).toBe('{"b":2}');
    });

    it('ignores non-JSON content', () => {
      const result = {};
      reader._extractFromBinary(new TextEncoder().encode('no metadata here'), result);
      expect(result).toEqual({});
    });

    it('stores lowercase key names', () => {
      const result = {};
      const buf = new TextEncoder().encode('Workflow: {"a":1}');
      reader._extractFromBinary(buf, result);
      expect(result.workflow).toBe('{"a":1}');
    });
  });

  describe('_parseJsonFromPos', () => {
    it('parses simple JSON object', () => {
      const json = '{"a":1}';
      const buf = new TextEncoder().encode(json);
      expect(reader._parseJsonFromPos(buf, 0)).toEqual({ a: 1 });
    });

    it('parses nested JSON object', () => {
      const json = '{"a":{"b":2}}';
      const buf = new TextEncoder().encode(json);
      expect(reader._parseJsonFromPos(buf, 0)).toEqual({ a: { b: 2 } });
    });

    it('parses JSON with string values', () => {
      const json = '{"name":"test","type":"sample"}';
      const buf = new TextEncoder().encode(json);
      const result = reader._parseJsonFromPos(buf, 0);
      expect(result.name).toBe('test');
      expect(result.type).toBe('sample');
    });

    it('parses JSON with escaped quotes', () => {
      const json = '{"text":"say \\"hello\\""}';
      const buf = new TextEncoder().encode(json);
      const result = reader._parseJsonFromPos(buf, 0);
      expect(result.text).toBe('say "hello"');
    });

    it('returns null for malformed JSON', () => {
      const json = '{"unclosed":1';
      const buf = new TextEncoder().encode(json);
      expect(reader._parseJsonFromPos(buf, 0)).toBeNull();
    });

    it('returns null if no opening brace at position', () => {
      const text = 'not json at all';
      const buf = new TextEncoder().encode(text);
      expect(reader._parseJsonFromPos(buf, 0)).toBeNull();
    });

    it('parses JSON starting at non-zero position', () => {
      const fullText = 'prefix:{"x":10}:suffix';
      const buf = new TextEncoder().encode(fullText);
      const result = reader._parseJsonFromPos(buf, 7); // Start at {
      expect(result).toEqual({ x: 10 });
    });

    it('handles deeply nested JSON', () => {
      const json = '{"a":{"b":{"c":{"d":1}}}}';
      const buf = new TextEncoder().encode(json);
      const result = reader._parseJsonFromPos(buf, 0);
      expect(result.a.b.c.d).toBe(1);
    });
  });
});
