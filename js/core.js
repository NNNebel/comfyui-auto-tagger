// js/core.js

// --- 1. 画像解析ロジック ---
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

// --- 2. メタデータ解析ロジック ---
function extractComfyMetadata(json) {
    const metadata = {};
    if (json.prompt) {
        try { extractFromPrompt(json.prompt, metadata); } catch (e) { console.error("Prompt parsing failed:", e); }
    }
    if (json.workflow) {
        try { extractFromWorkflow(json.workflow, metadata); } catch (e) { console.error("Workflow parsing failed:", e); }
    }
    return metadata;
}

function extractFromPrompt(promptData, metadata) {
    const resolve = (nodeId, inputKey) => {
        const node = promptData[nodeId];
        if (!node || !node.inputs) return null;
        const val = node.inputs[inputKey];
        if (Array.isArray(val) && val.length === 2 && typeof val[0] === 'string') {
            const src = promptData[val[0]];
            if (!src) return null;
            if (src.inputs[inputKey] !== undefined) return resolve(val[0], inputKey);
            for(const k of ['value','int','float','text','string']) if(src.inputs[k]!==undefined) return resolve(val[0], k);
            return null;
        }
        return val;
    };
    for (const id in promptData) {
        const node = promptData[id];
        if (!node.class_type) continue;
        if (node.class_type.includes("CheckpointLoader") && !metadata.checkpoint) metadata.checkpoint = resolve(id, "ckpt_name");
        if (node.class_type.includes("LoraLoader") && !metadata.loras) { const l = resolve(id, "lora_name"); if(l) metadata.loras=[l]; }
        if (node.class_type.includes("KSampler")) {
            if(!metadata.seed) metadata.seed=resolve(id,"seed");
            if(!metadata.steps) metadata.steps=resolve(id,"steps");
            if(!metadata.cfg) metadata.cfg=resolve(id,"cfg");
            if(!metadata.sampler) metadata.sampler=resolve(id,"sampler_name");
            if(!metadata.positive) metadata.positive=resolve(id,"positive");
            if(!metadata.negative) metadata.negative=resolve(id,"negative");
        }
    }
}

function extractFromWorkflow(workflowData, metadata) {
    if (!workflowData.nodes) return;
    const nodes = workflowData.nodes;
    nodes.forEach(node => {
        const type = node.type || node.class_type || "";
        if (type.includes("CheckpointLoader") && !metadata.checkpoint && node.widgets_values) {
            // Widget値からファイル名のみを抽出
            const fullPath = node.widgets_values?.[0] || '';
            metadata.checkpoint = fullPath.split(/[/\\]/).pop();
        }
    });
}

// --- 3. データ整形ロジック ---
function cleanPrompt(text, prefix='') {
    if (!text || typeof text !== 'string') return [];
    const tags = new Set();
    text.replace(/\n/g, ',').split(',').forEach(t => {
        const v = t.trim();
        if (v) tags.add((prefix + v).toLowerCase());
    });
    return [...tags];
}

/**
 * メタデータをEagleのタグとアノテーション形式に変換
 * settings: チェックボックスの有効状態
 * t: 翻訳関数 (テスト時はモックを渡す)
 */
function processMetadata(meta, settings, t) {
    const cats = { cp: new Set(), lora: new Set(), pos: new Set(), neg: new Set(), param: new Set() };
    const getBaseName = (p) => p ? p.split(/[/\\]/).pop().replace(/\.[^/\\.]+$/, "") : "";

    if (meta.checkpoint) cats.cp.add(getBaseName(meta.checkpoint).toLowerCase());
    if (meta.loras) meta.loras.forEach(l => cats.lora.add(getBaseName(l).toLowerCase()));
    if (meta.positive) cleanPrompt(meta.positive).forEach(t => cats.pos.add(t));
    if (meta.negative) cleanPrompt(meta.negative, 'neg:').forEach(t => cats.neg.add(t));
    
    if (meta.seed !== undefined) cats.param.add(`seed:${meta.seed}`);
    if (meta.steps !== undefined) cats.param.add(`steps:${meta.steps}`);
    if (meta.cfg !== undefined) cats.param.add(`cfg:${Number(meta.cfg).toFixed(2)}`);
    if (meta.sampler) cats.param.add(`sampler:${String(meta.sampler).toLowerCase()}`);

    // Generate tags based on settings
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
    if (settings.checkpoint && meta.checkpoint) lines.push(`${t('ui.option.checkpoint')}: ${getBaseName(meta.checkpoint)}`);
    if (settings.lora && meta.loras) lines.push(`${t('ui.option.lora')}: ${meta.loras.map(getBaseName).join(', ')}`);
    
    let p = [];
    if (settings.steps && meta.steps) p.push(`${t('ui.option.steps')}: ${meta.steps}`);
    if (settings.cfg && meta.cfg) p.push(`CFG: ${Number(meta.cfg).toFixed(1)}`);
    if (settings.sampler && meta.sampler) p.push(`${t('ui.option.sampler')}: ${meta.sampler}`);
    if (settings.seed && meta.seed !== undefined) lines.push(`${t('ui.option.seed')}: ${meta.seed}`);
    if (p.length) lines.push(p.join(' | '));
    
    if (settings.positive && meta.positive) lines.push(`
[Positive Prompt]
${meta.positive}`);
    if (settings.negative && meta.negative) lines.push(`
[Negative Prompt]
${meta.negative}`);
    
    return { tags: allTags, cats, annotation: lines.length > 1 ? lines.join('\n') : '' };
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
        extractComfyMetadata,
        processMetadata,
        cleanPrompt,
        removeAnnotation
    };
}