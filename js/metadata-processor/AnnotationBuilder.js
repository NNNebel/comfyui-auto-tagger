// js/metadata-processor/AnnotationBuilder.js
// Annotation generation from parsed metadata
(function(global) {
  'use strict';

/**
 * AnnotationBuilder
 * 
 * Builds Eagle annotation text from parsed metadata based on user settings.
 * Handles generation info, checkpoints, LoRAs, and generation steps.
 */
class AnnotationBuilder {
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
   * Build annotation text from parsed metadata
   * @param {Object} metadata - Parsed metadata object
   * @param {Object} settings - User settings for which metadata to include
   * @param {Function} t - Translation function
   * @returns {string} Formatted annotation text
   * 
   * @example
   * const builder = new AnnotationBuilder();
   * const annotation = builder.build(metadata, settings, t);
   */
  static build(metadata, settings, t) {
    const lines = [];
    
    // Check if we have any content to display
    const hasContent = metadata.sampler_fallback || 
      (settings.checkpoint && metadata.checkpoint) || 
      (settings.lora && metadata.loras) ||
      (metadata.generationSteps && metadata.generationSteps.length > 0) ||
      (settings.seed && metadata.seed !== undefined) ||
      (settings.steps && metadata.steps !== undefined) ||
      (settings.sampler && metadata.sampler) ||
      (settings.positive && metadata.positive) ||
      (settings.negative && metadata.negative) ||
      (metadata.extra_samplers && metadata.extra_samplers.length > 0);
    
    if (!hasContent) {
      return '';
    }
    
    // Add header
    lines.push('[Generation Info]');
    
    // Warning for low-confidence base sampler detection
    if (metadata.sampler_fallback) {
      lines.push(`[Warning] ${t('log.caution.sampler_fallback')}`);
    }
    
    // Add global checkpoint and LoRAs
    if (settings.checkpoint && metadata.checkpoint) {
      lines.push(`${t('ui.option.checkpoint')}: ${this.getBaseName(metadata.checkpoint)}`);
    }
    if (settings.lora && metadata.loras) {
      lines.push(`${t('ui.option.lora')}: ${metadata.loras.map(l => this.getBaseName(l)).join(', ')}`);
    }
    
    // Use new generationSteps format if available
    if (metadata.generationSteps && metadata.generationSteps.length > 0) {
      // Build all step blocks first; only emit separator if something will appear
      const stepBlocks = [];
      metadata.generationSteps.forEach((step, index) => {
        const stepContent = this._buildStepContent(step, metadata, settings, t);
        if (stepContent.length > 0) {
          const stepLabel = this._buildStepLabel(step, index);
          stepBlocks.push([`[${stepLabel}]`, ...stepContent]);
        }
      });

      if (stepBlocks.length > 0) {
        if (lines.length > 1) {
          lines.push(''); // Empty line before steps (only when header has content)
        }
        stepBlocks.forEach((block, i) => {
          lines.push(...block);
          // Add empty line between steps (except after last step)
          if (i < stepBlocks.length - 1) {
            lines.push('');
          }
        });
      }
    } else {
      // Fallback to old format
      const fallbackLines = this._buildFallbackContent(metadata, settings, t);
      if (fallbackLines.length > 0) {
        if (lines.length > 1) {
          lines.push(''); // Empty line before fallback content
        }
        lines.push(...fallbackLines);
      }
    }
    
    return lines.length > 1 ? lines.join('\n') : '';
  }

  /**
   * Build content for a single generation step
   * @private
   */
  static _buildStepContent(step, metadata, settings, t) {
    const stepContent = [];
    
    // Add checkpoint for this step if different from global or if it's the only step
    if (settings.checkpoint && step.checkpoint) {
      const stepCheckpoint = this.getBaseName(step.checkpoint);
      const globalCheckpoint = metadata.checkpoint ? this.getBaseName(metadata.checkpoint) : null;
      
      // Show checkpoint if: 1) it's different from global, 2) there's only one step, or 3) no global checkpoint
      if (!globalCheckpoint || stepCheckpoint !== globalCheckpoint || metadata.generationSteps.length === 1) {
        stepContent.push(`${t('ui.option.checkpoint')}: ${stepCheckpoint}`);
      }
    }
    
    // Add parameters for this step
    const params = [];
    if (settings.seed && step.seed !== undefined) {
      stepContent.push(`${t('ui.option.seed')}: ${step.seed}`);
    }
    if (settings.steps && step.steps !== undefined) {
      params.push(`${t('ui.option.steps')}: ${step.steps}`);
    }
    if (settings.cfg && step.cfg !== undefined) {
      params.push(`CFG: ${Number(step.cfg).toFixed(1)}`);
    }
    if (settings.sampler && step.sampler) {
      params.push(`${t('ui.option.sampler')}: ${step.sampler}`);
    }
    if (settings.scheduler && step.scheduler) {
      params.push(`Scheduler: ${step.scheduler}`);
    }
    
    if (params.length > 0) {
      stepContent.push(params.join(' | '));
    }
    
    // Add prompts for this step
    if (settings.positive && step.positive) {
      stepContent.push(`Positive: ${step.positive}`);
    }
    if (settings.negative && step.negative) {
      stepContent.push(`Negative: ${step.negative}`);
    }
    
    return stepContent;
  }

  /**
   * Build label for a generation step
   * @private
   */
  static _buildStepLabel(step, index) {
    let stepLabel = '';
    if (step.nodeTitle) {
      stepLabel = step.nodeTitle;
    } else if (step.nodeGroup) {
      stepLabel = `${step.nodeGroup} (ID: ${step.nodeId})`;
    } else {
      stepLabel = `${step.nodeType || 'Sampler'} (ID: ${step.nodeId})`;
    }
    
    // Add role indicator
    if (step.isBase) {
      return `Base Sampler - ${stepLabel}`;
    } else {
      return `Step ${index + 1} - ${stepLabel}`;
    }
  }

  /**
   * Build fallback content for old metadata format
   * @private
   */
  static _buildFallbackContent(metadata, settings, t) {
    const fallbackLines = [];
    
    // Base Sampler Info
    if (settings.seed && metadata.seed !== undefined) {
      fallbackLines.push(`${t('ui.option.seed')}: ${metadata.seed}`);
    }
    
    const baseParams = [];
    if (settings.steps && metadata.steps) {
      baseParams.push(`${t('ui.option.steps')}: ${metadata.steps}`);
    }
    if (settings.cfg && metadata.cfg) {
      baseParams.push(`CFG: ${Number(metadata.cfg).toFixed(1)}`);
    }
    if (settings.sampler && metadata.sampler) {
      baseParams.push(`${t('ui.option.sampler')}: ${metadata.sampler}`);
    }
    if (settings.scheduler && metadata.scheduler) {
      baseParams.push(`Scheduler: ${metadata.scheduler}`);
    }
    if (baseParams.length) {
      fallbackLines.push(baseParams.join(' | '));
    }

    // All Samplers Info (for notes only)
    if (metadata.extra_samplers && metadata.extra_samplers.length > 0) {
      fallbackLines.push('', '[All Samplers]');
      
      const allSeeds = [];
      const allSteps = [];
      const allCfgs = [];
      const allSamplers = [];
      const allSchedulers = [];
      
      metadata.extra_samplers.forEach(s => {
        if (s.seed !== undefined && !allSeeds.includes(s.seed)) allSeeds.push(s.seed);
        if (s.steps !== undefined && !allSteps.includes(s.steps)) allSteps.push(s.steps);
        if (s.cfg !== undefined && !allCfgs.includes(s.cfg)) allCfgs.push(s.cfg);
        if (s.sampler && !allSamplers.includes(s.sampler)) allSamplers.push(s.sampler);
        if (s.scheduler && !allSchedulers.includes(s.scheduler)) allSchedulers.push(s.scheduler);
      });
      
      if (settings.seed && allSeeds.length > 0) {
        fallbackLines.push(`${t('ui.option.seed')}: ${allSeeds.join(', ')}`);
      }
      if (settings.steps && allSteps.length > 0) {
        fallbackLines.push(`${t('ui.option.steps')}: ${allSteps.join(', ')}`);
      }
      if (settings.cfg && allCfgs.length > 0) {
        fallbackLines.push(`CFG: ${allCfgs.map(c => Number(c).toFixed(1)).join(', ')}`);
      }
      if (settings.sampler && allSamplers.length > 0) {
        fallbackLines.push(`${t('ui.option.sampler')}: ${allSamplers.join(', ')}`);
      }
      if (settings.scheduler && allSchedulers.length > 0) {
        fallbackLines.push(`Scheduler: ${allSchedulers.join(', ')}`);
      }
    }
    
    if (settings.positive && metadata.positive) {
      fallbackLines.push('', '[Positive Prompt]', metadata.positive);
    }
    if (settings.negative && metadata.negative) {
      fallbackLines.push('', '[Negative Prompt]', metadata.negative);
    }
    
    return fallbackLines;
  }
}

// Export for both browser and Node.js environments
if (typeof window !== 'undefined') {
  window.AnnotationBuilder = AnnotationBuilder;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnnotationBuilder;
}

})(typeof window !== 'undefined' ? window : global);
