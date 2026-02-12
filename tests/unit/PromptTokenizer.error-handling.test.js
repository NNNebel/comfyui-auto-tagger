/**
 * PromptTokenizer Error Handling Tests
 * Tests that PromptTokenizer throws appropriate ParseError types
 */
import { describe, it, expect } from 'vitest';
import PromptTokenizer from '../../js/metadata-parser/prompt/PromptTokenizer.js';
import { TokenizationError } from '../../js/metadata-parser/errors/ParseError.js';

describe('PromptTokenizer - Error Handling', () => {
  const tokenizer = new PromptTokenizer();

  describe('tokenize error handling', () => {
    it('should handle empty input gracefully', () => {
      const tokens = tokenizer.tokenize('');
      expect(tokens).toEqual([]);
    });

    it('should handle null input gracefully', () => {
      const tokens = tokenizer.tokenize(null);
      expect(tokens).toEqual([]);
    });

    it('should handle undefined input gracefully', () => {
      const tokens = tokenizer.tokenize(undefined);
      expect(tokens).toEqual([]);
    });

    it('should handle non-string input gracefully', () => {
      const tokens = tokenizer.tokenize(123);
      expect(tokens).toEqual([]);
    });

    it('should handle very long prompts without infinite loops', () => {
      // Create a very long prompt
      const longPrompt = 'word, '.repeat(10000) + 'final word';
      
      // Should complete without throwing
      const tokens = tokenizer.tokenize(longPrompt);
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should handle deeply nested brackets', () => {
      // Create deeply nested brackets
      const nested = '((((((text))))))';
      
      // Should handle without throwing
      const tokens = tokenizer.tokenize(nested);
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should handle unmatched opening brackets', () => {
      const unmatched = '(text without closing';
      
      // Should handle gracefully
      const tokens = tokenizer.tokenize(unmatched);
      expect(tokens).toBeDefined();
    });

    it('should handle unmatched closing brackets', () => {
      const unmatched = 'text without opening)';
      
      // Should handle gracefully
      const tokens = tokenizer.tokenize(unmatched);
      expect(tokens).toBeDefined();
    });

    it('should handle malformed special tags', () => {
      const malformed = '<lora:incomplete';
      
      // Should handle gracefully
      const tokens = tokenizer.tokenize(malformed);
      expect(tokens).toBeDefined();
    });

    it('should handle mixed valid and invalid syntax', () => {
      const mixed = 'valid text, (weighted:1.2), <lora:test:0.8>, ((broken';
      
      // Should parse valid parts
      const tokens = tokenizer.tokenize(mixed);
      expect(tokens.length).toBeGreaterThan(0);
      
      // Should have valid tokens
      const hasText = tokens.some(t => t.isText());
      const hasWeighted = tokens.some(t => t.isWeighted());
      const hasSpecialTag = tokens.some(t => t.isSpecialTag());
      
      expect(hasText || hasWeighted || hasSpecialTag).toBe(true);
    });
  });

  describe('TokenizationError structure', () => {
    it('should create TokenizationError with context', () => {
      const error = new TokenizationError(
        'Failed to tokenize',
        { position: 42, textPreview: 'preview text' },
        null,
        ['Check bracket matching', 'Verify tag syntax']
      );

      expect(error.name).toBe('TokenizationError');
      expect(error.message).toBe('Failed to tokenize');
      expect(error.context.position).toBe(42);
      expect(error.context.textPreview).toBe('preview text');
      expect(error.suggestions).toHaveLength(2);
    });

    it('should preserve error chain', () => {
      const originalError = new Error('Original error');
      const tokenError = new TokenizationError(
        'Tokenization failed',
        { position: 10 },
        originalError,
        ['Suggestion']
      );

      expect(tokenError.cause).toBe(originalError);
      expect(tokenError.cause.message).toBe('Original error');
    });

    it('should serialize TokenizationError to JSON', () => {
      const error = new TokenizationError(
        'Test error',
        { position: 5 },
        new Error('Cause'),
        ['Fix syntax']
      );

      const json = error.toJSON();
      expect(json.name).toBe('TokenizationError');
      expect(json.message).toBe('Test error');
      expect(json.context.position).toBe(5);
      expect(json.suggestions).toEqual(['Fix syntax']);
      expect(json.cause).toEqual({ name: 'Error', message: 'Cause' });
      expect(json.timestamp).toBeDefined();
    });

    it('should convert TokenizationError to string', () => {
      const error = new TokenizationError(
        'Test error',
        { position: 5, text: 'sample' },
        new Error('Cause'),
        ['Suggestion 1', 'Suggestion 2']
      );

      const str = error.toString();
      expect(str).toContain('TokenizationError: Test error');
      expect(str).toContain('Context:');
      expect(str).toContain('Suggestions:');
      expect(str).toContain('- Suggestion 1');
      expect(str).toContain('- Suggestion 2');
      expect(str).toContain('Caused by: Cause');
    });
  });

  describe('Error resilience in real-world scenarios', () => {
    it('should handle prompts with special characters', () => {
      const prompt = 'text with @#$%^&* special chars, (weighted:1.5)';
      const tokens = tokenizer.tokenize(prompt);
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should handle prompts with unicode characters', () => {
      const prompt = '美しい風景, (詳細な顔:1.2), <lora:anime:0.8>';
      const tokens = tokenizer.tokenize(prompt);
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should handle prompts with newlines', () => {
      const prompt = 'line 1\nline 2\nline 3';
      const tokens = tokenizer.tokenize(prompt);
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should handle prompts with tabs', () => {
      const prompt = 'text\twith\ttabs';
      const tokens = tokenizer.tokenize(prompt);
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should handle empty weighted brackets', () => {
      const prompt = 'text, (), more text';
      const tokens = tokenizer.tokenize(prompt);
      expect(tokens).toBeDefined();
    });

    it('should handle empty special tags', () => {
      const prompt = 'text, <>, more text';
      const tokens = tokenizer.tokenize(prompt);
      expect(tokens).toBeDefined();
    });
  });
});
