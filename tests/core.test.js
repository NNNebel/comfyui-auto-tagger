import { describe, it, expect } from 'vitest';
import { extractComfyMetadata, cleanPrompt, processMetadata, removeAnnotation } from '../js/core.js';

describe('Core Logic Tests', () => {

    // --- 1. Checkpoint & Global Metadata Tests ---
    describe('Checkpoint Extraction', () => {
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
    });

    // --- 2. Base Sampler Strategy Tests ---
    describe('Base Sampler Strategy (First-win)', () => {
        it('should identify Base Sampler by distance to EmptyLatentImage', () => {
            const mockJson = {
                prompt: {
                    "1": { class_type: "KSampler", inputs: { seed: 111, sampler_name: "base", latent_image: ["10", 0] } },
                    "2": { class_type: "KSampler", inputs: { seed: 222, sampler_name: "refiner", latent_image: ["1", 0] } },
                    "10": { class_type: "EmptyLatentImage", inputs: {} }
                }
            };
            const result = extractComfyMetadata(mockJson);
            expect(result.seed).toBe(111);
            expect(result.sampler).toBe("base");
            expect(result.sampler_fallback).toBe(false);
            
            // Check extra samplers
            expect(result.extra_samplers).toHaveLength(2);
            const base = result.extra_samplers.find(s => s.id === "1");
            expect(base.is_base).toBe(true);
        });

        it('should identify Base Sampler by distance to VAEEncode (img2img case)', () => {
            const mockJson = {
                prompt: {
                    "1": { class_type: "KSampler", inputs: { seed: 333, sampler_name: "img2img", latent_image: ["20", 0] } },
                    "20": { class_type: "VAEEncode", inputs: {} }
                }
            };
            const result = extractComfyMetadata(mockJson);
            expect(result.seed).toBe(333);
            expect(result.sampler).toBe("img2img");
            expect(result.sampler_fallback).toBe(false);
        });

        it('should fallback to smallest ID if source is not found (Cyclic or disconnected)', () => {
            const mockJson = {
                prompt: {
                    "10": { class_type: "KSampler", inputs: { seed: 999, sampler_name: "fallback_target" } },
                    "5": { class_type: "KSampler", inputs: { seed: 888, sampler_name: "fallback_winner" } }
                }
            };
            const result = extractComfyMetadata(mockJson);
            expect(result.seed).toBe(888); // ID 5 < ID 10
            expect(result.sampler).toBe("fallback_winner");
            expect(result.sampler_fallback).toBe(true);
        });

        it('should break ties with smallest ID if distances are equal', () => {
            const mockJson = {
                prompt: {
                    "10": { class_type: "EmptyLatentImage", inputs: {} },
                    "2": { class_type: "KSampler", inputs: { seed: 20, sampler_name: "tie1", latent_image: ["10", 0] } },
                    "3": { class_type: "KSampler", inputs: { seed: 30, sampler_name: "tie2", latent_image: ["10", 0] } }
                }
            };
            // Both distance 1. ID 2 < ID 3.
            const result = extractComfyMetadata(mockJson);
            expect(result.seed).toBe(20);
            expect(result.sampler).toBe("tie1");
        });
    });

    // --- 3. Prompt Merge Strategy Tests ---
    describe('Prompt Merge Strategy', () => {
        it('should merge prompts from multiple KSamplers', () => {
            const mockJson = {
                prompt: {
                    "1": { class_type: "KSampler", inputs: { positive: ["10", 0], negative: ["11", 0], sampler_name: "s1" } },
                    "2": { class_type: "KSampler", inputs: { positive: ["12", 0], negative: ["13", 0], sampler_name: "s2" } },
                    "10": { class_type: "TextNode", inputs: { text: "cat" } },
                    "11": { class_type: "TextNode", inputs: { text: "bad" } },
                    "12": { class_type: "TextNode", inputs: { text: "dog" } },
                    "13": { class_type: "TextNode", inputs: { text: "worst" } }
                }
            };
            const result = extractComfyMetadata(mockJson);
            
            // Should contain all unique prompts
            expect(result.positive).toContain("cat");
            expect(result.positive).toContain("dog");
            expect(result.negative).toContain("bad");
            expect(result.negative).toContain("worst");
        });

        it('should deduplicate prompts', () => {
            const mockJson = {
                prompt: {
                    "1": { class_type: "KSampler", inputs: { positive: ["10", 0] } },
                    "2": { class_type: "KSampler", inputs: { positive: ["11", 0] } },
                    "10": { class_type: "TextNode", inputs: { text: "cat" } },
                    "11": { class_type: "TextNode", inputs: { text: "cat" } }
                }
            };
            const result = extractComfyMetadata(mockJson);
            // "cat" should appear only once (implied by Set usage, but string join might look like "cat")
            // Actually implementation joins with \n.
            expect(result.positive.trim()).toBe("cat");
        });
    });

    // --- 4. Prompt Cleaning Tests ---
    describe('Prompt Cleaning', () => {
        it('should clean prompt text correctly (commas, newlines)', () => {
            const text = `cat, dog, 
     bird`;
            const cleaned = cleanPrompt(text);
            expect(cleaned).toEqual(expect.arrayContaining(["cat", "dog", "bird"]));
        });

        it('should handle weighting syntax (tag:1.2)', () => {
            const text = "(cat:1.2), [dog], ((bird))";
            const cleaned = cleanPrompt(text);
            // Implementation logic: 
            // 1. (cat:1.2) -> clean delimiters -> cat:1.2 (simple regex replace might leave :1.2?)
            // Let's check current impl: `v.replace(/[()]/g, '')`
            // So (cat:1.2) -> cat:1.2
            expect(cleaned).toContain("cat:1.2"); 
            expect(cleaned).toContain("[dog]");
            expect(cleaned).toContain("bird");
        });
    });

    // --- 5. Processing & Annotation Tests ---
    describe('processMetadata (Tag & Annotation)', () => {
        const mockMeta = {
            checkpoint: "sd_xl.safetensors",
            loras: ["lora1.safetensors"],
            positive: "cat",
            negative: "ugly",
            seed: 100,
            steps: 20,
            cfg: 7.0,
            sampler: "euler",
            extra_samplers: [
                { id: "1", seed: 100, sampler: "euler", is_base: true },
                { id: "2", seed: 200, sampler: "dpmpp", is_base: false }
            ]
        };
        const mockT = (key) => key;

        it('should generate tags using ONLY base sampler info', () => {
            const settings = { seed: true, sampler: true };
            const result = processMetadata(mockMeta, settings, mockT);
            
            expect(result.tags.has("seed:100")).toBe(true);
            expect(result.tags.has("seed:200")).toBe(false);
            expect(result.tags.has("sampler:euler")).toBe(true);
            expect(result.tags.has("sampler:dpmpp")).toBe(false);
        });

        it('should generate annotation with MULTIPLE seeds', () => {
            const settings = { seed: true, writeNotes: true };
            const result = processMetadata(mockMeta, settings, mockT);
            
            // Base seed
            expect(result.annotation).toContain("ui.option.seed: 100");
            // Extra seed
            expect(result.annotation).toContain("ui.option.seed (dpmpp): 200");
        });

        it('should handle paths in checkpoint names (Windows/Linux)', () => {
            const metaWin = { ...mockMeta, checkpoint: "C:\\models\\win_model.safetensors" };
            const resWin = processMetadata(metaWin, { checkpoint: true }, mockT);
            expect(resWin.tags.has("win_model")).toBe(true);

            const metaLin = { ...mockMeta, checkpoint: "/mnt/models/lin_model.safetensors" };
            const resLin = processMetadata(metaLin, { checkpoint: true }, mockT);
            expect(resLin.tags.has("lin_model")).toBe(true);
        });

        it('should include [Caution] message when fallback occurs', () => {
            const metaFallback = { ...mockMeta, sampler_fallback: true };
            const result = processMetadata(metaFallback, { checkpoint: true }, mockT);
            expect(result.annotation).toContain("[Caution] log.caution.sampler_fallback");
        });
    });

    // --- 6. Utility Tests ---
    describe('removeAnnotation', () => {
        it('should remove generation info block', () => {
            const input = "User Note\n\n[Generation Info]\nCheckpoint: model";
            expect(removeAnnotation(input)).toBe("User Note");
        });
        it('should handle text without marker', () => {
            expect(removeAnnotation("Note")).toBe("Note");
        });
    });
});