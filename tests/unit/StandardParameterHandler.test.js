import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const StandardParameterHandler = require('../../js/metadata-parser/parameters/StandardParameterHandler.js');

describe('StandardParameterHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new StandardParameterHandler();
  });

  describe('canHandle', () => {
    it('should handle standard parameters', () => {
      expect(handler.canHandle('Steps')).toBe(true);
      expect(handler.canHandle('Sampler')).toBe(true);
      expect(handler.canHandle('CFG scale')).toBe(true);
      expect(handler.canHandle('Seed')).toBe(true);
      expect(handler.canHandle('Model')).toBe(true);
      expect(handler.canHandle('Hires upscale')).toBe(true);
      expect(handler.canHandle('Hires steps')).toBe(true);
      expect(handler.canHandle('Hires upscaler')).toBe(true);
      expect(handler.canHandle('TI')).toBe(true);
      expect(handler.canHandle('NGMS')).toBe(true);
      expect(handler.canHandle('NGMS all steps')).toBe(true);
    });

    it('should not handle non-standard parameters', () => {
      expect(handler.canHandle('Unknown')).toBe(false);
      expect(handler.canHandle('ADetailer model')).toBe(false);
      expect(handler.canHandle('Lora hashes')).toBe(false);
    });
  });

  describe('handle', () => {
    it('should parse integer parameters', () => {
      expect(handler.handle('Steps', '20', {})).toEqual({ steps: 20 });
      expect(handler.handle('Seed', '123456', {})).toEqual({ seed: 123456 });
      expect(handler.handle('Clip skip', '2', {})).toEqual({ clip_skip: 2 });
      expect(handler.handle('Hires steps', '10', {})).toEqual({ hires_steps: 10 });
    });

    it('should parse float parameters', () => {
      expect(handler.handle('CFG scale', '7.5', {})).toEqual({ cfg: 7.5 });
      expect(handler.handle('Denoising strength', '0.75', {})).toEqual({ denoising_strength: 0.75 });
      expect(handler.handle('Hires upscale', '2', {})).toEqual({ hires_upscale: 2 });
    });

    it('should parse string parameters', () => {
      expect(handler.handle('Sampler', 'Euler a', {})).toEqual({ sampler: 'Euler a' });
      expect(handler.handle('Model', 'model_name.safetensors', {})).toEqual({ checkpoint: 'model_name.safetensors' });
      expect(handler.handle('Size', '512x512', {})).toEqual({ size: '512x512' });
      expect(handler.handle('Hires upscaler', 'R-ESRGAN 4x+', {})).toEqual({ hires_upscaler: 'R-ESRGAN 4x+' });
      expect(handler.handle('TI', 'embedding1, embedding2', {})).toEqual({ textual_inversion: 'embedding1, embedding2' });
    });

    it('should parse boolean parameters', () => {
      expect(handler.handle('NGMS all steps', 'True', {})).toEqual({ ngms_all_steps: true });
      expect(handler.handle('NGMS all steps', 'False', {})).toEqual({ ngms_all_steps: false });
    });

    it('should handle Model parameter as checkpoint', () => {
      const result = handler.handle('Model', 'my_model', {});
      expect(result).toEqual({ checkpoint: 'my_model' });
    });

    it('should return empty object for unknown key', () => {
      expect(handler.handle('Unknown', 'value', {})).toEqual({});
    });
  });

  describe('getPriority', () => {
    it('should return high priority', () => {
      expect(handler.getPriority()).toBe(10);
    });
  });
});
