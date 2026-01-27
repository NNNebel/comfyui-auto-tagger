// js/core.js

// Import MetadataService for parsing
let MetadataService;
if (typeof require !== 'undefined') {
  MetadataService = require('./metadata-parser/integration/MetadataService');
}

// --- 1. Binary Extraction (kept for backward compatibility) ---
function getGenInfo(buffer, mimeType) {
    if (mimeType === 'image/png') return parsePng(buffer);
    if (mimeType === 'image/webp') return parseWebP(buffer);
    return {};
}

function parsePng(buffer) {
    const result = {};
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    if (view.getUint32(0) !== 0x89504e47) return result;
    let offset = 8;
    while (offset < view.byteLength) {
        if (offset + 4 > view.byteLength) break;
        const length = view.getUint32(offset);
        offset += 4;
        if (offset + 4 > view.byteLength) break;
        const type = getFourCC(view, offset);
        offset += 4;
        if (type === 'tEXt') {
            const chunkData = buffer.slice(offset, offset + length);
            const { keyword, text } = decodePngText(chunkData);
            try {
                if (keyword === 'workflow' || keyword === 'prompt') {
                    result[keyword] = JSON.parse(text);
                } else {
                    result[keyword] = text;
                }
            } catch (e) {}
        }
        offset += length + 4;
    }
    return result;
}

function decodePngText(data) {
    const nullIndex = data.indexOf(0x00);
    if (nullIndex === -1) return { keyword: '', text: '' };
    const decoder = new TextDecoder('utf-8');
    return {
        keyword: decoder.decode(data.slice(0, nullIndex)),
        text: decoder.decode(data.slice(nullIndex + 1))
    };
}

function parseWebP(buffer) {
    const result = {};
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    if (getFourCC(view, 0) !== 'RIFF' || getFourCC(view, 8) !== 'WEBP') return result;
    let offset = 12;
    while (offset < view.byteLength) {
        if (offset + 8 > view.byteLength) break;
        const chunkSize = view.getUint32(offset + 4, true);
        const chunkDataOffset = offset + 8;
        const chunkType = getFourCC(view, offset);
        if (chunkType === 'EXIF' || chunkType === 'XMP ') {
            extractFromBinary(buffer.slice(chunkDataOffset, chunkDataOffset + chunkSize), result);
        }
        offset += 8 + chunkSize + (chunkSize % 2);
    }
    return result;
}

function extractFromBinary(data, result) {
    const decoder = new TextDecoder('iso-8859-1');
    const binaryString = decoder.decode(data);

    const parseJson = (key) => {
        const match = binaryString.match(new RegExp(`${key}:\s*(\{)`, 'i'));
        if (match) {
            const jsonStart = match.index + match[0].lastIndexOf('{');
            const json = parseJsonFromPos(data, jsonStart);
            if (json) {
                result[key.toLowerCase()] = json;
            }
        }
    };
    parseJson('workflow');
    parseJson('prompt');
}

function parseJsonFromPos(fullBuffer, startPos) {
    let braceCount = 0;
    let inString = false;
    let escape = false;
    let endPos = -1;
    for (let i = startPos; i < fullBuffer.length; i++) {
        const byte = fullBuffer[i];
        if (escape) { escape = false; continue; }
        if (byte === 0x5c) { escape = true; continue; }
        if (byte === 0x22) { inString = !inString; continue; }
        if (!inString) {
            if (byte === 0x7b) braceCount++;
            else if (byte === 0x7d) {
                braceCount--;
                if (braceCount === 0) { endPos = i; break; }
            }
        }
    }
    if (endPos !== -1) {
        try {
            return JSON.parse(new TextDecoder('utf-8').decode(fullBuffer.slice(startPos, endPos + 1)));
        } catch (e) { return null; }
    }
    return null;
}

function getFourCC(view, offset) {
    return String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
}

// --- 2. Data Formatting ---
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
    if (meta.positive) cleanPrompt(meta.positive).forEach(tag => cats.pos.add(tag));
    if (meta.negative) cleanPrompt(meta.negative, 'neg:').forEach(tag => cats.neg.add(tag));
    
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
    
    let lines = ['[Generation Info]'];
    
    // Warning for low-confidence base sampler detection
    if (meta.sampler_fallback) {
        lines.push(`[Warning] ${t('log.caution.sampler_fallback')}`);
    }
    
    if (settings.checkpoint && meta.checkpoint) lines.push(`${t('ui.option.checkpoint')}: ${getBaseName(meta.checkpoint)}`);
    if (settings.lora && meta.loras) lines.push(`${t('ui.option.lora')}: ${meta.loras.map(getBaseName).join(', ')}`);
    
    // Base Sampler Info
    if (settings.seed && meta.seed !== undefined) lines.push(`${t('ui.option.seed')}: ${meta.seed}`);
    
    let baseParams = [];
    if (settings.steps && meta.steps) baseParams.push(`${t('ui.option.steps')}: ${meta.steps}`);
    if (settings.cfg && meta.cfg) baseParams.push(`CFG: ${Number(meta.cfg).toFixed(1)}`);
    if (settings.sampler && meta.sampler) baseParams.push(`${t('ui.option.sampler')}: ${meta.sampler}`);
    if (meta.scheduler) baseParams.push(`Scheduler: ${meta.scheduler}`);
    if (baseParams.length) lines.push(baseParams.join(' | '));

    // All Samplers Info (for notes only)
    if (meta.extra_samplers && meta.extra_samplers.length > 0) {
        lines.push('\n[All Samplers]');
        
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
            lines.push(`${t('ui.option.seed')}: ${allSeeds.join(', ')}`);
        }
        if (settings.steps && allSteps.length > 0) {
            lines.push(`${t('ui.option.steps')}: ${allSteps.join(', ')}`);
        }
        if (settings.cfg && allCfgs.length > 0) {
            lines.push(`CFG: ${allCfgs.map(c => Number(c).toFixed(1)).join(', ')}`);
        }
        if (settings.sampler && allSamplers.length > 0) {
            lines.push(`${t('ui.option.sampler')}: ${allSamplers.join(', ')}`);
        }
        if (allSchedulers.length > 0) {
            lines.push(`Scheduler: ${allSchedulers.join(', ')}`);
        }
    }
    
    if (settings.positive && meta.positive) lines.push(`\n[Positive Prompt]\n${meta.positive}`);
    if (settings.negative && meta.negative) lines.push(`\n[Negative Prompt]\n${meta.negative}`);
    
    return { 
        tags: allTags, 
        cats, 
        annotation: lines.length > 1 ? lines.join('\n') : '', 
        sampler_fallback: meta.sampler_fallback 
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
        getGenInfo,
        processMetadata,
        cleanPrompt,
        removeAnnotation
    };
}
