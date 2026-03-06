// js/metadata-processor/MetadataProcessor.js
// Orchestrates metadata processing
(function(global) {
  'use strict';

// Load dependencies
let TagGenerator, AnnotationBuilder, MetadataService;

if (typeof window !== 'undefined') {
  // Browser environment
  TagGenerator = window.TagGenerator;
  AnnotationBuilder = window.AnnotationBuilder;
  MetadataService = window.MetadataService;
} else if (typeof require !== 'undefined') {
  // Node.js environment
  TagGenerator = require('./TagGenerator');
  AnnotationBuilder = require('./AnnotationBuilder');
  MetadataService = require('../metadata-parser/integration/MetadataService');
}

/**
 * MetadataProcessor
 * 
 * Orchestrates the complete metadata processing pipeline:
 * 1. Extract metadata from image buffer (optional)
 * 2. Generate tags from metadata
 * 3. Build annotation text from metadata
 * 
 * This class coordinates TagGenerator and AnnotationBuilder to provide
 * a unified interface for processing metadata.
 */
class MetadataProcessor {
  /**
   * Process metadata and generate tags and annotation
   * 
   * This method can work in two modes:
   * 1. With parsed metadata object (for testing and backward compatibility)
   * 2. With buffer and mimeType (uses MetadataService for parsing)
   * 
   * @param {Object|null} parsedMeta - Pre-parsed metadata object (if available)
   * @param {Object} settings - User settings for which metadata to include
   * @param {Function} t - Translation function
   * @param {Uint8Array} [buffer] - Image buffer for MetadataService parsing
   * @param {string} [mimeType] - Image MIME type for MetadataService parsing
   * @returns {Object} Processed metadata with tags, categories, annotation, and metadata
   * 
   * @example
   * const processor = new MetadataProcessor();
   * const result = processor.process(null, settings, t, buffer, 'image/png');
   * // Returns: { tags: Set, cats: Object, annotation: string, sampler_fallback: boolean, stepCount: number }
   */
  static process(parsedMeta, settings, t, buffer = null, mimeType = null) {
    let meta = {};
    
    // Debug logging helper
    const debugLog = (msg, level = 'info') => {
      if (typeof window !== 'undefined' && window.isDebugMode && window.isDebugMode()) {
        const levelPrefix = `[${level.toUpperCase()}]`;
        const fullMsg = `[MetadataProcessor] ${msg}`;
        switch(level) {
          case 'error':
            console.error(`${levelPrefix} ${fullMsg}`);
            break;
          case 'warn':
            console.warn(`${levelPrefix} ${fullMsg}`);
            break;
          default:
            console.log(`${levelPrefix} ${fullMsg}`);
        }
      }
    };
    
    debugLog('Starting metadata processing');
    debugLog(`Input: parsedMeta=${!!parsedMeta}, buffer=${!!buffer}, mimeType=${mimeType}`);
    
    // If parsedMeta is provided, use it directly (for testing/backward compatibility)
    if (parsedMeta && typeof parsedMeta === 'object') {
      meta = parsedMeta;
      debugLog(`Using pre-parsed metadata: format=${meta.format}`);
    }
    // Otherwise, use MetadataService if buffer and mimeType are provided
    else if (buffer && mimeType && MetadataService) {
      try {
        debugLog('Extracting metadata using MetadataService');
        const service = new MetadataService();
        const parsed = service.extractPreferredMetadata(buffer, mimeType, 'comfyui');
        if (parsed) {
          meta = parsed;
          debugLog(`Metadata extracted: format=${meta.format}, checkpoint=${meta.checkpoint}`);
        } else {
          debugLog('No metadata found', 'warn');
        }
      } catch (e) {
        debugLog(`MetadataService parsing failed: ${e.message}`, 'error');
        console.error('[MetadataProcessor] MetadataService parsing failed:', e);
      }
    }
    
    // Generate tags
    debugLog('Generating tags');
    const tagResult = TagGenerator.generate(meta, settings);
    debugLog(`Generated ${tagResult.tags.size} tags`);
    
    // Build annotation
    debugLog('Building annotation');
    const annotation = AnnotationBuilder.build(meta, settings, t);
    debugLog(`Annotation length: ${annotation.length} characters`);
    
    // Calculate step count
    const stepCount = meta.generationSteps && meta.generationSteps.length > 0 
      ? meta.generationSteps.length 
      : (meta.extra_samplers && meta.extra_samplers.length > 0 ? meta.extra_samplers.length : 1);
    
    debugLog(`Processing complete: stepCount=${stepCount}, sampler_fallback=${meta.sampler_fallback}`);
    
    return {
      tags: tagResult.tags,
      cats: tagResult.cats,
      annotation,
      sampler_fallback: meta.sampler_fallback,
      stepCount
    };
  }
}

// Export for both browser and Node.js environments
if (typeof window !== 'undefined') {
  window.MetadataProcessor = MetadataProcessor;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MetadataProcessor;
}

})(typeof window !== 'undefined' ? window : global);
