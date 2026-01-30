import { describe, it, expect, beforeEach, vi } from 'vitest';
import ParserRegistry from '../../js/metadata-parser/parsers/ParserRegistry.js';
import MetadataParser from '../../js/metadata-parser/parsers/MetadataParser.js';

describe('ParserRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new ParserRegistry();
  });

  describe('constructor', () => {
    it('should create an empty registry', () => {
      expect(registry.parsers).toBeInstanceOf(Map);
      expect(registry.parsers.size).toBe(0);
    });
  });

  describe('register', () => {
    it('should register a parser successfully', () => {
      class TestParser extends MetadataParser {
        getFormatName() {
          return 'test-format';
        }
        parse(rawChunks) {
          return { format: 'test-format' };
        }
      }

      const parser = new TestParser();
      registry.register(parser);

      expect(registry.parsers.size).toBe(1);
      expect(registry.parsers.has('test-format')).toBe(true);
      expect(registry.parsers.get('test-format')).toBe(parser);
    });

    it('should register multiple parsers', () => {
      class Parser1 extends MetadataParser {
        getFormatName() {
          return 'format1';
        }
        parse() {
          return { format: 'format1' };
        }
      }

      class Parser2 extends MetadataParser {
        getFormatName() {
          return 'format2';
        }
        parse() {
          return { format: 'format2' };
        }
      }

      const parser1 = new Parser1();
      const parser2 = new Parser2();

      registry.register(parser1);
      registry.register(parser2);

      expect(registry.parsers.size).toBe(2);
      expect(registry.parsers.has('format1')).toBe(true);
      expect(registry.parsers.has('format2')).toBe(true);
    });

    it('should throw error when parser is null', () => {
      expect(() => registry.register(null)).toThrow('Parser cannot be null or undefined');
    });

    it('should throw error when parser is undefined', () => {
      expect(() => registry.register(undefined)).toThrow('Parser cannot be null or undefined');
    });

    it('should throw error when parser does not implement getFormatName', () => {
      const invalidParser = {};
      expect(() => registry.register(invalidParser)).toThrow();
    });

    it('should throw error when getFormatName returns empty string', () => {
      class InvalidParser extends MetadataParser {
        getFormatName() {
          return '';
        }
        parse() {
          return {};
        }
      }

      const parser = new InvalidParser();
      expect(() => registry.register(parser)).toThrow('Parser must return a valid format name');
    });

    it('should throw error when getFormatName returns non-string', () => {
      class InvalidParser extends MetadataParser {
        getFormatName() {
          return 123;
        }
        parse() {
          return {};
        }
      }

      const parser = new InvalidParser();
      expect(() => registry.register(parser)).toThrow('Parser must return a valid format name');
    });

    it('should replace existing parser when registering same format', () => {
      class Parser1 extends MetadataParser {
        getFormatName() {
          return 'test-format';
        }
        parse() {
          return { format: 'test-format', version: 1 };
        }
      }

      class Parser2 extends MetadataParser {
        getFormatName() {
          return 'test-format';
        }
        parse() {
          return { format: 'test-format', version: 2 };
        }
      }

      const parser1 = new Parser1();
      const parser2 = new Parser2();

      registry.register(parser1);
      expect(registry.parsers.get('test-format')).toBe(parser1);

      registry.register(parser2);
      expect(registry.parsers.get('test-format')).toBe(parser2);
      expect(registry.parsers.size).toBe(1);
    });
  });

  describe('parse', () => {
    it('should delegate parsing to the correct parser', () => {
      class TestParser extends MetadataParser {
        getFormatName() {
          return 'test-format';
        }
        parse(rawChunks) {
          return {
            format: 'test-format',
            checkpoint: rawChunks.checkpoint
          };
        }
      }

      const parser = new TestParser();
      registry.register(parser);

      const rawChunks = { checkpoint: 'model.safetensors' };
      const result = registry.parse('test-format', rawChunks);

      expect(result).toEqual({
        format: 'test-format',
        checkpoint: 'model.safetensors'
      });
    });

    it('should return null when parser is not registered', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = registry.parse('unknown-format', {});

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('No parser registered for format: unknown-format');

      consoleSpy.mockRestore();
    });

    it('should handle parser errors gracefully and return null', () => {
      class ErrorParser extends MetadataParser {
        getFormatName() {
          return 'error-format';
        }
        parse() {
          throw new Error('Parser error');
        }
      }

      const parser = new ErrorParser();
      registry.register(parser);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = registry.parse('error-format', {});

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Parser error for format error-format:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should pass rawChunks to parser correctly', () => {
      class TestParser extends MetadataParser {
        getFormatName() {
          return 'test-format';
        }
        parse(rawChunks) {
          return {
            format: 'test-format',
            data: rawChunks
          };
        }
      }

      const parser = new TestParser();
      registry.register(parser);

      const rawChunks = {
        workflow: { nodes: [] },
        prompt: { '1': { class_type: 'KSampler' } }
      };

      const result = registry.parse('test-format', rawChunks);

      expect(result.data).toEqual(rawChunks);
    });

    it('should work with multiple registered parsers', () => {
      class ComfyParser extends MetadataParser {
        getFormatName() {
          return 'comfyui';
        }
        parse(rawChunks) {
          return {
            format: 'comfyui',
            checkpoint: rawChunks.workflow?.checkpoint
          };
        }
      }

      class A1111Parser extends MetadataParser {
        getFormatName() {
          return 'a1111';
        }
        parse(rawChunks) {
          return {
            format: 'a1111',
            positive: rawChunks.parameters
          };
        }
      }

      registry.register(new ComfyParser());
      registry.register(new A1111Parser());

      const comfyResult = registry.parse('comfyui', {
        workflow: { checkpoint: 'model.safetensors' }
      });
      expect(comfyResult.format).toBe('comfyui');
      expect(comfyResult.checkpoint).toBe('model.safetensors');

      const a1111Result = registry.parse('a1111', {
        parameters: 'cat, detailed'
      });
      expect(a1111Result.format).toBe('a1111');
      expect(a1111Result.positive).toBe('cat, detailed');
    });
  });

  describe('parseAll', () => {
    beforeEach(() => {
      class ComfyParser extends MetadataParser {
        getFormatName() {
          return 'comfyui';
        }
        parse(rawChunks) {
          return {
            format: 'comfyui',
            checkpoint: rawChunks.workflow?.checkpoint || 'default.safetensors'
          };
        }
      }

      class A1111Parser extends MetadataParser {
        getFormatName() {
          return 'a1111';
        }
        parse(rawChunks) {
          return {
            format: 'a1111',
            positive: rawChunks.parameters || 'default prompt'
          };
        }
      }

      registry.register(new ComfyParser());
      registry.register(new A1111Parser());
    });

    it('should parse all detected formats', () => {
      const formats = ['comfyui', 'a1111'];
      const rawChunks = {
        workflow: { checkpoint: 'model.safetensors' },
        parameters: 'cat, detailed'
      };

      const results = registry.parseAll(formats, rawChunks);

      expect(results).toHaveLength(2);
      expect(results[0].format).toBe('comfyui');
      expect(results[0].checkpoint).toBe('model.safetensors');
      expect(results[1].format).toBe('a1111');
      expect(results[1].positive).toBe('cat, detailed');
    });

    it('should return empty array when no formats are detected', () => {
      const formats = [];
      const rawChunks = {};

      const results = registry.parseAll(formats, rawChunks);

      expect(results).toEqual([]);
    });

    it('should filter out null results from failed parsers', () => {
      const formats = ['comfyui', 'unknown-format', 'a1111'];
      const rawChunks = {
        workflow: { checkpoint: 'model.safetensors' },
        parameters: 'cat, detailed'
      };

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const results = registry.parseAll(formats, rawChunks);

      expect(results).toHaveLength(2);
      expect(results[0].format).toBe('comfyui');
      expect(results[1].format).toBe('a1111');
      expect(consoleSpy).toHaveBeenCalledWith('No parser registered for format: unknown-format');

      consoleSpy.mockRestore();
    });

    it('should continue parsing even if one parser throws error', () => {
      class ErrorParser extends MetadataParser {
        getFormatName() {
          return 'error-format';
        }
        parse() {
          throw new Error('Parser error');
        }
      }

      registry.register(new ErrorParser());

      const formats = ['comfyui', 'error-format', 'a1111'];
      const rawChunks = {
        workflow: { checkpoint: 'model.safetensors' },
        parameters: 'cat, detailed'
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const results = registry.parseAll(formats, rawChunks);

      expect(results).toHaveLength(2);
      expect(results[0].format).toBe('comfyui');
      expect(results[1].format).toBe('a1111');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Parser error for format error-format:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should handle single format', () => {
      const formats = ['comfyui'];
      const rawChunks = {
        workflow: { checkpoint: 'model.safetensors' }
      };

      const results = registry.parseAll(formats, rawChunks);

      expect(results).toHaveLength(1);
      expect(results[0].format).toBe('comfyui');
      expect(results[0].checkpoint).toBe('model.safetensors');
    });

    it('should return empty array when all parsers fail', () => {
      const formats = ['unknown1', 'unknown2'];
      const rawChunks = {};

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const results = registry.parseAll(formats, rawChunks);

      expect(results).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });

    it('should pass same rawChunks to all parsers', () => {
      const formats = ['comfyui', 'a1111'];
      const rawChunks = {
        workflow: { checkpoint: 'model.safetensors' },
        parameters: 'cat, detailed'
      };

      const results = registry.parseAll(formats, rawChunks);

      expect(results[0].checkpoint).toBe('model.safetensors');
      expect(results[1].positive).toBe('cat, detailed');
    });
  });

  describe('error isolation (Requirement 2.5)', () => {
    it('should isolate errors from one parser and allow others to continue', () => {
      class WorkingParser extends MetadataParser {
        getFormatName() {
          return 'working';
        }
        parse() {
          return { format: 'working', status: 'success' };
        }
      }

      class FailingParser extends MetadataParser {
        getFormatName() {
          return 'failing';
        }
        parse() {
          throw new Error('Intentional failure');
        }
      }

      registry.register(new WorkingParser());
      registry.register(new FailingParser());

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const formats = ['failing', 'working'];
      const results = registry.parseAll(formats, {});

      expect(results).toHaveLength(1);
      expect(results[0].format).toBe('working');
      expect(results[0].status).toBe('success');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should not crash when parser throws during parse', () => {
      class CrashingParser extends MetadataParser {
        getFormatName() {
          return 'crashing';
        }
        parse() {
          throw new TypeError('Null reference error');
        }
      }

      registry.register(new CrashingParser());

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        const result = registry.parse('crashing', {});
        expect(result).toBeNull();
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('parser delegation (Requirement 2.3)', () => {
    it('should delegate to the correct parser based on format name', () => {
      const parseCalls = [];

      class Parser1 extends MetadataParser {
        getFormatName() {
          return 'format1';
        }
        parse(rawChunks) {
          parseCalls.push('format1');
          return { format: 'format1' };
        }
      }

      class Parser2 extends MetadataParser {
        getFormatName() {
          return 'format2';
        }
        parse(rawChunks) {
          parseCalls.push('format2');
          return { format: 'format2' };
        }
      }

      registry.register(new Parser1());
      registry.register(new Parser2());

      registry.parse('format1', {});
      expect(parseCalls).toEqual(['format1']);

      registry.parse('format2', {});
      expect(parseCalls).toEqual(['format1', 'format2']);
    });

    it('should only call the requested parser, not all parsers', () => {
      let parser1Called = false;
      let parser2Called = false;

      class Parser1 extends MetadataParser {
        getFormatName() {
          return 'format1';
        }
        parse() {
          parser1Called = true;
          return { format: 'format1' };
        }
      }

      class Parser2 extends MetadataParser {
        getFormatName() {
          return 'format2';
        }
        parse() {
          parser2Called = true;
          return { format: 'format2' };
        }
      }

      registry.register(new Parser1());
      registry.register(new Parser2());

      registry.parse('format1', {});

      expect(parser1Called).toBe(true);
      expect(parser2Called).toBe(false);
    });
  });

  describe('multiple parser support (Requirement 2.4)', () => {
    it('should support multiple parser implementations simultaneously', () => {
      class Parser1 extends MetadataParser {
        getFormatName() {
          return 'format1';
        }
        parse() {
          return { format: 'format1' };
        }
      }

      class Parser2 extends MetadataParser {
        getFormatName() {
          return 'format2';
        }
        parse() {
          return { format: 'format2' };
        }
      }

      class Parser3 extends MetadataParser {
        getFormatName() {
          return 'format3';
        }
        parse() {
          return { format: 'format3' };
        }
      }

      registry.register(new Parser1());
      registry.register(new Parser2());
      registry.register(new Parser3());

      expect(registry.parsers.size).toBe(3);

      const result1 = registry.parse('format1', {});
      const result2 = registry.parse('format2', {});
      const result3 = registry.parse('format3', {});

      expect(result1.format).toBe('format1');
      expect(result2.format).toBe('format2');
      expect(result3.format).toBe('format3');
    });

    it('should handle parseAll with many formats', () => {
      const formats = ['format1', 'format2', 'format3', 'format4', 'format5'];

      formats.forEach(format => {
        class TestParser extends MetadataParser {
          constructor(fmt) {
            super();
            this.fmt = fmt;
          }
          getFormatName() {
            return this.fmt;
          }
          parse() {
            return { format: this.fmt };
          }
        }
        registry.register(new TestParser(format));
      });

      const results = registry.parseAll(formats, {});

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.format).toBe(formats[index]);
      });
    });
  });
});
