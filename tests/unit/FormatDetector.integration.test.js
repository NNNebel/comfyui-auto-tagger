import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import ImageMetadataReader from '../../js/metadata-parser/binary-extraction/ImageMetadataReader.js';
import FormatDetector from '../../js/metadata-parser/binary-extraction/FormatDetector.js';

describe('FormatDetector Integration Tests', () => {
  describe('Real sample file tests', () => {
    it('should detect formats from real PNG sample if available', () => {
      const samplePath = join(process.cwd(), 'tests', 'fixtures', 'comfyui_simple.png');
      
      if (existsSync(samplePath)) {
        const buffer = new Uint8Array(readFileSync(samplePath));
        const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
        const formats = FormatDetector.detectFormats(rawChunks);
        
        console.log('Detected formats:', formats);
        console.log('Raw chunk keys:', Object.keys(rawChunks));
        
        // The result should be an array
        expect(Array.isArray(formats)).toBe(true);
        
        // If metadata was extracted, verify format detection
        if (Object.keys(rawChunks).length > 0) {
          // Should detect at least one format
          expect(formats.length).toBeGreaterThan(0);
          
          // Log what was detected for debugging
          if (formats.includes('comfyui')) {
            console.log('✓ ComfyUI format detected');
            expect(rawChunks.workflow || rawChunks.prompt).toBeDefined();
          }
          
          if (formats.includes('a1111')) {
            console.log('✓ A1111 format detected');
            expect(rawChunks.parameters).toBeDefined();
            expect(typeof rawChunks.parameters).toBe('string');
          }
        } else {
          console.log('No metadata found in sample file');
        }
      } else {
        console.log('Sample PNG file not found, skipping real file test');
      }
    });

    it('should correctly identify ComfyUI metadata structure', () => {
      const samplePath = join(process.cwd(), 'tests', 'fixtures', 'comfyui_simple.png');
      
      if (existsSync(samplePath)) {
        const buffer = new Uint8Array(readFileSync(samplePath));
        const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
        const formats = FormatDetector.detectFormats(rawChunks);
        
        if (formats.includes('comfyui')) {
          // Verify ComfyUI metadata structure
          const hasWorkflow = rawChunks.workflow && typeof rawChunks.workflow === 'object';
          const hasPrompt = rawChunks.prompt && typeof rawChunks.prompt === 'object';
          
          expect(hasWorkflow || hasPrompt).toBe(true);
          
          if (hasWorkflow) {
            console.log('Workflow structure:', Object.keys(rawChunks.workflow));
          }
          if (hasPrompt) {
            console.log('Prompt structure:', Object.keys(rawChunks.prompt));
          }
        }
      } else {
        console.log('Sample PNG file not found, skipping test');
      }
    });

    it('should handle multiple format detection correctly', () => {
      // Create mock raw chunks with both formats
      const rawChunks = {
        workflow: { nodes: [], connections: [] },
        prompt: { '1': { class_type: 'KSampler' } },
        parameters: 'cat, detailed\nNegative prompt: ugly\nSteps: 20, Sampler: Euler a'
      };
      
      const formats = FormatDetector.detectFormats(rawChunks);
      
      expect(formats).toContain('comfyui');
      expect(formats).toContain('a1111');
      expect(formats.length).toBe(2);
    });
  });
});
