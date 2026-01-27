import { describe, it, expect } from 'vitest';
import FormatDetector from '../../js/metadata-parser/binary-extraction/FormatDetector.js';

describe('FormatDetector', () => {
  describe('detectFormats', () => {
    it('should detect ComfyUI format from workflow JSON', () => {
      const rawChunks = { 
        workflow: { nodes: [], connections: [] } 
      };
      const formats = FormatDetector.detectFormats(rawChunks);
      expect(formats).toContain('comfyui');
    });

    it('should detect ComfyUI format from prompt JSON', () => {
      const rawChunks = { 
        prompt: { '1': { class_type: 'KSampler' } } 
      };
      const formats = FormatDetector.detectFormats(rawChunks);
      expect(formats).toContain('comfyui');
    });

    it('should detect ComfyUI format when both workflow and prompt exist', () => {
      const rawChunks = { 
        workflow: { nodes: [] },
        prompt: { '1': { class_type: 'KSampler' } }
      };
      const formats = FormatDetector.detectFormats(rawChunks);
      expect(formats).toContain('comfyui');
      expect(formats.filter(f => f === 'comfyui').length).toBe(1); // Should only appear once
    });

    it('should detect A1111 format from parameters string', () => {
      const rawChunks = { 
        parameters: 'cat\nNegative prompt: ugly\nSteps: 20, Sampler: Euler a' 
      };
      const formats = FormatDetector.detectFormats(rawChunks);
      expect(formats).toContain('a1111');
    });

    it('should detect both ComfyUI and A1111 formats when both are present', () => {
      const rawChunks = { 
        workflow: { nodes: [] },
        parameters: 'cat\nNegative prompt: ugly\nSteps: 20' 
      };
      const formats = FormatDetector.detectFormats(rawChunks);
      expect(formats).toContain('comfyui');
      expect(formats).toContain('a1111');
      expect(formats.length).toBe(2);
    });

    it('should return empty array for no metadata', () => {
      const rawChunks = {};
      const formats = FormatDetector.detectFormats(rawChunks);
      expect(formats).toEqual([]);
    });

    it('should return empty array for unrecognized metadata', () => {
      const rawChunks = { 
        someOtherField: 'value',
        anotherField: { data: 'test' }
      };
      const formats = FormatDetector.detectFormats(rawChunks);
      expect(formats).toEqual([]);
    });

    it('should not detect ComfyUI if workflow is a string', () => {
      const rawChunks = { 
        workflow: 'not an object' 
      };
      const formats = FormatDetector.detectFormats(rawChunks);
      expect(formats).not.toContain('comfyui');
    });

    it('should not detect ComfyUI if prompt is a string', () => {
      const rawChunks = { 
        prompt: 'not an object' 
      };
      const formats = FormatDetector.detectFormats(rawChunks);
      expect(formats).not.toContain('comfyui');
    });

    it('should not detect A1111 if parameters is an object', () => {
      const rawChunks = { 
        parameters: { not: 'a string' } 
      };
      const formats = FormatDetector.detectFormats(rawChunks);
      expect(formats).not.toContain('a1111');
    });

    it('should not detect A1111 if parameters is null', () => {
      const rawChunks = { 
        parameters: null 
      };
      const formats = FormatDetector.detectFormats(rawChunks);
      expect(formats).not.toContain('a1111');
    });

    it('should not detect ComfyUI if workflow is null', () => {
      const rawChunks = { 
        workflow: null 
      };
      const formats = FormatDetector.detectFormats(rawChunks);
      expect(formats).not.toContain('comfyui');
    });

    it('should not detect ComfyUI if prompt is null', () => {
      const rawChunks = { 
        prompt: null 
      };
      const formats = FormatDetector.detectFormats(rawChunks);
      expect(formats).not.toContain('comfyui');
    });

    it('should not detect A1111 for empty string parameters', () => {
      const rawChunks = { 
        parameters: '' 
      };
      const formats = FormatDetector.detectFormats(rawChunks);
      // Empty string should not be detected as valid A1111 metadata
      expect(formats).not.toContain('a1111');
    });

    it('should handle empty object workflow', () => {
      const rawChunks = { 
        workflow: {} 
      };
      const formats = FormatDetector.detectFormats(rawChunks);
      expect(formats).toContain('comfyui');
    });

    it('should handle empty object prompt', () => {
      const rawChunks = { 
        prompt: {} 
      };
      const formats = FormatDetector.detectFormats(rawChunks);
      expect(formats).toContain('comfyui');
    });

    it('should handle array values correctly', () => {
      const rawChunks = { 
        workflow: [],
        parameters: ['not', 'a', 'string']
      };
      const formats = FormatDetector.detectFormats(rawChunks);
      // Arrays are objects in JavaScript, so workflow should be detected
      expect(formats).toContain('comfyui');
      // But parameters should not be detected as it's not a string
      expect(formats).not.toContain('a1111');
    });
  });
});
