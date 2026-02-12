import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const PromptTokenizer = require('../../js/metadata-parser/prompt/PromptTokenizer.js');
const { TokenType } = require('../../js/metadata-parser/prompt/PromptToken.js');

describe('PromptTokenizer', () => {
  let tokenizer;

  beforeEach(() => {
    tokenizer = new PromptTokenizer();
  });

  describe('tokenize', () => {
    describe('plain text', () => {
      it('should tokenize simple text', () => {
        const tokens = tokenizer.tokenize('beautiful landscape');
        expect(tokens).toHaveLength(1);
        expect(tokens[0].type).toBe(TokenType.TEXT);
        expect(tokens[0].text).toBe('beautiful landscape');
      });

      it('should tokenize comma-separated text', () => {
        const tokens = tokenizer.tokenize('beautiful, landscape, detailed');
        expect(tokens).toHaveLength(3);
        expect(tokens[0].text).toBe('beautiful');
        expect(tokens[1].text).toBe('landscape');
        expect(tokens[2].text).toBe('detailed');
      });

      it('should handle empty string', () => {
        const tokens = tokenizer.tokenize('');
        expect(tokens).toHaveLength(0);
      });

      it('should handle null input', () => {
        const tokens = tokenizer.tokenize(null);
        expect(tokens).toHaveLength(0);
      });

      it('should trim whitespace', () => {
        const tokens = tokenizer.tokenize('  beautiful  ,  landscape  ');
        expect(tokens).toHaveLength(2);
        expect(tokens[0].text).toBe('beautiful');
        expect(tokens[1].text).toBe('landscape');
      });
    });

    describe('weighted text', () => {
      it('should tokenize weighted text with explicit weight', () => {
        const tokens = tokenizer.tokenize('(detailed face:1.2)');
        expect(tokens).toHaveLength(1);
        expect(tokens[0].type).toBe(TokenType.WEIGHTED);
        expect(tokens[0].text).toBe('detailed face');
        expect(tokens[0].getWeight()).toBe(1.2);
      });

      it('should tokenize weighted text without weight (default 1.1)', () => {
        const tokens = tokenizer.tokenize('(detailed face)');
        expect(tokens).toHaveLength(1);
        expect(tokens[0].type).toBe(TokenType.WEIGHTED);
        expect(tokens[0].text).toBe('detailed face');
        expect(tokens[0].getWeight()).toBe(1.1);
      });

      it('should handle nested brackets', () => {
        const tokens = tokenizer.tokenize('((very detailed):1.3)');
        expect(tokens).toHaveLength(1);
        expect(tokens[0].type).toBe(TokenType.WEIGHTED);
        expect(tokens[0].text).toBe('(very detailed)');
        expect(tokens[0].getWeight()).toBe(1.3);
      });

      it('should handle multiple weighted texts', () => {
        const tokens = tokenizer.tokenize('(detailed:1.2), (beautiful:1.1)');
        expect(tokens).toHaveLength(2);
        expect(tokens[0].text).toBe('detailed');
        expect(tokens[0].getWeight()).toBe(1.2);
        expect(tokens[1].text).toBe('beautiful');
        expect(tokens[1].getWeight()).toBe(1.1);
      });
    });

    describe('special tags', () => {
      it('should tokenize LoRA tag', () => {
        const tokens = tokenizer.tokenize('<lora:my_lora:0.8>');
        expect(tokens).toHaveLength(1);
        expect(tokens[0].type).toBe(TokenType.LORA);
        expect(tokens[0].text).toBe('my_lora');
        expect(tokens[0].getWeight()).toBe(0.8);
      });

      it('should tokenize LoRA tag without weight', () => {
        const tokens = tokenizer.tokenize('<lora:my_lora>');
        expect(tokens).toHaveLength(1);
        expect(tokens[0].type).toBe(TokenType.LORA);
        expect(tokens[0].text).toBe('my_lora');
        expect(tokens[0].getWeight()).toBe(1.0);
      });

      it('should tokenize hypernet tag', () => {
        const tokens = tokenizer.tokenize('<hypernet:my_hypernet:0.5>');
        expect(tokens).toHaveLength(1);
        expect(tokens[0].type).toBe(TokenType.HYPERNET);
        expect(tokens[0].text).toBe('my_hypernet');
        expect(tokens[0].getWeight()).toBe(0.5);
      });

      it('should tokenize embedding tag', () => {
        const tokens = tokenizer.tokenize('<my_embedding>');
        expect(tokens).toHaveLength(1);
        expect(tokens[0].type).toBe(TokenType.EMBEDDING);
        expect(tokens[0].text).toBe('my_embedding');
      });

      it('should tokenize lyco tag', () => {
        const tokens = tokenizer.tokenize('<lyco:my_lyco:0.7>');
        expect(tokens).toHaveLength(1);
        expect(tokens[0].type).toBe(TokenType.LYCO);
        expect(tokens[0].text).toBe('my_lyco');
        expect(tokens[0].getWeight()).toBe(0.7);
      });

      it('should tokenize embedding tag with embedding prefix', () => {
        const tokens = tokenizer.tokenize('<embedding:my_embedding>');
        expect(tokens).toHaveLength(1);
        expect(tokens[0].type).toBe(TokenType.EMBEDDING);
        expect(tokens[0].text).toBe('my_embedding');
      });
    });

    describe('mixed content', () => {
      it('should tokenize mixed text and weighted text', () => {
        const tokens = tokenizer.tokenize('beautiful landscape, (detailed face:1.2)');
        expect(tokens).toHaveLength(2);
        expect(tokens[0].type).toBe(TokenType.TEXT);
        expect(tokens[0].text).toBe('beautiful landscape');
        expect(tokens[1].type).toBe(TokenType.WEIGHTED);
        expect(tokens[1].text).toBe('detailed face');
      });

      it('should tokenize mixed text and special tags', () => {
        const tokens = tokenizer.tokenize('beautiful landscape, <lora:my_lora:0.8>');
        expect(tokens).toHaveLength(2);
        expect(tokens[0].type).toBe(TokenType.TEXT);
        expect(tokens[1].type).toBe(TokenType.LORA);
      });

      it('should tokenize complex prompt', () => {
        const tokens = tokenizer.tokenize('beautiful landscape, (detailed face:1.2), <lora:my_lora:0.8>, masterpiece');
        expect(tokens).toHaveLength(4);
        expect(tokens[0].type).toBe(TokenType.TEXT);
        expect(tokens[1].type).toBe(TokenType.WEIGHTED);
        expect(tokens[2].type).toBe(TokenType.LORA);
        expect(tokens[3].type).toBe(TokenType.TEXT);
      });
    });

    describe('edge cases', () => {
      it('should handle unmatched opening bracket', () => {
        const tokens = tokenizer.tokenize('(unmatched');
        // Should treat as plain text or skip
        expect(tokens.length).toBeGreaterThanOrEqual(0);
      });

      it('should handle unmatched closing bracket', () => {
        const tokens = tokenizer.tokenize('unmatched)');
        expect(tokens).toHaveLength(1);
        expect(tokens[0].text).toBe('unmatched');
      });

      it('should handle empty brackets', () => {
        const tokens = tokenizer.tokenize('()');
        // Empty brackets should be skipped
        expect(tokens).toHaveLength(0);
      });

      it('should handle unclosed tag', () => {
        const tokens = tokenizer.tokenize('<lora:my_lora');
        // Unclosed tag should be skipped or treated as text
        expect(tokens.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('extractTags', () => {
    it('should extract plain text tags', () => {
      const tokens = tokenizer.tokenize('beautiful, landscape, detailed');
      const tags = tokenizer.extractTags(tokens);
      expect(tags).toEqual(['beautiful', 'landscape', 'detailed']);
    });

    it('should not include weighted text by default', () => {
      const tokens = tokenizer.tokenize('beautiful, (detailed:1.2)');
      const tags = tokenizer.extractTags(tokens);
      expect(tags).toEqual(['beautiful']);
    });

    it('should include weighted text when option is set', () => {
      const tokens = tokenizer.tokenize('beautiful, (detailed:1.2)');
      const tags = tokenizer.extractTags(tokens, { includeWeighted: true });
      expect(tags).toEqual(['beautiful', 'detailed']);
    });

    it('should not include special tags by default', () => {
      const tokens = tokenizer.tokenize('beautiful, <lora:my_lora:0.8>');
      const tags = tokenizer.extractTags(tokens);
      expect(tags).toEqual(['beautiful']);
    });

    it('should include special tags when option is set', () => {
      const tokens = tokenizer.tokenize('beautiful, <lora:my_lora:0.8>');
      const tags = tokenizer.extractTags(tokens, { includeSpecialTags: true });
      expect(tags).toEqual(['beautiful', 'my_lora']);
    });

    it('should add prefix to tags', () => {
      const tokens = tokenizer.tokenize('beautiful, landscape');
      const tags = tokenizer.extractTags(tokens, { prefix: 'neg:' });
      expect(tags).toEqual(['neg:beautiful', 'neg:landscape']);
    });

    it('should convert tags to lowercase', () => {
      const tokens = tokenizer.tokenize('Beautiful, LANDSCAPE');
      const tags = tokenizer.extractTags(tokens);
      expect(tags).toEqual(['beautiful', 'landscape']);
    });
  });

  describe('reconstruct', () => {
    it('should reconstruct plain text', () => {
      const tokens = tokenizer.tokenize('beautiful, landscape');
      const reconstructed = tokenizer.reconstruct(tokens);
      expect(reconstructed).toBe('beautiful, landscape');
    });

    it('should reconstruct weighted text', () => {
      const tokens = tokenizer.tokenize('(detailed:1.2)');
      const reconstructed = tokenizer.reconstruct(tokens);
      expect(reconstructed).toBe('(detailed:1.2)');
    });

    it('should reconstruct LoRA tag', () => {
      const tokens = tokenizer.tokenize('<lora:my_lora:0.8>');
      const reconstructed = tokenizer.reconstruct(tokens);
      expect(reconstructed).toBe('<lora:my_lora:0.8>');
    });

    it('should reconstruct complex prompt', () => {
      const tokens = tokenizer.tokenize('beautiful, (detailed:1.2), <lora:my_lora:0.8>');
      const reconstructed = tokenizer.reconstruct(tokens);
      expect(reconstructed).toBe('beautiful, (detailed:1.2), <lora:my_lora:0.8>');
    });
  });
});
