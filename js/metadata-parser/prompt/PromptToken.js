/**
 * PromptToken.js - Token representation for prompt parsing
 * Universal module (Browser + Node.js)
 */
(function(global) {
  'use strict';

/**
 * Token types for prompt parsing
 * @enum {string}
 */
const TokenType = {
  TEXT: 'text',           // Plain text
  WEIGHTED: 'weighted',   // Weighted text (text:weight)
  LORA: 'lora',          // LoRA tag <lora:name:weight>
  HYPERNET: 'hypernet',  // Hypernetwork tag <hypernet:name:weight>
  EMBEDDING: 'embedding', // Textual Inversion embedding <embedding:name>
  LYCO: 'lyco'           // LyCORIS tag <lyco:name:weight>
};

/**
 * PromptToken - Represents a single token in a prompt
 * 
 * A token can be plain text, weighted text, or a special tag (LoRA, hypernet, embedding).
 * 
 * @example
 * // Plain text token
 * const token1 = new PromptToken(TokenType.TEXT, 'beautiful landscape');
 * 
 * // Weighted text token
 * const token2 = new PromptToken(TokenType.WEIGHTED, 'detailed face', { weight: 1.2 });
 * 
 * // LoRA token
 * const token3 = new PromptToken(TokenType.LORA, 'my_lora', { weight: 0.8 });
 */
class PromptToken {
  /**
   * Create a new PromptToken
   * @param {string} type - Token type from TokenType enum
   * @param {string} text - Token text content
   * @param {Object} [metadata={}] - Additional metadata (weight, etc.)
   */
  constructor(type, text, metadata = {}) {
    this.type = type;
    this.text = text;
    this.metadata = metadata;
  }

  /**
   * Check if token is a special tag (LoRA, hypernet, embedding)
   * @returns {boolean} True if token is a special tag
   */
  isSpecialTag() {
    return this.type === TokenType.LORA ||
           this.type === TokenType.HYPERNET ||
           this.type === TokenType.EMBEDDING ||
           this.type === TokenType.LYCO;
  }

  /**
   * Check if token is weighted text
   * @returns {boolean} True if token is weighted
   */
  isWeighted() {
    return this.type === TokenType.WEIGHTED;
  }

  /**
   * Check if token is plain text
   * @returns {boolean} True if token is plain text
   */
  isText() {
    return this.type === TokenType.TEXT;
  }

  /**
   * Get token weight (1.0 for unweighted tokens)
   * @returns {number} Token weight
   */
  getWeight() {
    return this.metadata.weight || 1.0;
  }

  /**
   * Convert token to string representation
   * @returns {string} String representation
   */
  toString() {
    if (this.type === TokenType.TEXT) {
      return this.text;
    }
    if (this.type === TokenType.WEIGHTED) {
      return `(${this.text}:${this.getWeight()})`;
    }
    if (this.type === TokenType.LORA) {
      return `<lora:${this.text}:${this.getWeight()}>`;
    }
    if (this.type === TokenType.HYPERNET) {
      return `<hypernet:${this.text}:${this.getWeight()}>`;
    }
    if (this.type === TokenType.EMBEDDING) {
      return `<${this.text}>`;
    }
    if (this.type === TokenType.LYCO) {
      return `<lyco:${this.text}:${this.getWeight()}>`;
    }
    return this.text;
  }
}

// Export TokenType and PromptToken
if (typeof window !== 'undefined') {
  window.TokenType = TokenType;
  window.PromptToken = PromptToken;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TokenType, PromptToken };
}

})(typeof window !== 'undefined' ? window : global);
