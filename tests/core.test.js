import { describe, it, expect } from 'vitest';
import { extractComfyMetadata, cleanPrompt, processMetadata } from '../js/core.js';

describe('Core Logic Tests', () => {
    it('should extract checkpoint name correctly', () => {
        const mockJson = {
            prompt: {
                "4": { 
                    class_type: "CheckpointLoaderSimple", 
                    inputs: { ckpt_name: "sd_xl_base_1.0.safetensors" } 
                }
            }
        };
        const result = extractComfyMetadata(mockJson);
        expect(result.checkpoint).toBe("sd_xl_base_1.0.safetensors");
    });

    it('should extract sampler parameters correctly', () => {
        const mockJson = {
            prompt: {
                "3": { 
                    class_type: "KSampler", 
                    inputs: { seed: 12345, steps: 20, cfg: 8.0, sampler_name: "euler" } 
                }
            }
        };
        const result = extractComfyMetadata(mockJson);
        expect(result.seed).toBe(12345);
        expect(result.steps).toBe(20);
        expect(result.cfg).toBe(8.0);
        expect(result.sampler).toBe("euler");
    });

    it('should clean prompt text correctly', () => {
        const text = `cat, dog, 
 bird`;
        const cleaned = cleanPrompt(text);
        expect(cleaned).toEqual(expect.arrayContaining(["cat", "dog", "bird"]));
    });

    describe('processMetadata', () => {
        const mockMeta = {
            checkpoint: "sd_xl_base_1.0.safetensors",
            loras: ["lora1.safetensors"],
            positive: "cat, cute",
            negative: "ugly, blur",
            seed: 12345,
            steps: 20,
            cfg: 7.0,
            sampler: "euler"
        };
        const mockT = (key) => key; // Mock translation function

        it('should generate tags only for enabled settings', () => {
            const settings = {
                checkpoint: true,
                lora: false,
                positive: true,
                negative: false,
                seed: false,
                steps: true,
                cfg: false,
                sampler: false
            };
            const result = processMetadata(mockMeta, settings, mockT);
            
            expect(result.tags.has("sd_xl_base_1.0")).toBe(true); // Checkpoint
            expect(result.tags.has("lora1")).toBe(false); // LoRA (Disabled)
            expect(result.tags.has("cat")).toBe(true); // Positive
            expect(result.tags.has("ugly")).toBe(false); // Negative (Disabled)
            expect(result.tags.has("steps:20")).toBe(true); // Steps
            expect(result.tags.has("seed:12345")).toBe(false); // Seed (Disabled)
        });

        it('should generate no tags if all settings are disabled', () => {
            const settings = {
                checkpoint: false, lora: false, positive: false, negative: false,
                seed: false, steps: false, cfg: false, sampler: false
            };
            const result = processMetadata(mockMeta, settings, mockT);
            expect(result.tags.size).toBe(0);
        });

        it('should generate annotation with all info when settings are enabled', () => {
            const settings = {
                checkpoint: true, lora: true, positive: true, negative: true,
                seed: true, steps: true, cfg: true, sampler: true,
                addTags: true, writeNotes: true
            };
            const result = processMetadata(mockMeta, settings, mockT);
            
            expect(result.annotation).toContain('ui.option.checkpoint: sd_xl_base_1.0');
            expect(result.annotation).toContain('ui.option.lora: lora1');
            expect(result.annotation).toContain('ui.option.steps: 20');
            expect(result.annotation).toContain('ui.option.seed: 12345');
            expect(result.annotation).toContain('[Positive Prompt]');
            expect(result.annotation).toContain('cat, cute');
        });

        it('should exclude disabled info from annotation', () => {
            const settings = {
                checkpoint: true, lora: false, positive: true, negative: false,
                seed: false, steps: true, cfg: true, sampler: false,
                addTags: true, writeNotes: true
            };
            const result = processMetadata(mockMeta, settings, mockT);
            
            expect(result.annotation).toContain('ui.option.checkpoint: sd_xl_base_1.0');
            expect(result.annotation).not.toContain('ui.option.lora');
            expect(result.annotation).toContain('ui.option.steps: 20');
            expect(result.annotation).not.toContain('ui.option.seed');
            expect(result.annotation).toContain('[Positive Prompt]');
            expect(result.annotation).not.toContain('[Negative Prompt]');
        });
    });
});
