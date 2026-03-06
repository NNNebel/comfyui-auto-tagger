// js/metadata-processor/TagGenerator.js
// Tag generation from parsed metadata
(function(global) {
  'use strict';

  // Get dependencies for both environments
  var PromptTokenizer;
  
  if (typeof window !== 'undefined') {
    // Browser environment
    PromptTokenizer = window.PromptTokenizer;
  } else if (typeof require !== 'undefined') {
    // Node.js environment (testing)
    PromptTokenizer = require('../metadata-parser/prompt/PromptTokenizer');
  }

/**
 * TagGenerator
 * 
 * Generates Eagle tags from parsed metadata based on user settings.
 * Handles checkpoint, LoRA, prompts, and parameter tags.
 */
class TagGenerator {
  /**
   * Clean and split prompt text into individual tags
   * @private
   * @param {string} text - Prompt text to clean
   * @param {string} [prefix=''] - Prefix to add to each tag
   * @returns {string[]} Array of cleaned tags
   */
  static cleanPrompt(text, prefix = '') {
    if (!text || typeof text !== 'string') return [];
    
    // Split by newline first
    const lines = text.split(/\n/);
    const allTags = new Set();
    
    // Use PromptTokenizer for better parsing
    const tokenizer = new PromptTokenizer();
    
    for (const line of lines) {
      const tokens = tokenizer.tokenize(line);
      
      // Extract tags (plain text and weighted text, no special tags)
      const tags = tokenizer.extractTags(tokens, {
        includeWeighted: true,  // Include weighted text as tags
        includeSpecialTags: false,
        prefix: prefix
      });
      
      tags.forEach(tag => allTags.add(tag));
    }
    
    return [...allTags];
  }

  /**
   * Extract base name from file path
   * @private
   * @param {string} path - File path
   * @returns {string} Base name without extension
   */
  static getBaseName(path) {
    if (!path) return '';
    return path.split(/[/\\]/).pop().replace(/\.[^/\\.]+$/, '');
  }

  /**
   * Generate tags from parsed metadata
   * @param {Object} metadata - Parsed metadata object
   * @param {Object} settings - User settings for which metadata to include
   * @returns {Object} Object with tags and categorized tags
   * 
   * @example
   * const generator = new TagGenerator();
   * const result = generator.generate(metadata, {
   *   checkpoint: true,
   *   lora: true,
   *   positive: true,
   *   negative: true,
   *   seed: true,
   *   steps: true,
   *   cfg: true,
   *   sampler: true,
   *   includeAllSamplers: false  // Optional: include all samplers or first only
   * });
   * // Returns: { tags: Set, cats: { cp: Set, lora: Set, pos: Set, neg: Set, param: Set } }
   */
  static generate(metadata, settings) {
    // Debug logging helper
    const debugLog = (msg, level = 'info') => {
      if (typeof window !== 'undefined' && window.isDebugMode && window.isDebugMode()) {
        const levelPrefix = `[${level.toUpperCase()}]`;
        const fullMsg = `[TagGenerator] ${msg}`;
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

    // Debug log to check settings
    if (typeof console !== 'undefined' && settings.debug) {
      console.log('[TagGenerator] Settings:', settings);
      console.log('[TagGenerator] includeAllSamplers:', settings.includeAllSamplers);
    }
    
    debugLog('Starting tag generation');
    debugLog(`Settings: ${JSON.stringify(settings)}`);
    debugLog(`Metadata format: ${metadata.format || 'unknown'}, checkpoint: ${metadata.checkpoint || 'none'}`);
    
    const cats = {
      cp: new Set(),
      lora: new Set(),
      pos: new Set(),
      neg: new Set(),
      param: new Set()
    };

    // Extract checkpoint and LoRA tags
    if (metadata.checkpoint) {
      cats.cp.add(this.getBaseName(metadata.checkpoint).toLowerCase());
      debugLog(`Added checkpoint: ${metadata.checkpoint}`);
    }
    if (metadata.loras) {
      metadata.loras.forEach(l => cats.lora.add(this.getBaseName(l).toLowerCase()));
      debugLog(`Added ${metadata.loras.length} LoRAs`);
    }

    // Extract prompt tags
    if (metadata.generationSteps && metadata.generationSteps.length > 0) {
      debugLog(`Processing ${metadata.generationSteps.length} generation steps for prompts`);
      metadata.generationSteps.forEach(step => {
        if (step.positive) {
          this.cleanPrompt(step.positive).forEach(tag => cats.pos.add(tag));
        }
        if (step.negative) {
          this.cleanPrompt(step.negative, 'neg:').forEach(tag => cats.neg.add(tag));
        }
      });
    } else {
      debugLog('Using fallback format for prompts');
      // Fallback to old format
      if (metadata.positive) {
        this.cleanPrompt(metadata.positive).forEach(tag => cats.pos.add(tag));
      }
      if (metadata.negative) {
        this.cleanPrompt(metadata.negative, 'neg:').forEach(tag => cats.neg.add(tag));
      }
    }
    debugLog(`Prompt tags: positive=${cats.pos.size}, negative=${cats.neg.size}`);

    // Extract parameter tags
    // Check if user wants all samplers or first only (default: first only)
    const includeAllSamplers = settings.includeAllSamplers === true;
    debugLog(`includeAllSamplers: ${includeAllSamplers}`);
    
    if (metadata.generationSteps && metadata.generationSteps.length > 0) {
      // Use generationSteps for multi-sampler workflows
      const stepsToProcess = includeAllSamplers 
        ? metadata.generationSteps 
        : [metadata.generationSteps[0]]; // First sampler only
      
      debugLog(`Processing ${stepsToProcess.length} of ${metadata.generationSteps.length} generation steps for parameters`);
      
      stepsToProcess.forEach(step => {
        if (step.seed !== undefined) {
          cats.param.add(`seed:${step.seed}`);
        }
        if (step.steps !== undefined) {
          cats.param.add(`steps:${step.steps}`);
        }
        if (step.cfg !== undefined) {
          cats.param.add(`cfg:${Number(step.cfg).toFixed(2)}`);
        }
        if (step.sampler) {
          cats.param.add(`sampler:${String(step.sampler).toLowerCase()}`);
        }
      });
    } else {
      // Fallback to base sampler for simple workflows
      if (metadata.seed !== undefined) {
        cats.param.add(`seed:${metadata.seed}`);
      }
      if (metadata.steps !== undefined) {
        cats.param.add(`steps:${metadata.steps}`);
      }
      if (metadata.cfg !== undefined) {
        cats.param.add(`cfg:${Number(metadata.cfg).toFixed(2)}`);
      }
      if (metadata.sampler) {
        cats.param.add(`sampler:${String(metadata.sampler).toLowerCase()}`);
      }
    }

    // Filter tags based on settings
    const allTags = new Set();
    if (settings.checkpoint) cats.cp.forEach(t => allTags.add(t));
    if (settings.lora) cats.lora.forEach(t => allTags.add(t));
    if (settings.positive) cats.pos.forEach(t => allTags.add(t));
    if (settings.negative) cats.neg.forEach(t => allTags.add(t));

    cats.param.forEach(t => {
      if (t.startsWith('seed:') && settings.seed) allTags.add(t);
      if (t.startsWith('steps:') && settings.steps) allTags.add(t);
      if (t.startsWith('cfg:') && settings.cfg) allTags.add(t);
      if (t.startsWith('sampler:') && settings.sampler) allTags.add(t);
    });

    return { tags: allTags, cats };
  }
}

// Export for both browser and Node.js environments
if (typeof window !== 'undefined') {
  window.TagGenerator = TagGenerator;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TagGenerator;
}

})(typeof window !== 'undefined' ? window : global);
