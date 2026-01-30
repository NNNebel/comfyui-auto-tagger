// js/core.js
// Universal module (Browser + Node.js)

// Load MetadataService for Node.js environment
let MetadataService;
if (typeof window === 'undefined' && typeof require !== 'undefined') {
  MetadataService = require('./metadata-parser/integration/MetadataService');
} else if (typeof window !== 'undefined') {
  MetadataService = window.MetadataService;
}

// --- Data Formatting Functions ---

function cleanPrompt(text, prefix='') {
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
 * Convert metadata to Eagle's tag and annotation format
 * 
 * This function can work in two modes:
 * 1. With parsed metadata object (for testing and backward compatibility)
 * 2. With buffer and mimeType (uses MetadataService for parsing)
 * 
 * @param {Object|null} parsedMeta - Pre-parsed metadata object (if available)
 * @param {Object} settings - User settings for which metadata to include
 * @param {Function} t - Translation function
 * @param {Uint8Array} [buffer] - Image buffer for MetadataService parsing
 * @param {string} [mimeType] - Image MIME type for MetadataService parsing
 * @returns {Object} Formatted metadata with tags, categories, and annotation
 */
function processMetadata(parsedMeta, settings, t, buffer = null, mimeType = null) {
    let meta = {};
    
    // If parsedMeta is provided, use it directly (for testing/backward compatibility)
    if (parsedMeta && typeof parsedMeta === 'object') {
        meta = parsedMeta;
    }
    // Otherwise, use MetadataService if buffer and mimeType are provided
    else if (buffer && mimeType && MetadataService) {
        try {
            const service = new MetadataService();
            const parsed = service.extractPreferredMetadata(buffer, mimeType, 'comfyui');
            if (parsed) {
                meta = parsed;
            }
        } catch (e) {
            console.error('[core.js] MetadataService parsing failed:', e);
        }
    }
    
    const cats = { cp: new Set(), lora: new Set(), pos: new Set(), neg: new Set(), param: new Set() };
    const getBaseName = (p) => p ? p.split(/[/\\]/).pop().replace(/\.[^/\\.]+$/, "") : "";

    if (meta.checkpoint) cats.cp.add(getBaseName(meta.checkpoint).toLowerCase());
    if (meta.loras) meta.loras.forEach(l => cats.lora.add(getBaseName(l).toLowerCase()));
    
    // For tags: merge all prompts with deduplication
    if (meta.generationSteps && meta.generationSteps.length > 0) {
        meta.generationSteps.forEach(step => {
            if (step.positive) cleanPrompt(step.positive).forEach(tag => cats.pos.add(tag));
            if (step.negative) cleanPrompt(step.negative, 'neg:').forEach(tag => cats.neg.add(tag));
        });
    } else {
        // Fallback to old format
        if (meta.positive) cleanPrompt(meta.positive).forEach(tag => cats.pos.add(tag));
        if (meta.negative) cleanPrompt(meta.negative, 'neg:').forEach(tag => cats.neg.add(tag));
    }
    
    // Tag generation uses only the Base Sampler info
    if (meta.seed !== undefined) cats.param.add(`seed:${meta.seed}`);
    if (meta.steps !== undefined) cats.param.add(`steps:${meta.steps}`);
    if (meta.cfg !== undefined) cats.param.add(`cfg:${Number(meta.cfg).toFixed(2)}`);
    if (meta.sampler) cats.param.add(`sampler:${String(meta.sampler).toLowerCase()}`);

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
    
    // Build annotation using new generation steps format
    let lines = [];
    
    // Add header only if we have content to show
    let hasContent = false;
    
    // Check if we have any content to display
    if (meta.sampler_fallback || 
        (settings.checkpoint && meta.checkpoint) || 
        (settings.lora && meta.loras) ||
        (meta.generationSteps && meta.generationSteps.length > 0)) {
        hasContent = true;
    }
    
    if (hasContent) {
        lines.push('[Generation Info]');
        
        // Warning for low-confidence base sampler detection
        if (meta.sampler_fallback) {
            lines.push(`[Warning] ${t('log.caution.sampler_fallback')}`);
        }
        
        if (settings.checkpoint && meta.checkpoint) {
            lines.push(`${t('ui.option.checkpoint')}: ${getBaseName(meta.checkpoint)}`);
        }
        if (settings.lora && meta.loras) {
            lines.push(`${t('ui.option.lora')}: ${meta.loras.map(getBaseName).join(', ')}`);
        }
    }
    
    // Use new generationSteps format if available
    if (meta.generationSteps && meta.generationSteps.length > 0) {
        if (lines.length > 0) {
            lines.push(''); // Empty line before steps
        }
        
        meta.generationSteps.forEach((step, index) => {
            // Collect step content first to check if there's anything to display
            const stepContent = [];
            
            // Add checkpoint for this step if different from global or if it's the only step
            if (settings.checkpoint && step.checkpoint) {
                const stepCheckpoint = getBaseName(step.checkpoint);
                const globalCheckpoint = meta.checkpoint ? getBaseName(meta.checkpoint) : null;
                
                // Show checkpoint if: 1) it's different from global, 2) there's only one step, or 3) no global checkpoint
                if (!globalCheckpoint || stepCheckpoint !== globalCheckpoint || meta.generationSteps.length === 1) {
                    stepContent.push(`${t('ui.option.checkpoint')}: ${stepCheckpoint}`);
                }
            }
            
            // Add parameters for this step
            const params = [];
            if (settings.seed && step.seed !== undefined) {
                stepContent.push(`${t('ui.option.seed')}: ${step.seed}`);
            }
            if (settings.steps && step.steps !== undefined) params.push(`${t('ui.option.steps')}: ${step.steps}`);
            if (settings.cfg && step.cfg !== undefined) params.push(`CFG: ${Number(step.cfg).toFixed(1)}`);
            if (settings.sampler && step.sampler) params.push(`${t('ui.option.sampler')}: ${step.sampler}`);
            if (settings.scheduler && step.scheduler) params.push(`Scheduler: ${step.scheduler}`);
            
            if (params.length > 0) {
                stepContent.push(params.join(' | '));
            }
            
            // Add prompts for this step (no deduplication - show actual values)
            if (settings.positive && step.positive) {
                stepContent.push(`Positive: ${step.positive}`);
            }
            if (settings.negative && step.negative) {
                stepContent.push(`Negative: ${step.negative}`);
            }
            
            // Only add step label and content if there's something to display
            if (stepContent.length > 0) {
                // Determine step label
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
                    stepLabel = `Base Sampler - ${stepLabel}`;
                } else {
                    stepLabel = `Step ${index + 1} - ${stepLabel}`;
                }
                
                lines.push(`[${stepLabel}]`);
                lines.push(...stepContent);
                
                // Add empty line between steps (except after last step)
                if (index < meta.generationSteps.length - 1) {
                    lines.push('');
                }
            }
        });
    } else {
        // Fallback to old format
        let fallbackLines = [];
        
        // Base Sampler Info
        if (settings.seed && meta.seed !== undefined) fallbackLines.push(`${t('ui.option.seed')}: ${meta.seed}`);
        
        let baseParams = [];
        if (settings.steps && meta.steps) baseParams.push(`${t('ui.option.steps')}: ${meta.steps}`);
        if (settings.cfg && meta.cfg) baseParams.push(`CFG: ${Number(meta.cfg).toFixed(1)}`);
        if (settings.sampler && meta.sampler) baseParams.push(`${t('ui.option.sampler')}: ${meta.sampler}`);
        if (settings.scheduler && meta.scheduler) baseParams.push(`Scheduler: ${meta.scheduler}`);
        if (baseParams.length) fallbackLines.push(baseParams.join(' | '));

        // All Samplers Info (for notes only)
        if (meta.extra_samplers && meta.extra_samplers.length > 0) {
            fallbackLines.push('', '[All Samplers]');
            
            const allSeeds = [];
            const allSteps = [];
            const allCfgs = [];
            const allSamplers = [];
            const allSchedulers = [];
            
            meta.extra_samplers.forEach(s => {
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
        
        if (settings.positive && meta.positive) fallbackLines.push('', '[Positive Prompt]', meta.positive);
        if (settings.negative && meta.negative) fallbackLines.push('', '[Negative Prompt]', meta.negative);
        
        // Only add fallback content if we have something to show
        if (fallbackLines.length > 0) {
            if (lines.length > 0) {
                lines.push(''); // Empty line before fallback content
            }
            lines.push(...fallbackLines);
        }
    }
    
    return { 
        tags: allTags, 
        cats, 
        annotation: lines.length > 1 ? lines.join('\n') : '', 
        sampler_fallback: meta.sampler_fallback,
        stepCount: meta.generationSteps && meta.generationSteps.length > 0 
            ? meta.generationSteps.length 
            : (meta.extra_samplers && meta.extra_samplers.length > 0 ? meta.extra_samplers.length : 1)
    };
}

function removeAnnotation(text) {
    if (!text) return text;
    const marker = '[Generation Info]';
    const idx = text.indexOf(marker);
    if (idx !== -1) {
        return text.substring(0, idx).trim();
    }
    return text;
}

// --- Node.js環境(Vitest)向けのエクスポート ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        processMetadata,
        cleanPrompt,
        removeAnnotation
    };
}
