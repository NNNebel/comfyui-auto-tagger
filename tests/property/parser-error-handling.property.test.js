import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import ParserRegistry from '../../js/metadata-parser/parsers/ParserRegistry.js';
import MetadataParser from '../../js/metadata-parser/parsers/MetadataParser.js';

/**
 * Property-Based Tests for ParserRegistry Error Handling
 * 
 * These tests verify universal properties related to error isolation and graceful degradation.
 * Using fast-check to generate randomized test cases.
 */

describe('ParserRegistry - Property Tests: Error Handling', () => {
  /**
   * Property 5: Error Isolation
   * 
   * For any parser that throws an error during parsing, the ParserRegistry should
   * catch the error, log it, and return null without crashing, allowing other
   * parsers to continue operation.
   * 
   * **Validates: Requirements 2.5, 8.3**
   */
  describe('Property 5: Error Isolation', () => {
    /**
     * Test that any error thrown by a parser is caught and returns null
     */
    it('should catch any error thrown by a parser and return null', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary error messages
          fc.string(),
          // Generate arbitrary format names
          fc.string({ minLength: 1 }),
          // Generate arbitrary raw chunks
          fc.object(),
          (errorMessage, formatName, rawChunks) => {
            const registry = new ParserRegistry();
            
            // Create a parser that always throws an error
            class ErrorThrowingParser extends MetadataParser {
              getFormatName() {
                return formatName;
              }
              parse() {
                throw new Error(errorMessage);
              }
            }
            
            registry.register(new ErrorThrowingParser());
            
            // Mock console.error to suppress output during tests
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            // Property: Should return null and not throw
            let result;
            let didThrow = false;
            try {
              result = registry.parse(formatName, rawChunks);
            } catch (e) {
              didThrow = true;
            }
            
            consoleSpy.mockRestore();
            
            // Verify: No exception thrown and result is null
            return !didThrow && result === null;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that different types of errors are all caught
     */
    it('should catch any type of error (Error, TypeError, ReferenceError, etc.)', () => {
      fc.assert(
        fc.property(
          // Generate different error types
          fc.constantFrom(
            new Error('Generic error'),
            new TypeError('Type error'),
            new ReferenceError('Reference error'),
            new SyntaxError('Syntax error'),
            new RangeError('Range error'),
            'string error', // Non-Error object
            { message: 'object error' }, // Plain object
            null, // Null throw
            undefined, // Undefined throw
            42 // Number throw
          ),
          fc.string({ minLength: 1 }),
          fc.object(),
          (errorToThrow, formatName, rawChunks) => {
            const registry = new ParserRegistry();
            
            class ErrorThrowingParser extends MetadataParser {
              getFormatName() {
                return formatName;
              }
              parse() {
                throw errorToThrow;
              }
            }
            
            registry.register(new ErrorThrowingParser());
            
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            let result;
            let didThrow = false;
            try {
              result = registry.parse(formatName, rawChunks);
            } catch (e) {
              didThrow = true;
            }
            
            consoleSpy.mockRestore();
            
            // Property: Should handle any type of thrown value
            return !didThrow && result === null;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that error isolation allows other parsers to continue
     */
    it('should allow other parsers to continue when one parser fails', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary error message
          fc.string(),
          // Generate arbitrary format names (ensure they're different)
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          // Generate arbitrary raw chunks
          fc.object(),
          // Generate arbitrary successful result
          fc.record({
            format: fc.string(),
            checkpoint: fc.option(fc.string()),
            positive: fc.option(fc.string())
          }),
          (errorMessage, failingFormat, workingFormat, rawChunks, successResult) => {
            // Skip if format names are the same
            if (failingFormat === workingFormat) {
              return true;
            }
            
            const registry = new ParserRegistry();
            
            // Create a failing parser
            class FailingParser extends MetadataParser {
              getFormatName() {
                return failingFormat;
              }
              parse() {
                throw new Error(errorMessage);
              }
            }
            
            // Create a working parser
            class WorkingParser extends MetadataParser {
              getFormatName() {
                return workingFormat;
              }
              parse() {
                return successResult;
              }
            }
            
            registry.register(new FailingParser());
            registry.register(new WorkingParser());
            
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            // Parse with both formats
            const formats = [failingFormat, workingFormat];
            const results = registry.parseAll(formats, rawChunks);
            
            consoleSpy.mockRestore();
            
            // Property: Should get exactly one result (from working parser)
            // and it should match the success result
            return results.length === 1 && 
                   JSON.stringify(results[0]) === JSON.stringify(successResult);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that parseAll continues processing all formats even when some fail
     */
    it('should process all formats in parseAll even when some parsers throw errors', () => {
      fc.assert(
        fc.property(
          // Generate array of format names (3-5 formats)
          fc.array(fc.string({ minLength: 1 }), { minLength: 3, maxLength: 5 }),
          // Generate which indices should fail (subset of indices)
          fc.array(fc.integer({ min: 0, max: 4 })),
          fc.object(),
          (formatNames, failingIndices, rawChunks) => {
            // Ensure unique format names
            const uniqueFormats = [...new Set(formatNames)];
            if (uniqueFormats.length < 3) {
              return true; // Skip if not enough unique formats
            }
            
            const registry = new ParserRegistry();
            const failingSet = new Set(failingIndices);
            
            // Register parsers - some failing, some working
            uniqueFormats.forEach((format, index) => {
              if (failingSet.has(index)) {
                // Failing parser
                class FailingParser extends MetadataParser {
                  constructor(fmt) {
                    super();
                    this.fmt = fmt;
                  }
                  getFormatName() {
                    return this.fmt;
                  }
                  parse() {
                    throw new Error(`Parser ${this.fmt} failed`);
                  }
                }
                registry.register(new FailingParser(format));
              } else {
                // Working parser
                class WorkingParser extends MetadataParser {
                  constructor(fmt) {
                    super();
                    this.fmt = fmt;
                  }
                  getFormatName() {
                    return this.fmt;
                  }
                  parse() {
                    return { format: this.fmt, status: 'success' };
                  }
                }
                registry.register(new WorkingParser(format));
              }
            });
            
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            const results = registry.parseAll(uniqueFormats, rawChunks);
            
            consoleSpy.mockRestore();
            
            // Property: Number of results should equal number of working parsers
            const expectedWorkingCount = uniqueFormats.filter((_, idx) => !failingSet.has(idx)).length;
            const allResultsSuccessful = results.every(r => r.status === 'success');
            
            return results.length === expectedWorkingCount && allResultsSuccessful;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that errors are logged appropriately
     */
    it('should log errors to console.error when parsers fail', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string({ minLength: 1 }),
          fc.object(),
          (errorMessage, formatName, rawChunks) => {
            const registry = new ParserRegistry();
            
            class ErrorThrowingParser extends MetadataParser {
              getFormatName() {
                return formatName;
              }
              parse() {
                throw new Error(errorMessage);
              }
            }
            
            registry.register(new ErrorThrowingParser());
            
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            registry.parse(formatName, rawChunks);
            
            // Property: console.error should have been called
            const wasLogged = consoleSpy.mock.calls.length > 0;
            
            // Verify the error message contains the format name
            const loggedCorrectFormat = consoleSpy.mock.calls.some(call => 
              call.some(arg => typeof arg === 'string' && arg.includes(formatName))
            );
            
            consoleSpy.mockRestore();
            
            return wasLogged && loggedCorrectFormat;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that the registry state remains consistent after errors
     */
    it('should maintain registry state after parser errors', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 5 }),
          fc.object(),
          (formatNames, rawChunks) => {
            const uniqueFormats = [...new Set(formatNames)];
            if (uniqueFormats.length < 2) {
              return true;
            }
            
            const registry = new ParserRegistry();
            
            // Register parsers - first one throws, rest work
            uniqueFormats.forEach((format, index) => {
              if (index === 0) {
                class FailingParser extends MetadataParser {
                  constructor(fmt) {
                    super();
                    this.fmt = fmt;
                  }
                  getFormatName() {
                    return this.fmt;
                  }
                  parse() {
                    throw new Error('Intentional error');
                  }
                }
                registry.register(new FailingParser(format));
              } else {
                class WorkingParser extends MetadataParser {
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
                registry.register(new WorkingParser(format));
              }
            });
            
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            // Call the failing parser
            const failResult = registry.parse(uniqueFormats[0], rawChunks);
            
            // Property: Registry should still have all parsers registered
            const registrySize = registry.parsers.size;
            
            // Property: Other parsers should still work
            const workingResults = uniqueFormats.slice(1).map(format => 
              registry.parse(format, rawChunks)
            );
            const allWorkingParsersSucceeded = workingResults.every(r => r !== null);
            
            consoleSpy.mockRestore();
            
            return failResult === null && 
                   registrySize === uniqueFormats.length && 
                   allWorkingParsersSucceeded;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that parseAll returns empty array when all parsers fail
     */
    it('should return empty array from parseAll when all parsers throw errors', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
          fc.object(),
          (formatNames, rawChunks) => {
            const uniqueFormats = [...new Set(formatNames)];
            const registry = new ParserRegistry();
            
            // Register only failing parsers
            uniqueFormats.forEach(format => {
              class FailingParser extends MetadataParser {
                constructor(fmt) {
                  super();
                  this.fmt = fmt;
                }
                getFormatName() {
                  return this.fmt;
                }
                parse() {
                  throw new Error(`Parser ${this.fmt} failed`);
                }
              }
              registry.register(new FailingParser(format));
            });
            
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            const results = registry.parseAll(uniqueFormats, rawChunks);
            
            consoleSpy.mockRestore();
            
            // Property: Should return empty array when all parsers fail
            return Array.isArray(results) && results.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that synchronous errors in parse() are caught
     */
    it('should catch synchronous errors thrown immediately in parse()', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.object(),
          (formatName, rawChunks) => {
            const registry = new ParserRegistry();
            
            class SyncErrorParser extends MetadataParser {
              getFormatName() {
                return formatName;
              }
              parse() {
                // Immediate synchronous error
                const obj = null;
                return obj.property; // Will throw TypeError
              }
            }
            
            registry.register(new SyncErrorParser());
            
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            let didThrow = false;
            let result;
            try {
              result = registry.parse(formatName, rawChunks);
            } catch (e) {
              didThrow = true;
            }
            
            consoleSpy.mockRestore();
            
            // Property: Should not throw and should return null
            return !didThrow && result === null;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional Property: Error Isolation Idempotence
   * 
   * Calling parse multiple times on a failing parser should consistently
   * return null without affecting subsequent calls.
   */
  describe('Property: Error Isolation Idempotence', () => {
    it('should consistently return null for failing parser across multiple calls', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.object(),
          fc.integer({ min: 2, max: 10 }),
          (formatName, rawChunks, numCalls) => {
            const registry = new ParserRegistry();
            
            class FailingParser extends MetadataParser {
              getFormatName() {
                return formatName;
              }
              parse() {
                throw new Error('Consistent failure');
              }
            }
            
            registry.register(new FailingParser());
            
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            // Call parse multiple times
            const results = [];
            for (let i = 0; i < numCalls; i++) {
              results.push(registry.parse(formatName, rawChunks));
            }
            
            consoleSpy.mockRestore();
            
            // Property: All results should be null
            return results.every(r => r === null) && results.length === numCalls;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional Property: Registry State Preservation
   * 
   * Parser errors should not corrupt the registry state or prevent
   * future operations.
   */
  describe('Property: Registry State Preservation', () => {
    it('should preserve registry state and allow continued operation after errors', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 5 }),
          fc.object(),
          fc.integer({ min: 1, max: 5 }),
          (formatNames, rawChunks, numIterations) => {
            const uniqueFormats = [...new Set(formatNames)];
            if (uniqueFormats.length < 2) {
              return true;
            }
            
            const registry = new ParserRegistry();
            
            // Register mix of failing and working parsers
            uniqueFormats.forEach((format, index) => {
              if (index % 2 === 0) {
                class FailingParser extends MetadataParser {
                  constructor(fmt) {
                    super();
                    this.fmt = fmt;
                  }
                  getFormatName() {
                    return this.fmt;
                  }
                  parse() {
                    throw new Error('Intentional failure');
                  }
                }
                registry.register(new FailingParser(format));
              } else {
                class WorkingParser extends MetadataParser {
                  constructor(fmt) {
                    super();
                    this.fmt = fmt;
                  }
                  getFormatName() {
                    return this.fmt;
                  }
                  parse() {
                    return { format: this.fmt, iteration: 0 };
                  }
                }
                registry.register(new WorkingParser(format));
              }
            });
            
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            // Call parseAll multiple times to ensure state is preserved
            const allResults = [];
            for (let i = 0; i < numIterations; i++) {
              const results = registry.parseAll(uniqueFormats, rawChunks);
              allResults.push(results);
            }
            
            consoleSpy.mockRestore();
            
            // Property: All iterations should produce the same number of results
            // Count working parsers (odd indices)
            const expectedCount = uniqueFormats.filter((_, idx) => idx % 2 === 1).length;
            const allHaveSameCount = allResults.every(r => r.length === expectedCount);
            
            // Property: Registry size should remain constant
            const registrySizeConstant = registry.parsers.size === uniqueFormats.length;
            
            return allHaveSameCount && registrySizeConstant;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
