/**
 * PromptTokenizer.js - Tokenizes prompt text into structured tokens
 * Universal module (Browser + Node.js)
 */
(function(global) {
  'use strict';

  // Get dependencies for both environments
  var TokenType, PromptToken;
  
  if (typeof window !== 'undefined') {
    // Browser environment
    TokenType = window.TokenType;
    PromptToken = window.PromptToken;
  } else if (typeof require !== 'undefined') {
    // Node.js environment (testing)
    const promptToken = require('./PromptToken');
    TokenType = promptToken.TokenType;
    PromptToken = promptToken.PromptToken;
  } else {
    throw new Error('Required dependencies not found');
  }

/**
 * PromptTokenizer - Tokenizes prompt text into structured tokens
 * 
 * Handles:
 * - Plain text
 * - Weighted text: (text:weight) or (text)
 * - LoRA tags: <lora:name:weight>
 * - Hypernet tags: <hypernet:name:weight>
 * - Embedding tags: <embedding:name>
 * - LyCORIS tags: <lyco:name:weight>
 * - Nested brackets
 * 
 * @example
 * const tokenizer = new PromptTokenizer();
 * const tokens = tokenizer.tokenize('beautiful landscape, (detailed face:1.2), <lora:my_lora:0.8>');
 * const tags = tokenizer.extractTags(tokens, { includeWeighted: false });
 */
class PromptTokenizer {
  /**
   * Tokenize prompt text into structured tokens
   * @param {string} text - Prompt text to tokenize
   * @returns {PromptToken[]} Array of tokens
   */
  tokenize(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const tokens = [];
    let i = 0;

    while (i < text.length) {
      const char = text[i];

      // Skip whitespace at the beginning
      if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
        i++;
        continue;
      }

      // Parse special tags <lora:...>, <hypernet:...>, etc.
      if (char === '<') {
        const result = this._parseTag(text, i);
        if (result) {
          tokens.push(result.token);
          i = result.endIndex;
          continue;
        }
      }

      // Parse weighted text (text:weight) or (text)
      if (char === '(') {
        const result = this._parseWeighted(text, i);
        if (result) {
          tokens.push(result.token);
          i = result.endIndex;
          continue;
        }
      }

      // Parse plain text
      const result = this._parsePlainText(text, i);
      if (result) {
        tokens.push(result.token);
        i = result.endIndex;
      } else {
        // Skip unrecognized character
        i++;
      }
    }

    return tokens;
  }

  /**
   * Parse special tag <lora:name:weight>, <hypernet:name:weight>, etc.
   * @private
   * @param {string} text - Full text
   * @param {number} startIndex - Start index of '<'
   * @returns {Object|null} { token, endIndex } or null if not a valid tag
   */
  _parseTag(text, startIndex) {
    const endIndex = text.indexOf('>', startIndex);
    if (endIndex === -1) {
      return null;
    }

    const content = text.substring(startIndex + 1, endIndex);
    const parts = content.split(':');

    // <lora:name:weight>
    if (parts[0] === 'lora' && parts.length >= 2) {
      const name = parts[1];
      const weight = parts.length >= 3 ? parseFloat(parts[2]) : 1.0;
      return {
        token: new PromptToken(TokenType.LORA, name, { weight }),
        endIndex: endIndex + 1
      };
    }

    // <hypernet:name:weight>
    if (parts[0] === 'hypernet' && parts.length >= 2) {
      const name = parts[1];
      const weight = parts.length >= 3 ? parseFloat(parts[2]) : 1.0;
      return {
        token: new PromptToken(TokenType.HYPERNET, name, { weight }),
        endIndex: endIndex + 1
      };
    }

    // <lyco:name:weight>
    if (parts[0] === 'lyco' && parts.length >= 2) {
      const name = parts[1];
      const weight = parts.length >= 3 ? parseFloat(parts[2]) : 1.0;
      return {
        token: new PromptToken(TokenType.LYCO, name, { weight }),
        endIndex: endIndex + 1
      };
    }

    // <embedding:name> or just <name>
    if (parts.length === 1 || (parts[0] === 'embedding' && parts.length === 2)) {
      const name = parts.length === 1 ? parts[0] : parts[1];
      return {
        token: new PromptToken(TokenType.EMBEDDING, name, {}),
        endIndex: endIndex + 1
      };
    }

    return null;
  }

  /**
   * Parse weighted text (text:weight) or (text)
   * @private
   * @param {string} text - Full text
   * @param {number} startIndex - Start index of '('
   * @returns {Object|null} { token, endIndex } or null if not valid weighted text
   */
  _parseWeighted(text, startIndex) {
    let depth = 0;
    let i = startIndex;

    // Find matching closing bracket
    while (i < text.length) {
      if (text[i] === '(') {
        depth++;
      } else if (text[i] === ')') {
        depth--;
        if (depth === 0) {
          break;
        }
      }
      i++;
    }

    if (depth !== 0 || i >= text.length) {
      // Unmatched brackets
      return null;
    }

    const content = text.substring(startIndex + 1, i);
    
    // Check if it contains weight (text:weight)
    const colonIndex = content.lastIndexOf(':');
    if (colonIndex !== -1) {
      const textPart = content.substring(0, colonIndex).trim();
      const weightPart = content.substring(colonIndex + 1).trim();
      const weight = parseFloat(weightPart);

      if (!isNaN(weight) && textPart.length > 0) {
        return {
          token: new PromptToken(TokenType.WEIGHTED, textPart, { weight }),
          endIndex: i + 1
        };
      }
    }

    // No weight specified, default to 1.1
    const textPart = content.trim();
    if (textPart.length > 0) {
      return {
        token: new PromptToken(TokenType.WEIGHTED, textPart, { weight: 1.1 }),
        endIndex: i + 1
      };
    }

    return null;
  }

  /**
   * Parse plain text until special character
   * @private
   * @param {string} text - Full text
   * @param {number} startIndex - Start index
   * @returns {Object|null} { token, endIndex } or null if no text
   */
  _parsePlainText(text, startIndex) {
    let i = startIndex;
    let textContent = '';

    while (i < text.length) {
      const char = text[i];

      // Stop at special characters (including closing bracket)
      if (char === '<' || char === '(' || char === ')' || char === ',') {
        break;
      }

      textContent += char;
      i++;
    }

    // Trim and skip comma
    textContent = textContent.trim();
    if (i < text.length && text[i] === ',') {
      i++; // Skip comma
    }

    if (textContent.length > 0) {
      return {
        token: new PromptToken(TokenType.TEXT, textContent, {}),
        endIndex: i
      };
    }

    return null;
  }

  /**
   * Extract tags from tokens
   * @param {PromptToken[]} tokens - Array of tokens
   * @param {Object} [options={}] - Extraction options
   * @param {boolean} [options.includeWeighted=false] - Include weighted text as tags
   * @param {boolean} [options.includeSpecialTags=false] - Include special tags (LoRA, etc.)
   * @param {string} [options.prefix=''] - Prefix to add to each tag
   * @returns {string[]} Array of tags
   */
  extractTags(tokens, options = {}) {
    const {
      includeWeighted = false,
      includeSpecialTags = false,
      prefix = ''
    } = options;

    const tags = [];

    for (const token of tokens) {
      // Plain text - always include
      if (token.isText()) {
        tags.push(prefix + token.text.toLowerCase());
      }

      // Weighted text - include if option is set
      if (token.isWeighted() && includeWeighted) {
        tags.push(prefix + token.text.toLowerCase());
      }

      // Special tags - include if option is set
      if (token.isSpecialTag() && includeSpecialTags) {
        tags.push(prefix + token.text.toLowerCase());
      }
    }

    return tags;
  }

  /**
   * Reconstruct prompt text from tokens
   * @param {PromptToken[]} tokens - Array of tokens
   * @returns {string} Reconstructed prompt text
   */
  reconstruct(tokens) {
    return tokens.map(token => token.toString()).join(', ');
  }
}

// Export for both browser and Node.js environments
if (typeof window !== 'undefined') {
  window.PromptTokenizer = PromptTokenizer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PromptTokenizer;
}

})(typeof window !== 'undefined' ? window : global);
