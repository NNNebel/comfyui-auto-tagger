/**
 * ParseError.js - Base error class for parsing errors
 * Universal module (Browser + Node.js)
 */
(function(global) {
  'use strict';

/**
 * ParseError - Base class for all parsing errors
 * 
 * Provides structured error information with context and suggestions.
 * Supports error chaining to preserve the original error.
 * 
 * @example
 * throw new ParseError(
 *   'Failed to parse metadata',
 *   { format: 'comfyui', nodeId: '123' },
 *   originalError,
 *   ['Check if the workflow JSON is valid', 'Verify node connections']
 * );
 */
class ParseError extends Error {
  /**
   * Create a new ParseError
   * @param {string} message - Error message
   * @param {Object} [context={}] - Additional context information
   * @param {Error} [cause=null] - Original error that caused this error
   * @param {string[]} [suggestions=[]] - Suggestions for fixing the error
   */
  constructor(message, context = {}, cause = null, suggestions = []) {
    super(message);
    this.name = 'ParseError';
    this.context = context;
    this.cause = cause;
    this.suggestions = suggestions;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace (only available in V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ParseError);
    }
  }

  /**
   * Convert error to JSON for logging
   * @returns {Object} JSON representation of error
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      suggestions: this.suggestions,
      timestamp: this.timestamp,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message
      } : null
    };
  }

  /**
   * Convert error to string
   * @returns {string} String representation of error
   */
  toString() {
    let str = `${this.name}: ${this.message}`;
    
    if (Object.keys(this.context).length > 0) {
      str += `\nContext: ${JSON.stringify(this.context)}`;
    }
    
    if (this.suggestions.length > 0) {
      str += `\nSuggestions:\n${this.suggestions.map(s => `  - ${s}`).join('\n')}`;
    }
    
    if (this.cause) {
      str += `\nCaused by: ${this.cause.message}`;
    }
    
    return str;
  }
}

/**
 * GraphConstructionError - Error during graph construction
 * 
 * Thrown when building a ComfyUI workflow graph fails.
 */
class GraphConstructionError extends ParseError {
  constructor(message, context = {}, cause = null, suggestions = []) {
    super(message, context, cause, suggestions);
    this.name = 'GraphConstructionError';
  }
}

/**
 * SamplerNotFoundError - Error when no sampler is found
 * 
 * Thrown when a ComfyUI workflow has no valid sampler nodes.
 */
class SamplerNotFoundError extends ParseError {
  constructor(message, context = {}, cause = null, suggestions = []) {
    super(message, context, cause, suggestions);
    this.name = 'SamplerNotFoundError';
  }
}

/**
 * ParameterParseError - Error during parameter parsing
 * 
 * Thrown when parsing A1111 parameters fails.
 */
class ParameterParseError extends ParseError {
  constructor(message, context = {}, cause = null, suggestions = []) {
    super(message, context, cause, suggestions);
    this.name = 'ParameterParseError';
  }
}

/**
 * TokenizationError - Error during prompt tokenization
 * 
 * Thrown when tokenizing a prompt fails.
 */
class TokenizationError extends ParseError {
  constructor(message, context = {}, cause = null, suggestions = []) {
    super(message, context, cause, suggestions);
    this.name = 'TokenizationError';
  }
}

// Export for both browser and Node.js environments
if (typeof window !== 'undefined') {
  window.ParseError = ParseError;
  window.GraphConstructionError = GraphConstructionError;
  window.SamplerNotFoundError = SamplerNotFoundError;
  window.ParameterParseError = ParameterParseError;
  window.TokenizationError = TokenizationError;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ParseError,
    GraphConstructionError,
    SamplerNotFoundError,
    ParameterParseError,
    TokenizationError
  };
}

})(typeof window !== 'undefined' ? window : global);
