import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  ParseError,
  GraphConstructionError,
  SamplerNotFoundError,
  ParameterParseError,
  TokenizationError
} = require('../../js/metadata-parser/errors/ParseError.js');

describe('ParseError', () => {
  describe('constructor', () => {
    it('should create error with message', () => {
      const error = new ParseError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ParseError');
      expect(error.context).toEqual({});
      expect(error.cause).toBeNull();
      expect(error.suggestions).toEqual([]);
    });

    it('should create error with context', () => {
      const error = new ParseError('Test error', { format: 'comfyui', nodeId: '123' });
      expect(error.context).toEqual({ format: 'comfyui', nodeId: '123' });
    });

    it('should create error with cause', () => {
      const originalError = new Error('Original error');
      const error = new ParseError('Test error', {}, originalError);
      expect(error.cause).toBe(originalError);
    });

    it('should create error with suggestions', () => {
      const error = new ParseError('Test error', {}, null, ['Suggestion 1', 'Suggestion 2']);
      expect(error.suggestions).toEqual(['Suggestion 1', 'Suggestion 2']);
    });

    it('should have timestamp', () => {
      const error = new ParseError('Test error');
      expect(error.timestamp).toBeDefined();
      expect(typeof error.timestamp).toBe('string');
    });
  });

  describe('toJSON', () => {
    it('should convert error to JSON', () => {
      const error = new ParseError('Test error', { format: 'comfyui' }, null, ['Suggestion']);
      const json = error.toJSON();
      
      expect(json.name).toBe('ParseError');
      expect(json.message).toBe('Test error');
      expect(json.context).toEqual({ format: 'comfyui' });
      expect(json.suggestions).toEqual(['Suggestion']);
      expect(json.timestamp).toBeDefined();
      expect(json.cause).toBeNull();
    });

    it('should include cause in JSON', () => {
      const originalError = new Error('Original error');
      const error = new ParseError('Test error', {}, originalError);
      const json = error.toJSON();
      
      expect(json.cause).toEqual({
        name: 'Error',
        message: 'Original error'
      });
    });
  });

  describe('toString', () => {
    it('should convert error to string', () => {
      const error = new ParseError('Test error');
      const str = error.toString();
      
      expect(str).toContain('ParseError: Test error');
    });

    it('should include context in string', () => {
      const error = new ParseError('Test error', { format: 'comfyui' });
      const str = error.toString();
      
      expect(str).toContain('Context:');
      expect(str).toContain('comfyui');
    });

    it('should include suggestions in string', () => {
      const error = new ParseError('Test error', {}, null, ['Suggestion 1', 'Suggestion 2']);
      const str = error.toString();
      
      expect(str).toContain('Suggestions:');
      expect(str).toContain('Suggestion 1');
      expect(str).toContain('Suggestion 2');
    });

    it('should include cause in string', () => {
      const originalError = new Error('Original error');
      const error = new ParseError('Test error', {}, originalError);
      const str = error.toString();
      
      expect(str).toContain('Caused by: Original error');
    });
  });
});

describe('GraphConstructionError', () => {
  it('should create error with correct name', () => {
    const error = new GraphConstructionError('Graph construction failed');
    expect(error.name).toBe('GraphConstructionError');
    expect(error.message).toBe('Graph construction failed');
    expect(error instanceof ParseError).toBe(true);
  });

  it('should support all ParseError features', () => {
    const error = new GraphConstructionError(
      'Graph construction failed',
      { nodeCount: 10 },
      new Error('Invalid node'),
      ['Check node connections']
    );
    
    expect(error.context).toEqual({ nodeCount: 10 });
    expect(error.cause).toBeDefined();
    expect(error.suggestions).toEqual(['Check node connections']);
  });
});

describe('SamplerNotFoundError', () => {
  it('should create error with correct name', () => {
    const error = new SamplerNotFoundError('No sampler found');
    expect(error.name).toBe('SamplerNotFoundError');
    expect(error.message).toBe('No sampler found');
    expect(error instanceof ParseError).toBe(true);
  });
});

describe('ParameterParseError', () => {
  it('should create error with correct name', () => {
    const error = new ParameterParseError('Parameter parsing failed');
    expect(error.name).toBe('ParameterParseError');
    expect(error.message).toBe('Parameter parsing failed');
    expect(error instanceof ParseError).toBe(true);
  });
});

describe('TokenizationError', () => {
  it('should create error with correct name', () => {
    const error = new TokenizationError('Tokenization failed');
    expect(error.name).toBe('TokenizationError');
    expect(error.message).toBe('Tokenization failed');
    expect(error instanceof ParseError).toBe(true);
  });
});
