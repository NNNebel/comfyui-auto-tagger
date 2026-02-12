import { describe, bench } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const MetadataService = require('../../js/metadata-parser/integration/MetadataService.js');

describe('ComfyUI Parsing Performance Benchmarks', () => {
  const metadataService = new MetadataService();
  
  // Load sample images
  const smallWorkflow = readFileSync(join(__dirname, '../samples/comfyui_simple.png'));
  const mediumWorkflow = readFileSync(join(__dirname, '../samples/comfyui_flux.png'));
  const largeWorkflow = readFileSync(join(__dirname, '../samples/comfyui_multi.png'));
  
  describe('Parsing Time Benchmarks', () => {
    bench('Small workflow (< 10 nodes)', () => {
      metadataService.extractMetadata(smallWorkflow, 'image/png');
    });
    
    bench('Medium workflow (10-20 nodes)', () => {
      metadataService.extractMetadata(mediumWorkflow, 'image/png');
    });
    
    bench('Large workflow (> 20 nodes)', () => {
      metadataService.extractMetadata(largeWorkflow, 'image/png');
    });
  });
  
  describe('Graph Construction Benchmarks', () => {
    const ComfyUIGraph = require('../../js/metadata-parser/graph/ComfyUIGraph.js');
    const ImageMetadataReader = require('../../js/metadata-parser/binary-extraction/ImageMetadataReader.js');
    
    const smallPrompt = ImageMetadataReader.extractRawMetadata(smallWorkflow, 'image/png').prompt;
    const mediumPrompt = ImageMetadataReader.extractRawMetadata(mediumWorkflow, 'image/png').prompt;
    const largePrompt = ImageMetadataReader.extractRawMetadata(largeWorkflow, 'image/png').prompt;
    
    bench('Graph construction - small workflow', () => {
      new ComfyUIGraph(smallPrompt);
    });
    
    bench('Graph construction - medium workflow', () => {
      new ComfyUIGraph(mediumPrompt);
    });
    
    bench('Graph construction - large workflow', () => {
      new ComfyUIGraph(largePrompt);
    });
  });
  
  describe('Sampler Analysis Benchmarks', () => {
    const ComfyUIGraph = require('../../js/metadata-parser/graph/ComfyUIGraph.js');
    const ComfyUISamplerAnalyzer = require('../../js/metadata-parser/graph/ComfyUISamplerAnalyzer.js');
    const ImageMetadataReader = require('../../js/metadata-parser/binary-extraction/ImageMetadataReader.js');
    
    const smallPrompt = ImageMetadataReader.extractRawMetadata(smallWorkflow, 'image/png').prompt;
    const mediumPrompt = ImageMetadataReader.extractRawMetadata(mediumWorkflow, 'image/png').prompt;
    const largePrompt = ImageMetadataReader.extractRawMetadata(largeWorkflow, 'image/png').prompt;
    
    const smallGraph = new ComfyUIGraph(smallPrompt);
    const mediumGraph = new ComfyUIGraph(mediumPrompt);
    const largeGraph = new ComfyUIGraph(largePrompt);
    
    bench('Sampler analysis - small workflow', () => {
      const analyzer = new ComfyUISamplerAnalyzer(smallGraph);
      analyzer.findBaseSampler();
      analyzer.extractAllSamplersMetadata();
    });
    
    bench('Sampler analysis - medium workflow', () => {
      const analyzer = new ComfyUISamplerAnalyzer(mediumGraph);
      analyzer.findBaseSampler();
      analyzer.extractAllSamplersMetadata();
    });
    
    bench('Sampler analysis - large workflow', () => {
      const analyzer = new ComfyUISamplerAnalyzer(largeGraph);
      analyzer.findBaseSampler();
      analyzer.extractAllSamplersMetadata();
    });
  });
  
  describe('Memory Usage Tests', () => {
    bench('Memory - parse small workflow', () => {
      const result = metadataService.extractMetadata(smallWorkflow, 'image/png');
      // Force result to be used to prevent optimization
      if (!result) throw new Error('No result');
    });
    
    bench('Memory - parse medium workflow', () => {
      const result = metadataService.extractMetadata(mediumWorkflow, 'image/png');
      if (!result) throw new Error('No result');
    });
    
    bench('Memory - parse large workflow', () => {
      const result = metadataService.extractMetadata(largeWorkflow, 'image/png');
      if (!result) throw new Error('No result');
    });
  });
});
