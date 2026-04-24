import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import ComfyUIParser from '../../js/metadata-parser/parsers/ComfyUIParser.js';

/**
 * Property-Based Tests for ComfyUI Field Extraction
 * 
 * These tests verify that the ComfyUIParser correctly extracts all metadata fields
 * from valid ComfyUI prompt and workflow structures.
 * Using fast-check to generate randomized test cases.
 */

describe('ComfyUIParser - Property Tests: Field Extraction', () => {
  /**
   * Property 6: ComfyUI Field Extraction
   * 
   * For any valid ComfyUI metadata containing checkpoint, LoRA, prompt, seed, sampler,
   * steps, or CFG information, the ComfyUI_Parser should extract all present fields
   * into the corresponding properties of the ParsedMetadata object.
   * 
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**
   */
  describe('Property 6: ComfyUI Field Extraction', () => {
    /**
     * Arbitrary generator for checkpoint names (valid filenames without path separators)
     */
    const checkpointArb = fc.oneof(
      fc.constantFrom(
        'sd_xl_base_1.0.safetensors',
        'v1-5-pruned.ckpt',
        'model.safetensors',
        'checkpoint_v2.ckpt'
      ),
      fc.string({ minLength: 1, maxLength: 50 })
        .filter(s => {
          const trimmed = s.trim();
          // Ensure non-empty after trim and doesn't contain path separators
          return trimmed.length > 0 && 
                 !trimmed.includes('/') && 
                 !trimmed.includes('\\');
        })
        .map(s => s.trim() + '.safetensors')
    );

    /**
     * Arbitrary generator for LoRA names
     */
    const loraArb = fc.oneof(
      fc.constantFrom(
        'lora_style.safetensors',
        'character_lora.safetensors',
        'detail_tweaker.safetensors'
      ),
      fc.string({ minLength: 3, maxLength: 30 }).map(s => s.replace(/[^a-zA-Z0-9_-]/g, '_') + '.safetensors')
    );

    /**
     * Arbitrary generator for prompts (non-empty after trimming)
     */
    const promptArb = fc.oneof(
      fc.constantFrom(
        'masterpiece, best quality, 1girl',
        'cat, detailed, photorealistic',
        'landscape, mountains, sunset',
        'portrait, professional lighting'
      ),
      fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length > 0)
    );

    /**
     * Arbitrary generator for sampler names
     */
    const samplerArb = fc.constantFrom(
      'euler',
      'euler_a',
      'dpmpp_2m',
      'dpmpp_sde',
      'ddim',
      'uni_pc'
    );

    /**
     * Arbitrary generator for scheduler names
     */
    const schedulerArb = fc.constantFrom(
      'normal',
      'karras',
      'exponential',
      'simple'
    );

    /**
     * Test: Checkpoint extraction from prompt (Requirement 3.1)
     */
    it('should extract checkpoint name from CheckpointLoader in prompt', () => {
      fc.assert(
        fc.property(
          checkpointArb,
          fc.string({ minLength: 1, maxLength: 5 }).map(s => s.replace(/[^0-9]/g, '1')), // Node ID
          (checkpointName, nodeId) => {
            const parser = new ComfyUIParser();
            const rawChunks = {
              prompt: {
                [nodeId]: {
                  class_type: 'CheckpointLoaderSimple',
                  inputs: { ckpt_name: checkpointName }
                }
              }
            };
            
            const result = parser.parse(rawChunks);
            
            // Property: Checkpoint should be extracted
            return result.checkpoint === checkpointName;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Checkpoint extraction from workflow (Requirement 3.1)
     */
    it('should extract checkpoint name from CheckpointLoader in workflow', () => {
      fc.assert(
        fc.property(
          checkpointArb,
          (checkpointName) => {
            const parser = new ComfyUIParser();
            const rawChunks = {
              workflow: {
                nodes: [
                  {
                    type: 'CheckpointLoaderSimple',
                    widgets_values: [checkpointName]
                  }
                ]
              }
            };
            
            const result = parser.parse(rawChunks);
            
            // Property: Checkpoint should be extracted
            return result.checkpoint === checkpointName;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Checkpoint path extraction (handles both / and \)
     */
    it('should extract checkpoint filename from paths with any separator', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.string({ minLength: 1, maxLength: 15 })
              .filter(s => s.trim().length > 0 && !s.includes('/') && !s.includes('\\')),
            { minLength: 1, maxLength: 3 }
          ),
          checkpointArb,
          fc.constantFrom('/', '\\'),
          (pathParts, filename, separator) => {
            const parser = new ComfyUIParser();
            const fullPath = [...pathParts, filename].join(separator);
            
            const rawChunks = {
              workflow: {
                nodes: [
                  {
                    type: 'CheckpointLoaderSimple',
                    widgets_values: [fullPath]
                  }
                ]
              }
            };
            
            const result = parser.parse(rawChunks);
            
            // Property: Should extract only the filename, not the path
            return result.checkpoint === filename;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: LoRA extraction (Requirement 3.2)
     */
    it('should extract all LoRA names from LoraLoader nodes', () => {
      fc.assert(
        fc.property(
          fc.array(loraArb, { minLength: 1, maxLength: 5 }),
          (loraNames) => {
            const parser = new ComfyUIParser();
            
            // Create unique LoRA names to avoid deduplication issues
            const uniqueLoras = [...new Set(loraNames)];
            
            // Build prompt with LoraLoader nodes
            const prompt = {};
            uniqueLoras.forEach((lora, index) => {
              prompt[String(index + 1)] = {
                class_type: 'LoraLoader',
                inputs: { lora_name: lora }
              };
            });
            
            const rawChunks = { prompt };
            const result = parser.parse(rawChunks);
            
            // Property: All LoRAs should be extracted
            if (!result.loras || !Array.isArray(result.loras)) {
              return false;
            }
            
            // Check that all unique LoRAs are present
            return uniqueLoras.every(lora => result.loras.includes(lora)) &&
                   result.loras.length === uniqueLoras.length;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Positive prompt extraction (Requirement 3.3)
     */
    it('should extract positive prompt from KSampler', () => {
      fc.assert(
        fc.property(
          promptArb,
          (positivePrompt) => {
            const parser = new ComfyUIParser();
            const rawChunks = {
              prompt: {
                '1': {
                  class_type: 'KSampler',
                  inputs: {
                    seed: 12345,
                    steps: 20,
                    cfg: 7,
                    positive: ['10', 0],
                    negative: ['11', 0],
                    latent_image: ['20', 0]
                  }
                },
                '10': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: positivePrompt }
                },
                '11': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: 'negative' }
                },
                '20': {
                  class_type: 'EmptyLatentImage',
                  inputs: {}
                }
              }
            };
            
            const result = parser.parse(rawChunks);
            
            // Property: Positive prompt should be extracted (trimmed)
            // The parser trims prompts during merging
            const trimmedPrompt = positivePrompt.trim();
            return result.positive === trimmedPrompt;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Negative prompt extraction (Requirement 3.4)
     */
    it('should extract negative prompt from KSampler', () => {
      fc.assert(
        fc.property(
          promptArb,
          (negativePrompt) => {
            const parser = new ComfyUIParser();
            const rawChunks = {
              prompt: {
                '1': {
                  class_type: 'KSampler',
                  inputs: {
                    seed: 12345,
                    steps: 20,
                    cfg: 7,
                    positive: ['10', 0],
                    negative: ['11', 0],
                    latent_image: ['20', 0]
                  }
                },
                '10': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: 'positive' }
                },
                '11': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: negativePrompt }
                },
                '20': {
                  class_type: 'EmptyLatentImage',
                  inputs: {}
                }
              }
            };
            
            const result = parser.parse(rawChunks);
            
            // Property: Negative prompt should be extracted (trimmed)
            // The parser trims prompts during merging
            const trimmedPrompt = negativePrompt.trim();
            return result.negative === trimmedPrompt;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Seed extraction (Requirement 3.5)
     */
    it('should extract seed value from KSampler', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2147483647 }), // Valid seed range
          (seed) => {
            const parser = new ComfyUIParser();
            const rawChunks = {
              prompt: {
                '1': {
                  class_type: 'KSampler',
                  inputs: {
                    seed: seed,
                    steps: 20,
                    cfg: 7,
                    positive: ['10', 0],
                    negative: ['11', 0],
                    latent_image: ['20', 0]
                  }
                },
                '10': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: 'positive' }
                },
                '11': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: 'negative' }
                },
                '20': {
                  class_type: 'EmptyLatentImage',
                  inputs: {}
                }
              }
            };
            
            const result = parser.parse(rawChunks);
            
            // Property: Seed should be extracted
            return result.seed === seed;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Sampler extraction (Requirement 3.6)
     */
    it('should extract sampler name from KSampler', () => {
      fc.assert(
        fc.property(
          samplerArb,
          (samplerName) => {
            const parser = new ComfyUIParser();
            const rawChunks = {
              prompt: {
                '1': {
                  class_type: 'KSampler',
                  inputs: {
                    seed: 12345,
                    steps: 20,
                    cfg: 7,
                    sampler_name: samplerName,
                    positive: ['10', 0],
                    negative: ['11', 0],
                    latent_image: ['20', 0]
                  }
                },
                '10': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: 'positive' }
                },
                '11': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: 'negative' }
                },
                '20': {
                  class_type: 'EmptyLatentImage',
                  inputs: {}
                }
              }
            };
            
            const result = parser.parse(rawChunks);
            
            // Property: Sampler should be extracted
            return result.sampler === samplerName;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Steps extraction (Requirement 3.7)
     */
    it('should extract steps value from KSampler', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 150 }), // Reasonable steps range
          (steps) => {
            const parser = new ComfyUIParser();
            const rawChunks = {
              prompt: {
                '1': {
                  class_type: 'KSampler',
                  inputs: {
                    seed: 12345,
                    steps: steps,
                    cfg: 7,
                    positive: ['10', 0],
                    negative: ['11', 0],
                    latent_image: ['20', 0]
                  }
                },
                '10': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: 'positive' }
                },
                '11': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: 'negative' }
                },
                '20': {
                  class_type: 'EmptyLatentImage',
                  inputs: {}
                }
              }
            };
            
            const result = parser.parse(rawChunks);
            
            // Property: Steps should be extracted
            return result.steps === steps;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: CFG scale extraction (Requirement 3.8)
     */
    it('should extract CFG scale value from KSampler', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1.0, max: 30.0, noNaN: true }), // Reasonable CFG range
          (cfg) => {
            const parser = new ComfyUIParser();
            const rawChunks = {
              prompt: {
                '1': {
                  class_type: 'KSampler',
                  inputs: {
                    seed: 12345,
                    steps: 20,
                    cfg: cfg,
                    positive: ['10', 0],
                    negative: ['11', 0],
                    latent_image: ['20', 0]
                  }
                },
                '10': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: 'positive' }
                },
                '11': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: 'negative' }
                },
                '20': {
                  class_type: 'EmptyLatentImage',
                  inputs: {}
                }
              }
            };
            
            const result = parser.parse(rawChunks);
            
            // Property: CFG should be extracted (with floating point tolerance)
            return result.cfg !== undefined && Math.abs(result.cfg - cfg) < 0.0001;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Scheduler extraction (additional field)
     */
    it('should extract scheduler value from KSampler', () => {
      fc.assert(
        fc.property(
          schedulerArb,
          (scheduler) => {
            const parser = new ComfyUIParser();
            const rawChunks = {
              prompt: {
                '1': {
                  class_type: 'KSampler',
                  inputs: {
                    seed: 12345,
                    steps: 20,
                    cfg: 7,
                    scheduler: scheduler,
                    positive: ['10', 0],
                    negative: ['11', 0],
                    latent_image: ['20', 0]
                  }
                },
                '10': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: 'positive' }
                },
                '11': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: 'negative' }
                },
                '20': {
                  class_type: 'EmptyLatentImage',
                  inputs: {}
                }
              }
            };
            
            const result = parser.parse(rawChunks);
            
            // Property: Scheduler should be extracted
            return result.scheduler === scheduler;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Complete metadata extraction (all fields together)
     */
    it('should extract all fields when present in complete ComfyUI metadata', () => {
      fc.assert(
        fc.property(
          checkpointArb,
          fc.array(loraArb, { minLength: 1, maxLength: 3 }),
          promptArb,
          promptArb,
          fc.integer({ min: 0, max: 2147483647 }),
          samplerArb,
          schedulerArb,
          fc.integer({ min: 1, max: 150 }),
          fc.float({ min: 1.0, max: 30.0, noNaN: true }),
          (checkpoint, loras, positive, negative, seed, sampler, scheduler, steps, cfg) => {
            const parser = new ComfyUIParser();
            
            // Build complete prompt structure
            const prompt = {
              '1': {
                class_type: 'KSampler',
                inputs: {
                  seed: seed,
                  steps: steps,
                  cfg: cfg,
                  sampler_name: sampler,
                  scheduler: scheduler,
                  positive: ['10', 0],
                  negative: ['11', 0],
                  latent_image: ['20', 0]
                }
              },
              '4': {
                class_type: 'CheckpointLoaderSimple',
                inputs: { ckpt_name: checkpoint }
              },
              '10': {
                class_type: 'CLIPTextEncode',
                inputs: { text: positive }
              },
              '11': {
                class_type: 'CLIPTextEncode',
                inputs: { text: negative }
              },
              '20': {
                class_type: 'EmptyLatentImage',
                inputs: {}
              }
            };
            
            // Add LoRA loaders
            const uniqueLoras = [...new Set(loras)];
            uniqueLoras.forEach((lora, index) => {
              prompt[String(100 + index)] = {
                class_type: 'LoraLoader',
                inputs: { lora_name: lora }
              };
            });
            
            const rawChunks = { prompt };
            const result = parser.parse(rawChunks);
            
            // Property: All fields should be extracted correctly
            const checkpointMatch = result.checkpoint === checkpoint;
            const lorasMatch = result.loras && 
                              uniqueLoras.every(l => result.loras.includes(l)) &&
                              result.loras.length === uniqueLoras.length;
            // Prompts are trimmed by the parser
            const positiveMatch = result.positive === positive.trim();
            const negativeMatch = result.negative === negative.trim();
            const seedMatch = result.seed === seed;
            const samplerMatch = result.sampler === sampler;
            const schedulerMatch = result.scheduler === scheduler;
            const stepsMatch = result.steps === steps;
            const cfgMatch = Math.abs(result.cfg - cfg) < 0.0001;
            
            return checkpointMatch && lorasMatch && positiveMatch && negativeMatch &&
                   seedMatch && samplerMatch && schedulerMatch && stepsMatch && cfgMatch;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Partial metadata extraction (some fields missing)
     */
    it('should extract only present fields without failing on missing fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            hasCheckpoint: fc.boolean(),
            hasLoras: fc.boolean(),
            hasPositive: fc.boolean(),
            hasNegative: fc.boolean(),
            hasSeed: fc.boolean(),
            hasSampler: fc.boolean(),
            hasSteps: fc.boolean(),
            hasCfg: fc.boolean()
          }),
          checkpointArb,
          loraArb,
          promptArb,
          promptArb,
          fc.integer({ min: 0, max: 2147483647 }),
          samplerArb,
          fc.integer({ min: 1, max: 150 }),
          fc.float({ min: 1.0, max: 30.0, noNaN: true }),
          (flags, checkpoint, lora, positive, negative, seed, sampler, steps, cfg) => {
            const parser = new ComfyUIParser();
            const prompt = {};
            
            // Build KSampler with conditional fields
            // Always include at least 3 sampling parameters to be recognized as a sampler
            const ksamplerInputs = {
              seed: flags.hasSeed ? seed : 12345,
              steps: flags.hasSteps ? steps : 20,
              cfg: flags.hasCfg ? cfg : 7,
              latent_image: ['20', 0]
            };
            
            if (flags.hasSampler) ksamplerInputs.sampler_name = sampler;
            if (flags.hasPositive) ksamplerInputs.positive = ['10', 0];
            if (flags.hasNegative) ksamplerInputs.negative = ['11', 0];
            
            prompt['1'] = {
              class_type: 'KSampler',
              inputs: ksamplerInputs
            };
            
            prompt['20'] = {
              class_type: 'EmptyLatentImage',
              inputs: {}
            };
            
            if (flags.hasPositive) {
              prompt['10'] = {
                class_type: 'CLIPTextEncode',
                inputs: { text: positive }
              };
            }
            
            if (flags.hasNegative) {
              prompt['11'] = {
                class_type: 'CLIPTextEncode',
                inputs: { text: negative }
              };
            }
            
            if (flags.hasCheckpoint) {
              prompt['4'] = {
                class_type: 'CheckpointLoaderSimple',
                inputs: { ckpt_name: checkpoint }
              };
            }
            
            if (flags.hasLoras) {
              prompt['100'] = {
                class_type: 'LoraLoader',
                inputs: { lora_name: lora }
              };
            }
            
            const rawChunks = { prompt };
            const result = parser.parse(rawChunks);
            
            // Property: Present fields should be extracted, absent fields should use defaults
            const checkpointOk = flags.hasCheckpoint ? result.checkpoint === checkpoint : result.checkpoint === undefined;
            const lorasOk = flags.hasLoras ? (result.loras && result.loras.includes(lora)) : (result.loras === undefined || (Array.isArray(result.loras) && result.loras.length === 0));
            // Prompts are trimmed by the parser
            const positiveOk = flags.hasPositive ? result.positive === positive.trim() : result.positive === undefined;
            const negativeOk = flags.hasNegative ? result.negative === negative.trim() : result.negative === undefined;
            // Seed, steps, cfg always have values (defaults if not specified)
            const seedOk = flags.hasSeed ? result.seed === seed : result.seed === 12345;
            const samplerOk = flags.hasSampler ? result.sampler === sampler : result.sampler === undefined;
            const stepsOk = flags.hasSteps ? result.steps === steps : result.steps === 20;
            const cfgOk = flags.hasCfg ? Math.abs(result.cfg - cfg) < 0.0001 : result.cfg === 7;
            
            return checkpointOk && lorasOk && positiveOk && negativeOk &&
                   seedOk && samplerOk && stepsOk && cfgOk;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Field extraction with indirect value resolution
     */
    it('should resolve indirect values through node links', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2147483647 }),
          (seed) => {
            const parser = new ComfyUIParser();
            
            // Seed is stored in a separate node and linked
            const rawChunks = {
              prompt: {
                '1': {
                  class_type: 'KSampler',
                  inputs: {
                    seed: ['30', 0], // Link to seed node
                    steps: 20,
                    cfg: 7,
                    positive: ['10', 0],
                    negative: ['11', 0],
                    latent_image: ['20', 0]
                  }
                },
                '10': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: 'positive' }
                },
                '11': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: 'negative' }
                },
                '20': {
                  class_type: 'EmptyLatentImage',
                  inputs: {}
                },
                '30': {
                  class_type: 'SeedNode',
                  inputs: { value: seed }
                }
              }
            };
            
            const result = parser.parse(rawChunks);
            
            // Property: Should resolve linked seed value
            return result.seed === seed;
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Format field is always present
     */
    it('should always include format field set to "comfyui"', () => {
      fc.assert(
        fc.property(
          fc.record({
            prompt: fc.option(fc.object()),
            workflow: fc.option(fc.object())
          }),
          (rawChunks) => {
            const parser = new ComfyUIParser();
            const result = parser.parse(rawChunks);
            
            // Property: Format should always be "comfyui"
            return result.format === 'comfyui';
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test: Extraction is deterministic
     */
    it('should produce identical results when parsing the same metadata multiple times', () => {
      fc.assert(
        fc.property(
          checkpointArb,
          promptArb,
          fc.integer({ min: 0, max: 2147483647 }),
          (checkpoint, positive, seed) => {
            const parser = new ComfyUIParser();
            const rawChunks = {
              prompt: {
                '1': {
                  class_type: 'KSampler',
                  inputs: {
                    seed: seed,
                    positive: ['10', 0],
                    latent_image: ['20', 0]
                  }
                },
                '4': {
                  class_type: 'CheckpointLoaderSimple',
                  inputs: { ckpt_name: checkpoint }
                },
                '10': {
                  class_type: 'CLIPTextEncode',
                  inputs: { text: positive }
                },
                '20': {
                  class_type: 'EmptyLatentImage',
                  inputs: {}
                }
              }
            };
            
            // Parse multiple times
            const result1 = parser.parse(rawChunks);
            const result2 = parser.parse(rawChunks);
            const result3 = parser.parse(rawChunks);
            
            // Property: All results should be identical
            return JSON.stringify(result1) === JSON.stringify(result2) &&
                   JSON.stringify(result2) === JSON.stringify(result3);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
