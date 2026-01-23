import { describe, it, expect } from 'vitest';
import { extractComfyMetadata, cleanPrompt, processMetadata, removeAnnotation } from '../js/core.js';

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

    it('should handle Windows-style path in checkpoint name', () => {
        const mockJson = {
            prompt: {
                "4": { 
                    class_type: "CheckpointLoaderSimple", 
                    inputs: { ckpt_name: "folder\\subfolder\\model.safetensors" } 
                }
            }
        };
        const meta = extractComfyMetadata(mockJson);
        const settings = { checkpoint: true };
        const mockT = (key) => key;
        const result = processMetadata(meta, settings, mockT);
        
        expect(result.tags.has("model")).toBe(true);
        expect(result.annotation).toContain("model");
        expect(result.annotation).not.toContain("folder");
    });

    it('should handle Linux-style path in checkpoint name', () => {
        const mockJson = {
            prompt: {
                "4": { 
                    class_type: "CheckpointLoaderSimple", 
                    inputs: { ckpt_name: "folder/subfolder/linux_model.safetensors" } 
                }
            }
        };
        const meta = extractComfyMetadata(mockJson);
        const settings = { checkpoint: true };
        const mockT = (key) => key;
        const result = processMetadata(meta, settings, mockT);
        
        expect(result.tags.has("linux_model")).toBe(true);
        expect(result.annotation).toContain("linux_model");
    });

    it('should merge prompts from multiple KSamplers', () => {
        const mockJson = {
            prompt: {
                "1": { class_type: "KSampler", inputs: { positive: ["10", 0], negative: ["11", 0], sampler_name: "euler", seed: 1 } },
                "2": { class_type: "KSampler", inputs: { positive: ["12", 0], negative: ["13", 0], sampler_name: "euler", seed: 2 } },
                "10": { class_type: "TextNode", inputs: { text: "cat" } },
                "11": { class_type: "TextNode", inputs: { text: "low quality" } },
                "12": { class_type: "TextNode", inputs: { text: "dog" } },
                "13": { class_type: "TextNode", inputs: { text: "worst quality" } },
                "20": { class_type: "EmptyLatentImage", inputs: {} }
            }
        };
        // Link samplers to source to avoid fallback
        mockJson.prompt["1"].inputs.latent_image = ["20", 0];
        mockJson.prompt["2"].inputs.latent_image = ["1", 0];

        const result = extractComfyMetadata(mockJson);
        expect(result.positive).toContain("cat");
        expect(result.positive).toContain("dog");
        expect(result.negative).toContain("low quality");
        expect(result.negative).toContain("worst quality");
    });

    it('should identify Base Sampler by distance to source', () => {
        const mockJson = {
            prompt: {
                "1": { class_type: "KSampler", inputs: { seed: 111, sampler_name: "euler", latent_image: ["10", 0] } },
                "2": { class_type: "KSampler", inputs: { seed: 222, sampler_name: "dpmpp", latent_image: ["1", 0] } },
                "10": { class_type: "EmptyLatentImage", inputs: {} }
            }
        };
        const result = extractComfyMetadata(mockJson);
        expect(result.seed).toBe(111);
        expect(result.sampler).toBe("euler");
        expect(result.sampler_fallback).toBe(false);
    });

    it('should fallback to smallest ID if source is not found', () => {
        const mockJson = {
            prompt: {
                "10": { class_type: "KSampler", inputs: { seed: 111, sampler_name: "euler" } },
                "5": { class_type: "KSampler", inputs: { seed: 222, sampler_name: "dpmpp" } }
            }
        };
        const result = extractComfyMetadata(mockJson);
        expect(result.seed).toBe(222); // ID 5 is smaller than 10
        expect(result.sampler_fallback).toBe(true);
    });

    it('should collect multiple seeds and separate base seed', () => {
        const mockJson = {
            prompt: {
                "1": { class_type: "KSampler", inputs: { seed: 100, sampler_name: "base_samp", latent_image: ["10", 0] } },
                "2": { class_type: "KSampler", inputs: { seed: 200, sampler_name: "refiner", latent_image: ["1", 0] } },
                "10": { class_type: "EmptyLatentImage", inputs: {} }
            }
        };
        const result = extractComfyMetadata(mockJson);
        
        // Check Base Seed (for tags)
        expect(result.seed).toBe(100);
        expect(result.sampler).toBe("base_samp");
        
        // Check Extra Samplers (collection)
        expect(result.extra_samplers).toBeDefined();
        expect(result.extra_samplers.length).toBe(2);
        
        const base = result.extra_samplers.find(s => s.id === "1");
        const refiner = result.extra_samplers.find(s => s.id === "2");
        
        expect(base.is_base).toBe(true);
        expect(base.seed).toBe(100);
        expect(refiner.is_base).toBe(false);
        expect(refiner.seed).toBe(200);

        // Check Annotation Formatting
        const settings = { seed: true, writeNotes: true };
        const mockT = (key) => key;
        const processed = processMetadata(result, settings, mockT);
        
        // Tags should ONLY contain base seed
        expect(processed.tags.has("seed:100")).toBe(true);
        expect(processed.tags.has("seed:200")).toBe(false);
        
        // Annotation should contain BOTH
        expect(processed.annotation).toContain("ui.option.seed: 100");
        expect(processed.annotation).toContain("ui.option.seed (refiner): 200");
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
        });

        it('should include [Caution] message in annotation if fallback used', () => {
            const metaWithFallback = { ...mockMeta, sampler_fallback: true };
            const settings = { checkpoint: true, writeNotes: true };
            const mockT = (key) => key === 'log.caution.sampler_fallback' ? 'Caution Message' : key;
            
            const result = processMetadata(metaWithFallback, settings, mockT);
            expect(result.annotation).toContain('[Caution] Caution Message');
        });
    });

    describe('removeAnnotation', () => {
        it('should remove generation info block', () => {
            const input = "User Note\n\n[Generation Info]\nCheckpoint: model.safetensors";
            const expected = "User Note";
            expect(removeAnnotation(input)).toBe(expected);
        });

        it('should return original text if marker is not found', () => {
            const input = "Just a user note";
            expect(removeAnnotation(input)).toBe(input);
        });

        it('should handle empty string', () => {
            expect(removeAnnotation("")).toBe("");
        });

        it('should handle text starting with marker', () => {
            const input = "[Generation Info]\nSome info";
            expect(removeAnnotation(input)).toBe("");
        });
    });
});
