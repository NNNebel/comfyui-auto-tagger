import { describe, it, expect } from 'vitest';
import { cleanPrompt, processMetadata, removeAnnotation } from '../js/core.js';

describe('Core Logic Tests', () => {

    // NOTE: Metadata extraction tests have been moved to tests/unit/ComfyUIParser.test.js
    // This file now focuses on data formatting functions (processMetadata, cleanPrompt, removeAnnotation)

    // --- 1. Prompt Cleaning Tests ---
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
            // Implementation removes parentheses: (cat:1.2) -> cat:1.2
            expect(cleaned).toContain("cat:1.2"); 
            expect(cleaned).toContain("[dog]");
            expect(cleaned).toContain("bird");
        });
    });

    // --- 2. Processing & Annotation Tests ---
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
            
            // Base seed should be in the base section
            expect(result.annotation).toContain("ui.option.seed: 100");
            // All seeds should be in the "All Samplers" section
            expect(result.annotation).toContain("[All Samplers]");
            expect(result.annotation).toContain("ui.option.seed: 100, 200");
        });

        it('should handle paths in checkpoint names (Windows/Linux)', () => {
            const metaWin = { ...mockMeta, checkpoint: "C:\\models\\win_model.safetensors" };
            const resWin = processMetadata(metaWin, { checkpoint: true }, mockT);
            expect(resWin.tags.has("win_model")).toBe(true);

            const metaLin = { ...mockMeta, checkpoint: "/mnt/models/lin_model.safetensors" };
            const resLin = processMetadata(metaLin, { checkpoint: true }, mockT);
            expect(resLin.tags.has("lin_model")).toBe(true);
        });

        it('should include [Warning] message when fallback occurs', () => {
            const metaFallback = { ...mockMeta, sampler_fallback: true };
            const result = processMetadata(metaFallback, { checkpoint: true }, mockT);
            expect(result.annotation).toContain("[Warning] log.caution.sampler_fallback");
        });
    });

    // --- 3. Utility Tests ---
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
