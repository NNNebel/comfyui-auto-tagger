import { describe, it, expect } from 'vitest';
import A1111Parser from '../../js/metadata-parser/parsers/A1111Parser.js';

describe('A1111Parser', () => {
  describe('getFormatName', () => {
    it('should return "a1111"', () => {
      const parser = new A1111Parser();
      expect(parser.getFormatName()).toBe('a1111');
    });
  });

  describe('parse', () => {
    it('should return null if parameters field is missing', () => {
      const parser = new A1111Parser();
      const result = parser.parse({});
      expect(result).toBeNull();
    });

    it('should return null if parameters is not a string', () => {
      const parser = new A1111Parser();
      const result = parser.parse({ parameters: 123 });
      expect(result).toBeNull();
    });

    it('should extract positive prompt from simple parameters', () => {
      const parser = new A1111Parser();
      const parameters = 'cat, detailed, masterpiece';
      const result = parser.parse({ parameters });
      
      expect(result).toBeDefined();
      expect(result.format).toBe('a1111');
      expect(result.positive).toBe('cat, detailed, masterpiece');
    });

    it('should extract positive and negative prompts', () => {
      const parser = new A1111Parser();
      const parameters = `cat, detailed, masterpiece
Negative prompt: ugly, blurry`;
      const result = parser.parse({ parameters });
      
      expect(result).toBeDefined();
      expect(result.format).toBe('a1111');
      expect(result.positive).toBe('cat, detailed, masterpiece');
      expect(result.negative).toBe('ugly, blurry');
    });

    it('should extract all parameters from a complete A1111 string', () => {
      const parser = new A1111Parser();
      const parameters = `cat, detailed, masterpiece
Negative prompt: ugly, blurry
Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123456, Size: 512x512, Model: model_name`;
      const result = parser.parse({ parameters });
      
      expect(result).toBeDefined();
      expect(result.format).toBe('a1111');
      expect(result.positive).toBe('cat, detailed, masterpiece');
      expect(result.negative).toBe('ugly, blurry');
      expect(result.steps).toBe(20);
      expect(result.sampler).toBe('Euler a');
      expect(result.cfg).toBe(7);
      expect(result.seed).toBe(123456);
      expect(result.checkpoint).toBe('model_name');
    });

    it('should handle multi-line positive prompts', () => {
      const parser = new A1111Parser();
      const parameters = `cat, detailed, masterpiece
high quality, 8k
Negative prompt: ugly, blurry
Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123456`;
      const result = parser.parse({ parameters });
      
      expect(result).toBeDefined();
      expect(result.positive).toBe('cat, detailed, masterpiece\nhigh quality, 8k');
      expect(result.negative).toBe('ugly, blurry');
    });

    it('should handle multi-line negative prompts', () => {
      const parser = new A1111Parser();
      const parameters = `cat, detailed, masterpiece
Negative prompt: ugly, blurry
low quality, bad anatomy
Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123456`;
      const result = parser.parse({ parameters });
      
      expect(result).toBeDefined();
      expect(result.positive).toBe('cat, detailed, masterpiece');
      expect(result.negative).toBe('ugly, blurry\nlow quality, bad anatomy');
    });

    it('should handle parameters without negative prompt', () => {
      const parser = new A1111Parser();
      const parameters = `cat, detailed, masterpiece
Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123456`;
      const result = parser.parse({ parameters });
      
      expect(result).toBeDefined();
      expect(result.positive).toBe('cat, detailed, masterpiece');
      expect(result.negative).toBeUndefined();
      expect(result.steps).toBe(20);
    });

    it('should use Model and ignore Model hash', () => {
      const parser = new A1111Parser();
      const parameters = `cat
Steps: 20, Model hash: abc123, Model: my_model.safetensors`;
      const result = parser.parse({ parameters });
      
      expect(result).toBeDefined();
      expect(result.checkpoint).toBe('my_model.safetensors'); // Only Model is used
    });

    it('should not set checkpoint if only Model hash is present', () => {
      const parser = new A1111Parser();
      const parameters = `cat
Steps: 20, Model hash: abc123, Sampler: Euler a`;
      const result = parser.parse({ parameters });
      
      expect(result).toBeDefined();
      expect(result.checkpoint).toBeUndefined(); // Model hash is ignored
    });

    it('should handle missing optional parameters gracefully', () => {
      const parser = new A1111Parser();
      const parameters = `cat, detailed
Negative prompt: ugly
Steps: 20`;
      const result = parser.parse({ parameters });
      
      expect(result).toBeDefined();
      expect(result.format).toBe('a1111');
      expect(result.positive).toBe('cat, detailed');
      expect(result.negative).toBe('ugly');
      expect(result.steps).toBe(20);
      expect(result.sampler).toBeUndefined();
      expect(result.cfg).toBeUndefined();
      expect(result.seed).toBeUndefined();
    });
  });

  describe('parseParameterLine', () => {
    it('should parse Steps parameter', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('Steps: 20');
      expect(result.steps).toBe(20);
    });

    it('should parse Sampler parameter', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('Sampler: Euler a');
      expect(result.sampler).toBe('Euler a');
    });

    it('should parse CFG scale parameter', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('CFG scale: 7.5');
      expect(result.cfg).toBe(7.5);
    });

    it('should parse Seed parameter', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('Seed: 123456');
      expect(result.seed).toBe(123456);
    });

    it('should parse Model parameter', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('Model: my_model.safetensors');
      expect(result.checkpoint).toBe('my_model.safetensors');
    });

    it('should parse Schedule type parameter', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('Schedule type: Exponential');
      expect(result.schedule_type).toBe('Exponential');
    });

    it('should parse Size parameter', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('Size: 768x512');
      expect(result.size).toBe('768x512');
    });

    it('should parse VAE parameter', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('VAE: kl-f8-anime2.safetensors');
      expect(result.vae).toBe('kl-f8-anime2.safetensors');
    });

    it('should parse Denoising strength parameter', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('Denoising strength: 0.3');
      expect(result.denoising_strength).toBe(0.3);
    });

    it('should parse Clip skip parameter', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('Clip skip: 2');
      expect(result.clip_skip).toBe(2);
    });

    it('should parse Hires upscale parameter', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('Hires upscale: 2');
      expect(result.hires_upscale).toBe(2);
    });

    it('should parse Hires steps parameter', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('Hires steps: 10');
      expect(result.hires_steps).toBe(10);
    });

    it('should parse Hires upscaler parameter', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('Hires upscaler: R-ESRGAN 4x+ Anime6B');
      expect(result.hires_upscaler).toBe('R-ESRGAN 4x+ Anime6B');
    });

    it('should parse Version parameter', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('Version: f1.4.0dev-v1.10.1RC-latest-1442-g634cb7e4');
      expect(result.version).toBe('f1.4.0dev-v1.10.1RC-latest-1442-g634cb7e4');
    });

    it('should parse multiple parameters separated by commas', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123456');
      
      expect(result.steps).toBe(20);
      expect(result.sampler).toBe('Euler a');
      expect(result.cfg).toBe(7);
      expect(result.seed).toBe(123456);
    });

    it('should parse all extended A1111 parameters', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine(
        'Steps: 60, Sampler: DPM++ 2M SDE, Schedule type: Exponential, CFG scale: 3, Seed: 76682904, ' +
        'Size: 768x512, Model: meinamix_v12Final, VAE: kl-f8-anime2.safetensors, ' +
        'Denoising strength: 0.3, Clip skip: 2, Hires upscale: 2, Hires steps: 10, ' +
        'Hires upscaler: R-ESRGAN 4x+ Anime6B, Version: f1.4.0'
      );
      
      expect(result.steps).toBe(60);
      expect(result.sampler).toBe('DPM++ 2M SDE');
      expect(result.schedule_type).toBe('Exponential');
      expect(result.cfg).toBe(3);
      expect(result.seed).toBe(76682904);
      expect(result.size).toBe('768x512');
      expect(result.checkpoint).toBe('meinamix_v12Final');
      expect(result.vae).toBe('kl-f8-anime2.safetensors');
      expect(result.denoising_strength).toBe(0.3);
      expect(result.clip_skip).toBe(2);
      expect(result.hires_upscale).toBe(2);
      expect(result.hires_steps).toBe(10);
      expect(result.hires_upscaler).toBe('R-ESRGAN 4x+ Anime6B');
      expect(result.version).toBe('f1.4.0');
    });

    it('should ignore parameters without colons', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('Steps: 20, InvalidParam, Sampler: Euler a');
      
      expect(result.steps).toBe(20);
      expect(result.sampler).toBe('Euler a');
    });

    it('should handle extra whitespace', () => {
      const parser = new A1111Parser();
      const result = parser.parseParameterLine('  Steps:  20  ,  Sampler:  Euler a  ');
      
      expect(result.steps).toBe(20);
      expect(result.sampler).toBe('Euler a');
    });
  });
});
