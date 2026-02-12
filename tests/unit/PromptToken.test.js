import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { TokenType, PromptToken } = require('../../js/metadata-parser/prompt/PromptToken.js');

describe('PromptToken', () => {
  describe('constructor', () => {
    it('should create a text token', () => {
      const token = new PromptToken(TokenType.TEXT, 'beautiful landscape');
      expect(token.type).toBe(TokenType.TEXT);
      expect(token.text).toBe('beautiful landscape');
      expect(token.metadata).toEqual({});
    });

    it('should create a weighted token with metadata', () => {
      const token = new PromptToken(TokenType.WEIGHTED, 'detailed face', { weight: 1.2 });
      expect(token.type).toBe(TokenType.WEIGHTED);
      expect(token.text).toBe('detailed face');
      expect(token.metadata.weight).toBe(1.2);
    });

    it('should create a LoRA token', () => {
      const token = new PromptToken(TokenType.LORA, 'my_lora', { weight: 0.8 });
      expect(token.type).toBe(TokenType.LORA);
      expect(token.text).toBe('my_lora');
      expect(token.metadata.weight).toBe(0.8);
    });
  });

  describe('isSpecialTag', () => {
    it('should return true for LoRA tokens', () => {
      const token = new PromptToken(TokenType.LORA, 'my_lora', { weight: 0.8 });
      expect(token.isSpecialTag()).toBe(true);
    });

    it('should return true for hypernet tokens', () => {
      const token = new PromptToken(TokenType.HYPERNET, 'my_hypernet', { weight: 0.5 });
      expect(token.isSpecialTag()).toBe(true);
    });

    it('should return true for embedding tokens', () => {
      const token = new PromptToken(TokenType.EMBEDDING, 'my_embedding');
      expect(token.isSpecialTag()).toBe(true);
    });

    it('should return false for text tokens', () => {
      const token = new PromptToken(TokenType.TEXT, 'plain text');
      expect(token.isSpecialTag()).toBe(false);
    });

    it('should return false for weighted tokens', () => {
      const token = new PromptToken(TokenType.WEIGHTED, 'weighted text', { weight: 1.2 });
      expect(token.isSpecialTag()).toBe(false);
    });
  });

  describe('isWeighted', () => {
    it('should return true for weighted tokens', () => {
      const token = new PromptToken(TokenType.WEIGHTED, 'weighted text', { weight: 1.2 });
      expect(token.isWeighted()).toBe(true);
    });

    it('should return false for text tokens', () => {
      const token = new PromptToken(TokenType.TEXT, 'plain text');
      expect(token.isWeighted()).toBe(false);
    });
  });

  describe('isText', () => {
    it('should return true for text tokens', () => {
      const token = new PromptToken(TokenType.TEXT, 'plain text');
      expect(token.isText()).toBe(true);
    });

    it('should return false for weighted tokens', () => {
      const token = new PromptToken(TokenType.WEIGHTED, 'weighted text', { weight: 1.2 });
      expect(token.isText()).toBe(false);
    });
  });

  describe('getWeight', () => {
    it('should return weight for weighted tokens', () => {
      const token = new PromptToken(TokenType.WEIGHTED, 'weighted text', { weight: 1.2 });
      expect(token.getWeight()).toBe(1.2);
    });

    it('should return 1.0 for tokens without weight', () => {
      const token = new PromptToken(TokenType.TEXT, 'plain text');
      expect(token.getWeight()).toBe(1.0);
    });

    it('should return weight for LoRA tokens', () => {
      const token = new PromptToken(TokenType.LORA, 'my_lora', { weight: 0.8 });
      expect(token.getWeight()).toBe(0.8);
    });
  });

  describe('toString', () => {
    it('should convert text token to string', () => {
      const token = new PromptToken(TokenType.TEXT, 'beautiful landscape');
      expect(token.toString()).toBe('beautiful landscape');
    });

    it('should convert weighted token to string', () => {
      const token = new PromptToken(TokenType.WEIGHTED, 'detailed face', { weight: 1.2 });
      expect(token.toString()).toBe('(detailed face:1.2)');
    });

    it('should convert LoRA token to string', () => {
      const token = new PromptToken(TokenType.LORA, 'my_lora', { weight: 0.8 });
      expect(token.toString()).toBe('<lora:my_lora:0.8>');
    });

    it('should convert hypernet token to string', () => {
      const token = new PromptToken(TokenType.HYPERNET, 'my_hypernet', { weight: 0.5 });
      expect(token.toString()).toBe('<hypernet:my_hypernet:0.5>');
    });

    it('should convert embedding token to string', () => {
      const token = new PromptToken(TokenType.EMBEDDING, 'my_embedding');
      expect(token.toString()).toBe('<my_embedding>');
    });

    it('should convert lyco token to string', () => {
      const token = new PromptToken(TokenType.LYCO, 'my_lyco', { weight: 0.7 });
      expect(token.toString()).toBe('<lyco:my_lyco:0.7>');
    });
  });
});
