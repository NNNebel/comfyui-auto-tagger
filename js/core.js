// js/core.js
// Universal module (Browser + Node.js)

// Load MetadataProcessor for processing
// Note: In browser environment, MetadataProcessor is loaded lazily to avoid timing issues
let MetadataProcessor;
if (typeof window === 'undefined' && typeof require !== 'undefined') {
  MetadataProcessor = require('./metadata-processor/MetadataProcessor');
}

/**
 * Get MetadataProcessor (lazy loading for browser environment)
 * @private
 */
function getMetadataProcessor() {
  if (!MetadataProcessor && typeof window !== 'undefined') {
    MetadataProcessor = window.MetadataProcessor;
  }
  return MetadataProcessor;
}

// --- Data Formatting Functions ---

/**
 * Clean and split prompt text into individual tags
 * @deprecated Use TagGenerator.cleanPrompt() instead
 * @param {string} text - Prompt text to clean
 * @param {string} [prefix=''] - Prefix to add to each tag
 * @returns {string[]} Array of cleaned tags
 */
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
    const processor = getMetadataProcessor();
    if (!processor) {
        throw new Error('MetadataProcessor is not loaded. Make sure MetadataProcessor.js is loaded before core.js');
    }
    return processor.process(parsedMeta, settings, t, buffer, mimeType);
}

/**
 * Remove annotation from text
 * @param {string} text - Text containing annotation
 * @returns {string} Text without annotation
 */
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
