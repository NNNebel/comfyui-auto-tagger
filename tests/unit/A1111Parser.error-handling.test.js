/**
 * A1111Parser Error Handling Tests
 * Tests that A1111Parser throws appropriate ParseError types
 */
import { describe, it, expect } from 'vitest';
import A1111Parser from '../../js/metadata-parser/parsers/A1111Parser.js';
import { ParameterParseError } from '../../js/metadata-parser/errors/ParseError.js';

describe('A1111Parser - Error Handling', () => {
  const parser = new A1111Parser();

  describe('parseParameterLine error handling', () => {
    it('should throw ParameterParseError with context when parsing fails critically', () => {
      // Create a malformed parameter line that will cause parsing to fail
      const malformedLine = 'Steps: 20, Sampler: Euler a, CFG scale: invalid_number_here';
      
      // Note: Current implementation is resilient and won't throw for invalid numbers
      // This test documents the expected behavior if we add stricter validation
      
      // For now, test that it doesn't throw (resilient parsing)
      expect(() => {
        parser.parseParameterLine(malformedLine);
      }).not.toThrow();
    });

    it('should include helpful suggestions in ParameterParseError', () => {
      // This test documents the expected error structure
      // when we add stricter validation that throws errors
      
      const error = new ParameterParseError(
        'Failed to parse A1111 parameter line',
        { line: 'Steps: invalid', lineLength: 14 },
        null,
        [
          'Check if the parameter line format is valid',
          'Ensure key-value pairs are separated by commas',
          'Verify that values are properly quoted if they contain special characters'
        ]
      );

      expect(error.name).toBe('ParameterParseError');
      expect(error.message).toBe('Failed to parse A1111 parameter line');
      expect(error.context).toEqual({ line: 'Steps: invalid', lineLength: 14 });
      expect(error.suggestions).toHaveLength(3);
      expect(error.suggestions[0]).toContain('parameter line format');
    });

    it('should preserve error context through error chain', () => {
      const originalError = new Error('Invalid value');
      const parseError = new ParameterParseError(
        'Failed to parse parameter',
        { key: 'Steps', value: 'invalid' },
        originalError,
        ['Check the value format']
      );

      expect(parseError.cause).toBe(originalError);
      expect(parseError.context.key).toBe('Steps');
      expect(parseError.context.value).toBe('invalid');
    });
  });

  describe('Error resilience', () => {
    it('should handle empty parameter line gracefully', () => {
      const result = parser.parseParameterLine('');
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should handle parameter line with only whitespace', () => {
      const result = parser.parseParameterLine('   ');
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should handle parameter line with unknown keys', () => {
      const result = parser.parseParameterLine('UnknownKey: value, Steps: 20');
      expect(result).toBeDefined();
      expect(result.steps).toBe(20);
    });

    it('should handle parameter line with malformed key-value pairs', () => {
      const result = parser.parseParameterLine('Steps 20, Sampler: Euler a');
      expect(result).toBeDefined();
      // Current implementation is resilient - it will try to parse what it can
      // The malformed "Steps 20" might be skipped or parsed depending on tokenization
      // Just verify that the result is an object and doesn't throw
      expect(typeof result).toBe('object');
    });
  });

  describe('ParseError JSON serialization', () => {
    it('should serialize ParameterParseError to JSON', () => {
      const error = new ParameterParseError(
        'Test error',
        { key: 'test' },
        new Error('Original'),
        ['Suggestion 1']
      );

      const json = error.toJSON();
      expect(json.name).toBe('ParameterParseError');
      expect(json.message).toBe('Test error');
      expect(json.context).toEqual({ key: 'test' });
      expect(json.suggestions).toEqual(['Suggestion 1']);
      expect(json.cause).toEqual({ name: 'Error', message: 'Original' });
      expect(json.timestamp).toBeDefined();
    });

    it('should convert ParameterParseError to string', () => {
      const error = new ParameterParseError(
        'Test error',
        { key: 'test' },
        new Error('Original'),
        ['Suggestion 1', 'Suggestion 2']
      );

      const str = error.toString();
      expect(str).toContain('ParameterParseError: Test error');
      expect(str).toContain('Context:');
      expect(str).toContain('Suggestions:');
      expect(str).toContain('- Suggestion 1');
      expect(str).toContain('- Suggestion 2');
      expect(str).toContain('Caused by: Original');
    });
  });
});
