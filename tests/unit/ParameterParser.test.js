import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ParameterParser = require('../../js/metadata-parser/parameters/ParameterParser.js');
const StandardParameterHandler = require('../../js/metadata-parser/parameters/StandardParameterHandler.js');
const LoraHashHandler = require('../../js/metadata-parser/parameters/LoraHashHandler.js');
const ADetailerHandler = require('../../js/metadata-parser/parameters/ADetailerHandler.js');

describe('ParameterParser', () => {
  let parser;

  beforeEach(() => {
    parser = new ParameterParser();
  });

  describe('registerHandler', () => {
    it('should register a handler', () => {
      const handler = new StandardParameterHandler();
      parser.registerHandler(handler);
      expect(parser.handlers).toHaveLength(1);
      expect(parser.handlers[0]).toBe(handler);
    });

    it('should sort handlers by priority', () => {
      const handler1 = new StandardParameterHandler(); // priority 10
      const handler2 = new LoraHashHandler(); // priority 20
      const handler3 = new ADetailerHandler(); // priority 30
      
      parser.registerHandler(handler3);
      parser.registerHandler(handler1);
      parser.registerHandler(handler2);
      
      expect(parser.handlers[0]).toBe(handler1);
      expect(parser.handlers[1]).toBe(handler2);
      expect(parser.handlers[2]).toBe(handler3);
    });

    it('should throw error for invalid handler', () => {
      expect(() => parser.registerHandler({})).toThrow();
      expect(() => parser.registerHandler(null)).toThrow();
    });
  });

  describe('parse', () => {
    beforeEach(() => {
      parser.registerHandler(new StandardParameterHandler());
      parser.registerHandler(new LoraHashHandler());
      parser.registerHandler(new ADetailerHandler());
    });

    it('should parse standard parameters', () => {
      const line = 'Steps: 20, Sampler: Euler a, CFG scale: 7.5, Seed: 123456';
      const result = parser.parse(line);
      
      expect(result).toEqual({
        steps: 20,
        sampler: 'Euler a',
        cfg: 7.5,
        seed: 123456
      });
    });

    it('should parse LoRA hashes', () => {
      const line = 'Steps: 20, Lora hashes: "lora1: hash1, lora2: hash2"';
      const result = parser.parse(line);
      
      expect(result).toEqual({
        steps: 20,
        lora_hashes: {
          lora1: 'hash1',
          lora2: 'hash2'
        },
        loras: ['lora1', 'lora2']
      });
    });

    it('should parse ADetailer parameters', () => {
      const line = 'ADetailer model: face_yolov8n.pt, ADetailer confidence: 0.3';
      const result = parser.parse(line);
      
      expect(result).toEqual({
        adetailer: {
          model: 'face_yolov8n.pt',
          confidence: 0.3
        }
      });
    });

    it('should parse mixed parameters', () => {
      const line = 'Steps: 20, Sampler: Euler a, ADetailer model: face.pt, Lora hashes: "lora1: hash1"';
      const result = parser.parse(line);
      
      expect(result).toEqual({
        steps: 20,
        sampler: 'Euler a',
        adetailer: {
          model: 'face.pt'
        },
        lora_hashes: {
          lora1: 'hash1'
        },
        loras: ['lora1']
      });
    });

    it('should handle quoted values with commas', () => {
      const line = 'Steps: 20, Sampler: "Euler a, modified", CFG scale: 7';
      const result = parser.parse(line);
      
      expect(result).toEqual({
        steps: 20,
        sampler: 'Euler a, modified',
        cfg: 7
      });
    });

    it('should handle empty line', () => {
      expect(parser.parse('')).toEqual({});
      expect(parser.parse(null)).toEqual({});
      expect(parser.parse(undefined)).toEqual({});
    });

    it('should skip parameters without handlers', () => {
      const line = 'Steps: 20, Unknown: value, Sampler: Euler';
      const result = parser.parse(line);
      
      expect(result).toEqual({
        steps: 20,
        sampler: 'Euler'
      });
    });

    it('should merge multiple ADetailer parameters', () => {
      const line = 'ADetailer model: face.pt, ADetailer confidence: 0.3, ADetailer steps: 10';
      const result = parser.parse(line);
      
      expect(result).toEqual({
        adetailer: {
          model: 'face.pt',
          confidence: 0.3,
          steps: 10
        }
      });
    });
  });

  describe('_tokenize', () => {
    it('should split by comma', () => {
      const tokens = parser._tokenize('a: 1, b: 2, c: 3');
      expect(tokens).toEqual(['a: 1', 'b: 2', 'c: 3']);
    });

    it('should respect quoted values', () => {
      const tokens = parser._tokenize('a: "1, 2", b: 3');
      expect(tokens).toEqual(['a: "1, 2"', 'b: 3']);
    });

    it('should handle single quotes', () => {
      const tokens = parser._tokenize("a: '1, 2', b: 3");
      expect(tokens).toEqual(["a: '1, 2'", 'b: 3']);
    });

    it('should trim whitespace', () => {
      const tokens = parser._tokenize('  a: 1  ,  b: 2  ');
      expect(tokens).toEqual(['a: 1', 'b: 2']);
    });

    it('should handle empty string', () => {
      expect(parser._tokenize('')).toEqual([]);
    });
  });

  describe('_parsePair', () => {
    it('should parse key-value pair', () => {
      expect(parser._parsePair('Steps: 20')).toEqual({ key: 'Steps', value: '20' });
      expect(parser._parsePair('Sampler: Euler a')).toEqual({ key: 'Sampler', value: 'Euler a' });
    });

    it('should remove quotes from value', () => {
      expect(parser._parsePair('key: "value"')).toEqual({ key: 'key', value: 'value' });
      expect(parser._parsePair("key: 'value'")).toEqual({ key: 'key', value: 'value' });
    });

    it('should trim whitespace', () => {
      expect(parser._parsePair('  key  :  value  ')).toEqual({ key: 'key', value: 'value' });
    });

    it('should handle missing colon', () => {
      expect(parser._parsePair('invalid')).toEqual({ key: null, value: null });
    });

    it('should handle value with colon', () => {
      expect(parser._parsePair('Lora hashes: lora1: hash1')).toEqual({ 
        key: 'Lora hashes', 
        value: 'lora1: hash1' 
      });
    });
  });

  describe('_mergeResult', () => {
    it('should merge simple values', () => {
      const target = { a: 1 };
      parser._mergeResult(target, { b: 2 });
      expect(target).toEqual({ a: 1, b: 2 });
    });

    it('should overwrite existing values', () => {
      const target = { a: 1 };
      parser._mergeResult(target, { a: 2 });
      expect(target).toEqual({ a: 2 });
    });

    it('should deep merge nested objects', () => {
      const target = { adetailer: { model: 'face.pt' } };
      parser._mergeResult(target, { adetailer: { confidence: 0.3 } });
      expect(target).toEqual({
        adetailer: {
          model: 'face.pt',
          confidence: 0.3
        }
      });
    });

    it('should not merge arrays', () => {
      const target = { loras: ['lora1'] };
      parser._mergeResult(target, { loras: ['lora2'] });
      expect(target).toEqual({ loras: ['lora2'] });
    });
  });
});
