import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Import using require for IIFE modules
const ComfyUIParser = require('../../js/metadata-parser/parsers/ComfyUIParser.js');
const NodeDefinitionDictionary = require('../../js/metadata-parser/dictionary/NodeDefinitionDictionary.js');

/**
 * Property-Based Tests for Dictionary-Based Metadata Extraction
 * 
 * These tests verify universal properties of the new dictionary-based extraction system.
 * Using fast-check to generate randomized test cases.
 */

describe('Metadata Extraction - Property Tests', () => {
  /**
   * Property 3: Connected Nodes Only
   * 
   * Metadata should only be extracted from nodes that are connected to the sampler.
   * Disconnected nodes should be ignored.
   * 
   * **Validates: Requirements 2.1, 2.5, 11.1, 11.4**
   */
  describe('Property 3: Connected Nodes Only', () => {
    it('should extract seed from connected node', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999999999 }), // seed value
          (seed) => {
            const promptData = {
              "3": {
                "class_type": "KSampler",
                "inputs": {
                  "seed": seed,
                  "steps": 20,
                  "cfg": 7.0,
                  "sampler_name": "euler",
                  "scheduler": "normal",
                  "latent_image": ["8", 0]
                }
              },
              "8": {
                "class_type": "EmptyLatentImage",
                "inputs": {
                  "width": 512,
                  "height": 512
                }
              },
              "9": {
                "class_type": "SaveImage",
                "inputs": {
                  "images": ["3", 0]
                }
              }
            };

            const parser = new ComfyUIParser();
            const result = parser.parse({ prompt: promptData });

            // Property: Seed should be extracted from connected sampler
            return result.seed === seed;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not extract from disconnected nodes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999999999 }), // seed from connected sampler
          fc.integer({ min: 0, max: 999999999 }), // seed from disconnected sampler
          (connectedSeed, disconnectedSeed) => {
            // Ensure seeds are different
            fc.pre(connectedSeed !== disconnectedSeed);

            const promptData = {
              "3": {
                "class_type": "KSampler",
                "inputs": {
                  "seed": connectedSeed,
                  "steps": 20,
                  "cfg": 7.0,
                  "sampler_name": "euler",
                  "scheduler": "normal",
                  "latent_image": ["8", 0]
                }
              },
              "5": {
                "class_type": "KSampler",
                "inputs": {
                  "seed": disconnectedSeed,
                  "steps": 30,
                  "cfg": 8.0,
                  "sampler_name": "dpmpp_2m",
                  "scheduler": "karras"
                  // No latent_image - disconnected!
                }
              },
              "8": {
                "class_type": "EmptyLatentImage",
                "inputs": {
                  "width": 512,
                  "height": 512
                }
              },
              "9": {
                "class_type": "SaveImage",
                "inputs": {
                  "images": ["3", 0]
                }
              }
            };

            const parser = new ComfyUIParser();
            const result = parser.parse({ prompt: promptData });

            // Property: Should use connected sampler's seed, not disconnected one
            return result.seed === connectedSeed;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 4: latent_image Disconnected Sampler Exclusion
   * 
   * Samplers without latent_image connection should be excluded (Silent_Drop).
   * 
   * **Validates: Requirements 3.1, 3.4**
   */
  describe('Property 4: latent_image Disconnected Sampler Exclusion', () => {
    it('should exclude samplers without latent_image connection', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999999999 }), // valid seed
          fc.integer({ min: 0, max: 999999999 }), // invalid seed
          (validSeed, invalidSeed) => {
            fc.pre(validSeed !== invalidSeed);

            const promptData = {
              "3": {
                "class_type": "KSampler",
                "inputs": {
                  "seed": invalidSeed,
                  "steps": 20,
                  "cfg": 7.0,
                  "sampler_name": "euler",
                  "scheduler": "normal"
                  // No latent_image!
                }
              },
              "5": {
                "class_type": "KSampler",
                "inputs": {
                  "seed": validSeed,
                  "steps": 30,
                  "cfg": 8.0,
                  "sampler_name": "dpmpp_2m",
                  "scheduler": "karras",
                  "latent_image": ["8", 0]
                }
              },
              "8": {
                "class_type": "EmptyLatentImage",
                "inputs": {
                  "width": 512,
                  "height": 512
                }
              },
              "9": {
                "class_type": "SaveImage",
                "inputs": {
                  "images": ["5", 0]
                }
              }
            };

            const parser = new ComfyUIParser();
            const result = parser.parse({ prompt: promptData });

            // Property: Should use valid sampler, exclude invalid one
            return result.seed === validSeed;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 5: Muted/Bypassed Node Exclusion
   * 
   * Nodes with mode=2 (Muted) or mode=4 (Bypassed) should be excluded.
   * 
   * **Validates: Requirements 3.2, 3.4**
   */
  describe('Property 5: Muted/Bypassed Node Exclusion', () => {
    it('should exclude muted samplers (mode=2)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999999999 }), // active seed
          fc.integer({ min: 0, max: 999999999 }), // muted seed
          (activeSeed, mutedSeed) => {
            fc.pre(activeSeed !== mutedSeed);

            const promptData = {
              "3": {
                "class_type": "KSampler",
                "mode": 2, // Muted
                "inputs": {
                  "seed": mutedSeed,
                  "steps": 20,
                  "cfg": 7.0,
                  "sampler_name": "euler",
                  "scheduler": "normal",
                  "latent_image": ["8", 0]
                }
              },
              "5": {
                "class_type": "KSampler",
                "inputs": {
                  "seed": activeSeed,
                  "steps": 30,
                  "cfg": 8.0,
                  "sampler_name": "dpmpp_2m",
                  "scheduler": "karras",
                  "latent_image": ["8", 0]
                }
              },
              "8": {
                "class_type": "EmptyLatentImage",
                "inputs": {
                  "width": 512,
                  "height": 512
                }
              },
              "9": {
                "class_type": "SaveImage",
                "inputs": {
                  "images": ["5", 0]
                }
              }
            };

            const parser = new ComfyUIParser();
            const result = parser.parse({ prompt: promptData });

            // Property: Should use active sampler, exclude muted one
            return result.seed === activeSeed;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should exclude bypassed samplers (mode=4)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999999999 }), // active seed
          fc.integer({ min: 0, max: 999999999 }), // bypassed seed
          (activeSeed, bypassedSeed) => {
            fc.pre(activeSeed !== bypassedSeed);

            const promptData = {
              "3": {
                "class_type": "KSampler",
                "mode": 4, // Bypassed
                "inputs": {
                  "seed": bypassedSeed,
                  "steps": 20,
                  "cfg": 7.0,
                  "sampler_name": "euler",
                  "scheduler": "normal",
                  "latent_image": ["8", 0]
                }
              },
              "5": {
                "class_type": "KSampler",
                "inputs": {
                  "seed": activeSeed,
                  "steps": 30,
                  "cfg": 8.0,
                  "sampler_name": "dpmpp_2m",
                  "scheduler": "karras",
                  "latent_image": ["8", 0]
                }
              },
              "8": {
                "class_type": "EmptyLatentImage",
                "inputs": {
                  "width": 512,
                  "height": 512
                }
              },
              "9": {
                "class_type": "SaveImage",
                "inputs": {
                  "images": ["5", 0]
                }
              }
            };

            const parser = new ComfyUIParser();
            const result = parser.parse({ prompt: promptData });

            // Property: Should use active sampler, exclude bypassed one
            return result.seed === activeSeed;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 7: Silent_Drop Processing Continuation
   * 
   * After excluding invalid samplers, processing should continue without errors.
   * 
   * **Validates: Requirements 3.5**
   */
  describe('Property 7: Silent_Drop Processing Continuation', () => {
    it('should continue processing after excluding invalid samplers', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }), // number of invalid samplers
          fc.integer({ min: 0, max: 999999999 }), // valid seed
          (numInvalid, validSeed) => {
            const promptData = {
              "8": {
                "class_type": "EmptyLatentImage",
                "inputs": {
                  "width": 512,
                  "height": 512
                }
              }
            };

            // Add invalid samplers
            for (let i = 0; i < numInvalid; i++) {
              promptData[`invalid_${i}`] = {
                "class_type": "KSampler",
                "inputs": {
                  "seed": i * 1000,
                  "steps": 20,
                  "cfg": 7.0,
                  "sampler_name": "euler",
                  "scheduler": "normal"
                  // No latent_image - invalid!
                }
              };
            }

            // Add one valid sampler
            promptData["valid"] = {
              "class_type": "KSampler",
              "inputs": {
                "seed": validSeed,
                "steps": 30,
                "cfg": 8.0,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "latent_image": ["8", 0]
              }
            };

            promptData["9"] = {
              "class_type": "SaveImage",
              "inputs": {
                "images": ["valid", 0]
              }
            };

            const parser = new ComfyUIParser();
            
            // Property: Should not throw and should extract from valid sampler
            try {
              const result = parser.parse({ prompt: promptData });
              return result.seed === validSeed;
            } catch (e) {
              return false; // Should not throw
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should handle all samplers being invalid gracefully', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3 }), // number of invalid samplers
          (numInvalid) => {
            const promptData = {
              "8": {
                "class_type": "EmptyLatentImage",
                "inputs": {
                  "width": 512,
                  "height": 512
                }
              }
            };

            // Add only invalid samplers
            for (let i = 0; i < numInvalid; i++) {
              promptData[`invalid_${i}`] = {
                "class_type": "KSampler",
                "inputs": {
                  "seed": i * 1000,
                  "steps": 20,
                  "cfg": 7.0,
                  "sampler_name": "euler",
                  "scheduler": "normal"
                  // No latent_image - invalid!
                }
              };
            }

            promptData["9"] = {
              "class_type": "SaveImage",
              "inputs": {
                "images": ["8", 0]
              }
            };

            const parser = new ComfyUIParser();
            
            // Property: Should not throw even when all samplers are invalid
            try {
              const result = parser.parse({ prompt: promptData });
              // Should return some result (may have format field)
              return result && typeof result === 'object';
            } catch (e) {
              return false; // Should not throw
            }
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property: Extraction Consistency
   * 
   * Parsing the same metadata multiple times should produce identical results.
   * 
   * **Validates: General correctness**
   */
  describe('Property: Extraction Consistency', () => {
    it('should produce identical results for repeated parsing', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999999999 }), // seed
          fc.integer({ min: 1, max: 100 }), // steps
          fc.float({ min: 1.0, max: 20.0 }), // cfg
          (seed, steps, cfg) => {
            const promptData = {
              "3": {
                "class_type": "KSampler",
                "inputs": {
                  "seed": seed,
                  "steps": steps,
                  "cfg": cfg,
                  "sampler_name": "euler",
                  "scheduler": "normal",
                  "latent_image": ["8", 0]
                }
              },
              "8": {
                "class_type": "EmptyLatentImage",
                "inputs": {
                  "width": 512,
                  "height": 512
                }
              },
              "9": {
                "class_type": "SaveImage",
                "inputs": {
                  "images": ["3", 0]
                }
              }
            };

            const parser = new ComfyUIParser();
            const result1 = parser.parse({ prompt: promptData });
            const result2 = parser.parse({ prompt: promptData });

            // Property: Results should be identical
            return result1.seed === result2.seed &&
                   result1.steps === result2.steps &&
                   Math.abs(result1.cfg - result2.cfg) < 0.001;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property: Format Field Always Present
   * 
   * All parsed ComfyUI metadata should have format='comfyui'.
   * 
   * **Validates: General correctness**
   */
  describe('Property: Format Field Always Present', () => {
    it('should always include format field set to "comfyui"', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999999999 }), // seed
          (seed) => {
            const promptData = {
              "3": {
                "class_type": "KSampler",
                "inputs": {
                  "seed": seed,
                  "steps": 20,
                  "cfg": 7.0,
                  "sampler_name": "euler",
                  "scheduler": "normal",
                  "latent_image": ["8", 0]
                }
              },
              "8": {
                "class_type": "EmptyLatentImage",
                "inputs": {
                  "width": 512,
                  "height": 512
                }
              },
              "9": {
                "class_type": "SaveImage",
                "inputs": {
                  "images": ["3", 0]
                }
              }
            };

            const parser = new ComfyUIParser();
            const result = parser.parse({ prompt: promptData });

            // Property: Format should always be 'comfyui'
            return result.format === 'comfyui';
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
