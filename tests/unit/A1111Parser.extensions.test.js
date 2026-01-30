import { describe, it, expect } from 'vitest';
import A1111Parser from '../../js/metadata-parser/parsers/A1111Parser.js';

describe('A1111Parser - Extensions Support', () => {
  const parser = new A1111Parser();

  describe('ADetailer parameters', () => {
    it('should parse ADetailer parameters from Civitai-generated images', () => {
      const rawChunks = {
        parameters: `positive prompt
Negative prompt: negative prompt
Steps: 60, Sampler: DPM++ 3M SDE, CFG scale: 7, Seed: 123456, Size: 512x512, Model: test_model, ADetailer model: face_yolov9c.pt, ADetailer prompt: "detailed face", ADetailer confidence: 0.3, ADetailer steps: 24`
      };

      const result = parser.parse(rawChunks);

      expect(result).toBeDefined();
      expect(result.format).toBe('a1111');
      expect(result.adetailer).toBeDefined();
      expect(result.adetailer.model).toBe('face_yolov9c.pt');
      expect(result.adetailer.prompt).toBe('detailed face');
      expect(result.adetailer.confidence).toBe(0.3);
      expect(result.adetailer.steps).toBe(24);
    });

    it('should handle multiple ADetailer parameters with complex values', () => {
      const rawChunks = {
        parameters: `test prompt
Negative prompt: test negative
Steps: 20, ADetailer use separate steps: True, ADetailer CFG scale: 2.0, ADetailer use separate checkpoint: True, ADetailer checkpoint: model_name [hash123]`
      };

      const result = parser.parse(rawChunks);

      expect(result.adetailer).toBeDefined();
      expect(result.adetailer['use separate steps']).toBe(true);
      expect(result.adetailer['CFG scale']).toBe(2.0);
      expect(result.adetailer['use separate checkpoint']).toBe(true);
      expect(result.adetailer.checkpoint).toBe('model_name [hash123]');
    });
  });

  describe('Lora hashes', () => {
    it('should parse Lora hashes parameter', () => {
      const rawChunks = {
        parameters: `test prompt
Steps: 20, Lora hashes: "Smooth Pony Booster: ad1599fe9152, JADE-XSTAR-XL-FINAL: 0790afc4176e"`
      };

      const result = parser.parse(rawChunks);

      expect(result.lora_hashes).toBeDefined();
      expect(result.lora_hashes['Smooth Pony Booster']).toBe('ad1599fe9152');
      expect(result.lora_hashes['JADE-XSTAR-XL-FINAL']).toBe('0790afc4176e');
    });

    it('should handle single Lora hash', () => {
      const rawChunks = {
        parameters: `test prompt
Steps: 20, Lora hashes: "test_lora: abc123def456"`
      };

      const result = parser.parse(rawChunks);

      expect(result.lora_hashes).toBeDefined();
      expect(result.lora_hashes.test_lora).toBe('abc123def456');
    });
  });

  describe('Textual Inversion (TI)', () => {
    it('should parse TI parameter', () => {
      const rawChunks = {
        parameters: `test prompt
Steps: 20, TI: "SmoothQualityPony, SmoothQualityPony"`
      };

      const result = parser.parse(rawChunks);

      expect(result.textual_inversion).toBe('SmoothQualityPony, SmoothQualityPony');
    });
  });

  describe('NGMS parameters', () => {
    it('should parse NGMS parameters', () => {
      const rawChunks = {
        parameters: `test prompt
Steps: 20, NGMS: 3.0, NGMS all steps: True`
      };

      const result = parser.parse(rawChunks);

      expect(result.ngms).toBe(3.0);
      expect(result.ngms_all_steps).toBe(true);
    });

    it('should handle NGMS all steps as False', () => {
      const rawChunks = {
        parameters: `test prompt
Steps: 20, NGMS: 2.5, NGMS all steps: False`
      };

      const result = parser.parse(rawChunks);

      expect(result.ngms).toBe(2.5);
      expect(result.ngms_all_steps).toBe(false);
    });
  });

  describe('Model hash parameter', () => {
    it('should parse Model hash separately from Model', () => {
      const rawChunks = {
        parameters: `test prompt
Steps: 20, Model: test_model, Model hash: abc123def456`
      };

      const result = parser.parse(rawChunks);

      expect(result.checkpoint).toBe('test_model');
      expect(result.model_hash).toBe('abc123def456');
    });
  });

  describe('Quoted values handling', () => {
    it('should handle quoted values with commas inside', () => {
      const rawChunks = {
        parameters: `test prompt
Steps: 20, ADetailer prompt: "face, eyes, detailed", Seed: 123456`
      };

      const result = parser.parse(rawChunks);

      expect(result.adetailer).toBeDefined();
      expect(result.adetailer.prompt).toBe('face, eyes, detailed');
      expect(result.seed).toBe(123456);
    });

    it('should handle single-quoted values', () => {
      const rawChunks = {
        parameters: `test prompt
Steps: 20, ADetailer prompt: 'test value', Seed: 123456`
      };

      const result = parser.parse(rawChunks);

      expect(result.adetailer.prompt).toBe('test value');
    });
  });

  describe('Complete Civitai example', () => {
    it('should parse complete Civitai-generated metadata', () => {
      const rawChunks = {
        parameters: `SmoothQualityPony,
<lora:Smooth Pony Booster:1>,
<lora:JADE-XSTAR-XL-FINAL:1>, J4D3
Negative prompt: SmoothNegativePony-neg,
score_6, score_5, score_4
Steps: 60, Sampler: DPM++ 3M SDE, Schedule type: Karras, CFG scale: 7, Seed: 1736401068, Size: 896x1152, Model hash: 34d8e4c691, Model: smoothMixOldVerNoobai_ponyV3, Clip skip: 2, ADetailer model: face_yolov9c.pt, ADetailer prompt: "detailed face", ADetailer confidence: 0.3, ADetailer steps: 24, ADetailer CFG scale: 2.0, ADetailer version: 25.3.0, Lora hashes: "Smooth Pony Booster: ad1599fe9152, JADE-XSTAR-XL-FINAL: 0790afc4176e", TI: "SmoothQualityPony, SmoothQualityPony", NGMS: 3.0, NGMS all steps: True, Version: f2.0.1v1.10.1-previous-669-gdfdcbab6`
      };

      const result = parser.parse(rawChunks);

      // Basic parameters
      expect(result.format).toBe('a1111');
      expect(result.steps).toBe(60);
      expect(result.sampler).toBe('DPM++ 3M SDE');
      expect(result.schedule_type).toBe('Karras');
      expect(result.cfg).toBe(7);
      expect(result.seed).toBe(1736401068);
      expect(result.size).toBe('896x1152');
      expect(result.checkpoint).toBe('smoothMixOldVerNoobai_ponyV3');
      expect(result.model_hash).toBe('34d8e4c691');
      expect(result.clip_skip).toBe(2);
      expect(result.version).toBe('f2.0.1v1.10.1-previous-669-gdfdcbab6');

      // ADetailer
      expect(result.adetailer).toBeDefined();
      expect(result.adetailer.model).toBe('face_yolov9c.pt');
      expect(result.adetailer.prompt).toBe('detailed face');
      expect(result.adetailer.confidence).toBe(0.3);
      expect(result.adetailer.steps).toBe(24);
      expect(result.adetailer['CFG scale']).toBe(2.0);
      expect(result.adetailer.version).toBe('25.3.0');

      // Lora hashes
      expect(result.lora_hashes).toBeDefined();
      expect(result.lora_hashes['Smooth Pony Booster']).toBe('ad1599fe9152');
      expect(result.lora_hashes['JADE-XSTAR-XL-FINAL']).toBe('0790afc4176e');

      // TI and NGMS
      expect(result.textual_inversion).toBe('SmoothQualityPony, SmoothQualityPony');
      expect(result.ngms).toBe(3.0);
      expect(result.ngms_all_steps).toBe(true);

      // Prompts
      expect(result.positive).toContain('SmoothQualityPony');
      expect(result.positive).toContain('<lora:Smooth Pony Booster:1>');
      expect(result.negative).toContain('SmoothNegativePony-neg');
    });
  });
});
