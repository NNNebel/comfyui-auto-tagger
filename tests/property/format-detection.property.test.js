import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import FormatDetector from '../../js/metadata-parser/binary-extraction/FormatDetector.js';

/**
 * Property-Based Tests for FormatDetector
 * 
 * These tests verify universal properties that should hold across all valid inputs.
 * Using fast-check to generate randomized test cases.
 */

describe('FormatDetector - Property Tests', () => {
  /**
   * Property 1: Format Detection Accuracy
   * 
   * For any image buffer containing ComfyUI metadata (workflow or prompt JSON),
   * the FormatDetector should identify 'comfyui' as a detected format.
   * 
   * For any image buffer containing A1111 metadata (parameters text),
   * the FormatDetector should identify 'a1111' as a detected format.
   * 
   * **Validates: Requirements 1.1, 1.2**
   */
  describe('Property 1: Format Detection Accuracy', () => {
    it('should always detect ComfyUI format when workflow is present as an object', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary objects for workflow
          fc.oneof(
            fc.object(), // Random object
            fc.record({ nodes: fc.array(fc.anything()) }), // Object with nodes array
            fc.record({ connections: fc.array(fc.anything()) }), // Object with connections
            fc.constant({}) // Empty object
          ),
          (workflow) => {
            const rawChunks = { workflow };
            const formats = FormatDetector.detectFormats(rawChunks);
            
            // Property: ComfyUI format should always be detected when workflow is an object
            return formats.includes('comfyui');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always detect ComfyUI format when prompt is present as an object', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary objects for prompt
          fc.oneof(
            fc.object(), // Random object
            fc.dictionary(fc.string(), fc.record({ class_type: fc.string() })), // ComfyUI-like structure
            fc.constant({}) // Empty object
          ),
          (prompt) => {
            const rawChunks = { prompt };
            const formats = FormatDetector.detectFormats(rawChunks);
            
            // Property: ComfyUI format should always be detected when prompt is an object
            return formats.includes('comfyui');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always detect A1111 format when parameters is a non-empty string', () => {
      fc.assert(
        fc.property(
          // Generate non-empty strings for parameters
          fc.string({ minLength: 1 }),
          (parameters) => {
            const rawChunks = { parameters };
            const formats = FormatDetector.detectFormats(rawChunks);
            
            // Property: A1111 format should always be detected when parameters is a non-empty string
            return formats.includes('a1111');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never detect ComfyUI format when workflow and prompt are not objects', () => {
      fc.assert(
        fc.property(
          // Generate non-object values (strings, numbers, null, undefined, etc.)
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.float(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined)
          ),
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.float(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined)
          ),
          (workflow, prompt) => {
            const rawChunks = { workflow, prompt };
            const formats = FormatDetector.detectFormats(rawChunks);
            
            // Property: ComfyUI format should never be detected when neither workflow nor prompt are objects
            return !formats.includes('comfyui');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never detect A1111 format when parameters is not a non-empty string', () => {
      fc.assert(
        fc.property(
          // Generate non-string values or empty string
          fc.oneof(
            fc.object(),
            fc.array(fc.anything()),
            fc.integer(),
            fc.float(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
            fc.constant('') // Empty string
          ),
          (parameters) => {
            const rawChunks = { parameters };
            const formats = FormatDetector.detectFormats(rawChunks);
            
            // Property: A1111 format should never be detected when parameters is not a non-empty string
            return !formats.includes('a1111');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array when no valid metadata is present', () => {
      fc.assert(
        fc.property(
          // Generate objects without workflow, prompt, or parameters keys
          fc.dictionary(
            fc.string().filter(key => !['workflow', 'prompt', 'parameters'].includes(key)),
            fc.anything()
          ),
          (rawChunks) => {
            const formats = FormatDetector.detectFormats(rawChunks);
            
            // Property: No formats should be detected when no valid metadata keys are present
            return formats.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Multiple Format Detection
   * 
   * For any image buffer containing both ComfyUI and A1111 metadata,
   * the FormatDetector should return both 'comfyui' and 'a1111' in the detected formats array.
   * 
   * **Validates: Requirements 1.3**
   */
  describe('Property 2: Multiple Format Detection', () => {
    it('should detect both formats when both ComfyUI (workflow) and A1111 metadata are present', () => {
      fc.assert(
        fc.property(
          // Generate valid ComfyUI workflow (object)
          fc.oneof(
            fc.object(),
            fc.record({ nodes: fc.array(fc.anything()) }),
            fc.constant({})
          ),
          // Generate valid A1111 parameters (non-empty string)
          fc.string({ minLength: 1 }),
          (workflow, parameters) => {
            const rawChunks = { workflow, parameters };
            const formats = FormatDetector.detectFormats(rawChunks);
            
            // Property: Both formats should be detected
            const hasComfyUI = formats.includes('comfyui');
            const hasA1111 = formats.includes('a1111');
            const hasBoth = hasComfyUI && hasA1111;
            const hasExactlyTwo = formats.length === 2;
            
            return hasBoth && hasExactlyTwo;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect both formats when both ComfyUI (prompt) and A1111 metadata are present', () => {
      fc.assert(
        fc.property(
          // Generate valid ComfyUI prompt (object)
          fc.oneof(
            fc.object(),
            fc.dictionary(fc.string(), fc.record({ class_type: fc.string() })),
            fc.constant({})
          ),
          // Generate valid A1111 parameters (non-empty string)
          fc.string({ minLength: 1 }),
          (prompt, parameters) => {
            const rawChunks = { prompt, parameters };
            const formats = FormatDetector.detectFormats(rawChunks);
            
            // Property: Both formats should be detected
            const hasComfyUI = formats.includes('comfyui');
            const hasA1111 = formats.includes('a1111');
            const hasBoth = hasComfyUI && hasA1111;
            const hasExactlyTwo = formats.length === 2;
            
            return hasBoth && hasExactlyTwo;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect both formats when ComfyUI (both workflow and prompt) and A1111 metadata are present', () => {
      fc.assert(
        fc.property(
          // Generate valid ComfyUI workflow (object)
          fc.oneof(fc.object(), fc.constant({})),
          // Generate valid ComfyUI prompt (object)
          fc.oneof(fc.object(), fc.constant({})),
          // Generate valid A1111 parameters (non-empty string)
          fc.string({ minLength: 1 }),
          (workflow, prompt, parameters) => {
            const rawChunks = { workflow, prompt, parameters };
            const formats = FormatDetector.detectFormats(rawChunks);
            
            // Property: Both formats should be detected (ComfyUI should appear only once)
            const hasComfyUI = formats.includes('comfyui');
            const hasA1111 = formats.includes('a1111');
            const hasBoth = hasComfyUI && hasA1111;
            const hasExactlyTwo = formats.length === 2;
            const comfyUICount = formats.filter(f => f === 'comfyui').length;
            
            return hasBoth && hasExactlyTwo && comfyUICount === 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistent ordering when both formats are detected', () => {
      fc.assert(
        fc.property(
          // Generate valid metadata for both formats
          fc.object(),
          fc.string({ minLength: 1 }),
          (workflow, parameters) => {
            const rawChunks = { workflow, parameters };
            const formats = FormatDetector.detectFormats(rawChunks);
            
            // Property: ComfyUI should always come before A1111 in the array
            // (based on the implementation order in detectFormats)
            if (formats.length === 2) {
              return formats[0] === 'comfyui' && formats[1] === 'a1111';
            }
            return true; // If not both formats, ordering doesn't matter
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not duplicate format entries when multiple indicators are present', () => {
      fc.assert(
        fc.property(
          // Generate valid ComfyUI metadata with both workflow and prompt
          fc.object(),
          fc.object(),
          (workflow, prompt) => {
            const rawChunks = { workflow, prompt };
            const formats = FormatDetector.detectFormats(rawChunks);
            
            // Property: ComfyUI should appear only once even when both workflow and prompt exist
            const comfyUICount = formats.filter(f => f === 'comfyui').length;
            return comfyUICount === 1;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional Property: Idempotence
   * 
   * Calling detectFormats multiple times with the same input should always
   * produce the same result.
   */
  describe('Property: Idempotence', () => {
    it('should return the same result when called multiple times with the same input', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary raw chunks
          fc.record({
            workflow: fc.option(fc.oneof(fc.object(), fc.string(), fc.constant(null))),
            prompt: fc.option(fc.oneof(fc.object(), fc.string(), fc.constant(null))),
            parameters: fc.option(fc.oneof(fc.string(), fc.object(), fc.constant(null)))
          }),
          (rawChunks) => {
            const result1 = FormatDetector.detectFormats(rawChunks);
            const result2 = FormatDetector.detectFormats(rawChunks);
            const result3 = FormatDetector.detectFormats(rawChunks);
            
            // Property: All results should be identical
            const sameLength = result1.length === result2.length && result2.length === result3.length;
            const sameContent = JSON.stringify(result1) === JSON.stringify(result2) && 
                               JSON.stringify(result2) === JSON.stringify(result3);
            
            return sameLength && sameContent;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional Property: No Side Effects
   * 
   * Calling detectFormats should not modify the input rawChunks object.
   */
  describe('Property: No Side Effects', () => {
    it('should not modify the input rawChunks object', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary raw chunks
          fc.record({
            workflow: fc.option(fc.object()),
            prompt: fc.option(fc.object()),
            parameters: fc.option(fc.string())
          }),
          (rawChunks) => {
            // Create a deep copy for comparison
            const originalCopy = JSON.parse(JSON.stringify(rawChunks));
            
            // Call detectFormats
            FormatDetector.detectFormats(rawChunks);
            
            // Property: Input should remain unchanged
            return JSON.stringify(rawChunks) === JSON.stringify(originalCopy);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
