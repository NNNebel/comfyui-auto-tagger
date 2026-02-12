// js/metadata-processor/TagGenerator.js
// Tag generation from parsed metadata
(function(global) {
  'use strict';

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
    const tags = new Set();
    text.split(/[\n,]/).forEach(t => {
      const v = t.trim();
      if (v && !v.startsWith('(') && !v.endsWith(')')) {
        tags.add((prefix + v).toLowerCase());
      } else if (v) {
        tags.add((prefix + v.replace(/[()]/g, '')).toLowerCase());
      }
    });
    return [...tags];
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
   *   sampler: true
   * });
   * // Returns: { tags: Set, cats: { cp: Set, lora: Set, pos: Set, neg: Set, param: Set } }
   */
  static generate(metadata, settings) {
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
    }
    if (metadata.loras) {
      metadata.loras.forEach(l => cats.lora.add(this.getBaseName(l).toLowerCase()));
    }

    // Extract prompt tags
    if (metadata.generationSteps && metadata.generationSteps.length > 0) {
      metadata.generationSteps.forEach(step => {
        if (step.positive) {
          this.cleanPrompt(step.positive).forEach(tag => cats.pos.add(tag));
        }
        if (step.negative) {
          this.cleanPrompt(step.negative, 'neg:').forEach(tag => cats.neg.add(tag));
        }
      });
    } else {
      // Fallback to old format
      if (metadata.positive) {
        this.cleanPrompt(metadata.positive).forEach(tag => cats.pos.add(tag));
      }
      if (metadata.negative) {
        this.cleanPrompt(metadata.negative, 'neg:').forEach(tag => cats.neg.add(tag));
      }
    }

    // Extract parameter tags (from base sampler only)
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
