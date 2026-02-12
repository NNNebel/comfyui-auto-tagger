import { describe, it, expect } from 'vitest';
import ParsingUtils from '../../js/metadata-parser/utils/ParsingUtils.js';

describe('ParsingUtils', () => {
  describe('parseJsonSafely', () => {
    it('should parse valid JSON', () => {
      const result = ParsingUtils.parseJsonSafely('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('should parse valid JSON array', () => {
      const result = ParsingUtils.parseJsonSafely('[1, 2, 3]');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should return fallback for invalid JSON', () => {
      const result = ParsingUtils.parseJsonSafely('invalid json', {});
      expect(result).toEqual({});
    });

    it('should return null fallback by default', () => {
      const result = ParsingUtils.parseJsonSafely('invalid json');
      expect(result).toBeNull();
    });

    it('should return fallback for empty string', () => {
      const result = ParsingUtils.parseJsonSafely('', { default: true });
      expect(result).toEqual({ default: true });
    });

    it('should return fallback for null input', () => {
      const result = ParsingUtils.parseJsonSafely(null, []);
      expect(result).toEqual([]);
    });

    it('should return fallback for non-string input', () => {
      const result = ParsingUtils.parseJsonSafely(123, 'fallback');
      expect(result).toBe('fallback');
    });

    it('should handle nested JSON objects', () => {
      const json = '{"outer": {"inner": "value"}}';
      const result = ParsingUtils.parseJsonSafely(json);
      expect(result).toEqual({ outer: { inner: 'value' } });
    });
  });

  describe('parseValue', () => {
    it('should parse positive integer', () => {
      expect(ParsingUtils.parseValue('123')).toBe(123);
    });

    it('should parse negative integer', () => {
      expect(ParsingUtils.parseValue('-456')).toBe(-456);
    });

    it('should parse positive float', () => {
      expect(ParsingUtils.parseValue('3.14')).toBe(3.14);
    });

    it('should parse negative float', () => {
      expect(ParsingUtils.parseValue('-2.5')).toBe(-2.5);
    });

    it('should parse "true" as boolean', () => {
      expect(ParsingUtils.parseValue('true')).toBe(true);
    });

    it('should parse "True" as boolean', () => {
      expect(ParsingUtils.parseValue('True')).toBe(true);
    });

    it('should parse "false" as boolean', () => {
      expect(ParsingUtils.parseValue('false')).toBe(false);
    });

    it('should parse "False" as boolean', () => {
      expect(ParsingUtils.parseValue('False')).toBe(false);
    });

    it('should return string unchanged for text', () => {
      expect(ParsingUtils.parseValue('hello')).toBe('hello');
    });

    it('should return string unchanged for mixed alphanumeric', () => {
      expect(ParsingUtils.parseValue('abc123')).toBe('abc123');
    });

    it('should return non-string values unchanged', () => {
      expect(ParsingUtils.parseValue(123)).toBe(123);
      expect(ParsingUtils.parseValue(true)).toBe(true);
      expect(ParsingUtils.parseValue(null)).toBe(null);
    });

    it('should handle zero', () => {
      expect(ParsingUtils.parseValue('0')).toBe(0);
    });

    it('should handle zero float', () => {
      expect(ParsingUtils.parseValue('0.0')).toBe(0.0);
    });
  });

  describe('extractFilename', () => {
    it('should extract filename from Unix path', () => {
      const result = ParsingUtils.extractFilename('/home/user/models/model.safetensors');
      expect(result).toBe('model.safetensors');
    });

    it('should extract filename from Windows path', () => {
      const result = ParsingUtils.extractFilename('C:\\models\\model.safetensors');
      expect(result).toBe('model.safetensors');
    });

    it('should extract filename from mixed path separators', () => {
      const result = ParsingUtils.extractFilename('C:/models\\subfolder/model.ckpt');
      expect(result).toBe('model.ckpt');
    });

    it('should return filename when no path', () => {
      const result = ParsingUtils.extractFilename('model.safetensors');
      expect(result).toBe('model.safetensors');
    });

    it('should return empty string for empty input', () => {
      expect(ParsingUtils.extractFilename('')).toBe('');
    });

    it('should return empty string for null input', () => {
      expect(ParsingUtils.extractFilename(null)).toBe('');
    });

    it('should return empty string for non-string input', () => {
      expect(ParsingUtils.extractFilename(123)).toBe('');
    });

    it('should handle path ending with separator', () => {
      const result = ParsingUtils.extractFilename('/path/to/folder/');
      expect(result).toBe('');
    });
  });

  describe('extractBaseName', () => {
    it('should extract basename from filename', () => {
      const result = ParsingUtils.extractBaseName('model.safetensors');
      expect(result).toBe('model');
    });

    it('should extract basename from path', () => {
      const result = ParsingUtils.extractBaseName('/path/to/model.ckpt');
      expect(result).toBe('model');
    });

    it('should handle multiple dots in filename', () => {
      const result = ParsingUtils.extractBaseName('model.v1.0.safetensors');
      expect(result).toBe('model.v1.0');
    });

    it('should handle filename without extension', () => {
      const result = ParsingUtils.extractBaseName('model');
      expect(result).toBe('model');
    });

    it('should return empty string for empty input', () => {
      expect(ParsingUtils.extractBaseName('')).toBe('');
    });

    it('should handle hidden files (Unix)', () => {
      const result = ParsingUtils.extractBaseName('.gitignore');
      expect(result).toBe('');
    });
  });

  describe('splitLines', () => {
    it('should split lines with LF', () => {
      const result = ParsingUtils.splitLines('line1\nline2\nline3');
      expect(result).toEqual(['line1', 'line2', 'line3']);
    });

    it('should split lines with CRLF', () => {
      const result = ParsingUtils.splitLines('line1\r\nline2\r\nline3');
      expect(result).toEqual(['line1', 'line2', 'line3']);
    });

    it('should split lines with CR', () => {
      const result = ParsingUtils.splitLines('line1\rline2\rline3');
      expect(result).toEqual(['line1', 'line2', 'line3']);
    });

    it('should split lines with mixed line endings', () => {
      const result = ParsingUtils.splitLines('line1\nline2\r\nline3\rline4');
      expect(result).toEqual(['line1', 'line2', 'line3', 'line4']);
    });

    it('should return single element for no line breaks', () => {
      const result = ParsingUtils.splitLines('single line');
      expect(result).toEqual(['single line']);
    });

    it('should return empty array for empty string', () => {
      const result = ParsingUtils.splitLines('');
      expect(result).toEqual([]);
    });

    it('should return empty array for null input', () => {
      const result = ParsingUtils.splitLines(null);
      expect(result).toEqual([]);
    });

    it('should handle trailing newline', () => {
      const result = ParsingUtils.splitLines('line1\nline2\n');
      expect(result).toEqual(['line1', 'line2', '']);
    });
  });

  describe('parseKeyValuePairs', () => {
    it('should parse comma-separated key-value pairs', () => {
      const result = ParsingUtils.parseKeyValuePairs('Steps: 20, Sampler: Euler, CFG: 7');
      expect(result).toEqual({
        Steps: '20',
        Sampler: 'Euler',
        CFG: '7'
      });
    });

    it('should handle spaces around separators', () => {
      const result = ParsingUtils.parseKeyValuePairs('key1: value1 , key2: value2');
      expect(result).toEqual({
        key1: 'value1',
        key2: 'value2'
      });
    });

    it('should handle custom separator', () => {
      const result = ParsingUtils.parseKeyValuePairs('key1: value1; key2: value2', ';');
      expect(result).toEqual({
        key1: 'value1',
        key2: 'value2'
      });
    });

    it('should skip items without colon', () => {
      const result = ParsingUtils.parseKeyValuePairs('key1: value1, invalid, key2: value2');
      expect(result).toEqual({
        key1: 'value1',
        key2: 'value2'
      });
    });

    it('should handle empty value', () => {
      const result = ParsingUtils.parseKeyValuePairs('key1:, key2: value2');
      expect(result).toEqual({
        key1: '',
        key2: 'value2'
      });
    });

    it('should handle value with colon', () => {
      const result = ParsingUtils.parseKeyValuePairs('time: 12:30, date: 2024-01-01');
      expect(result).toEqual({
        time: '12:30',
        date: '2024-01-01'
      });
    });

    it('should return empty object for empty string', () => {
      const result = ParsingUtils.parseKeyValuePairs('');
      expect(result).toEqual({});
    });

    it('should return empty object for null input', () => {
      const result = ParsingUtils.parseKeyValuePairs(null);
      expect(result).toEqual({});
    });

    it('should skip empty keys', () => {
      const result = ParsingUtils.parseKeyValuePairs(': value1, key2: value2');
      expect(result).toEqual({
        key2: 'value2'
      });
    });
  });
});
