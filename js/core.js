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
    // Helper to resolve inputs recursively
    const resolve = (nodeId, inputKey, visited = new Set()) => {
        if (visited.has(nodeId)) return null;
        visited.add(nodeId);
        
        const node = promptData[nodeId];
        if (!node || !node.inputs) return null;
        const val = node.inputs[inputKey];

        // If it's a direct value (not an array link), return it
        if (!Array.isArray(val)) return val;

        // If it's a link [parentId, slotIndex]
        if (val.length === 2) {
            const parentId = val[0];
            const parentNode = promptData[parentId];
            if (!parentNode) return null;

            // 1. Try to find the same key in parent (passthrough)
            if (parentNode.inputs[inputKey] !== undefined) {
                return resolve(parentId, inputKey, visited);
            }

            // 2. Try common value keys (Primitive nodes, etc.)
            for (const k of ['value', 'int', 'float', 'text', 'text_g', 'text_l', 'string', 'seed', 'steps', 'cfg', 'sampler_name']) {
                if (parentNode.inputs[k] !== undefined) {
                    return resolve(parentId, k, visited);
                }
            }
        }
        return null;
    };

    // 1. Identify all KSamplers
    const samplers = [];
    for (const id in promptData) {
        const node = promptData[id];
        if (node.class_type && node.class_type.includes("KSampler")) {
            samplers.push({ id, node });
        }
    }

    // 2. Strategy: Seed/Sampler (First-win / Base Sampler)
    let baseSamplerId = null;
    let isFallback = false;
    metadata.extra_samplers = [];

    if (samplers.length > 0) {
        // Distance calculation helper to find the "Base" sampler
        const getDistToSource = (currId, visited = new Set()) => {
            if (visited.has(currId)) return Infinity;
            visited.add(currId);
            
            const node = promptData[currId];
            if (!node) return Infinity;

            // Known sources
            if (node.class_type === "EmptyLatentImage" || 
                node.class_type.includes("VAEEncode") || 
                node.class_type.includes("CheckpointLoader") ||
                node.class_type === "LoadImage") {
                return 0;
            }

            // Trace back links
            let minDist = Infinity;
            if (node.inputs) {
                for (const key of Object.keys(node.inputs)) {
                    const val = node.inputs[key];
                    if (Array.isArray(val) && val.length === 2) {
                        const d = getDistToSource(val[0], new Set(visited));
                        if (d !== Infinity) minDist = Math.min(minDist, d + 1);
                    }
                }
            }
            return minDist;
        };

        const scored = samplers.map(s => ({
            id: s.id,
            dist: getDistToSource(s.id)
        }));

        // Sort: Min Distance -> Min ID
        scored.sort((a, b) => {
            if (a.dist !== b.dist) return a.dist - b.dist;
            return parseInt(a.id) - parseInt(b.id);
        });

        if (scored[0].dist === Infinity) {
            isFallback = true;
        }
        baseSamplerId = scored[0].id;

        // Collect info from ALL samplers
        metadata.extra_samplers = samplers.map(s => ({
            id: s.id,
            seed: resolve(s.id, "seed"),
            steps: resolve(s.id, "steps"),
            cfg: resolve(s.id, "cfg"),
            sampler: resolve(s.id, "sampler_name"),
            scheduler: resolve(s.id, "scheduler"),
            is_base: s.id === baseSamplerId
        }));
    }

    if (baseSamplerId) {
        metadata.sampler_fallback = isFallback;
        metadata.seed = resolve(baseSamplerId, "seed");
        metadata.steps = resolve(baseSamplerId, "steps");
        metadata.cfg = resolve(baseSamplerId, "cfg");
        metadata.sampler = resolve(baseSamplerId, "sampler_name");
        metadata.scheduler = resolve(baseSamplerId, "scheduler");
    }

    // 3. Strategy: Prompt (Merge)
    const allPos = new Set();
    const allNeg = new Set();

    samplers.forEach(s => {
        const p = resolve(s.id, "positive");
        const n = resolve(s.id, "negative");
        if (typeof p === 'string' && p.trim()) allPos.add(p.trim());
        if (typeof n === 'string' && n.trim()) allNeg.add(n.trim());
    });

    if (allPos.size > 0) metadata.positive = Array.from(allPos).join("\n");
    if (allNeg.size > 0) metadata.negative = Array.from(allNeg).join("\n");

    // 4. Other Global Metadata
    const loras = new Set();
    for (const id in promptData) {
        const node = promptData[id];
        if (!node.class_type) continue;
        
        if (node.class_type.includes("CheckpointLoader") && !metadata.checkpoint) {
            metadata.checkpoint = resolve(id, "ckpt_name");
        }
        if (node.class_type.includes("LoraLoader")) {
            const l = resolve(id, "lora_name");
            if (l) loras.add(l);
        }
    }
    if (loras.size > 0) metadata.loras = Array.from(loras);
}

function extractFromWorkflow(workflowData, metadata) {
    if (!workflowData.nodes) return;
    const nodes = workflowData.nodes;
    nodes.forEach(node => {
        const type = node.type || node.class_type || "";
        if (type.includes("CheckpointLoader") && !metadata.checkpoint && node.widgets_values) {
            const fullPath = node.widgets_values?.[0] || '';
            metadata.checkpoint = fullPath.split(/[/\\]/).pop();
        }
    });
}

// --- 3. データ整形ロジック ---
function cleanPrompt(text, prefix='') {
    if (!text || typeof text !== 'string') return [];
    const tags = new Set();
    // 改行やコンマで分割。プロンプト全体をマージした結果、重複するタグを排除する。
    text.split(/[\n,]/).forEach(t => {
        const v = t.trim();
        if (v && !v.startsWith('(') && !v.endsWith(')')) { // 重み付け記号の単純な除去（オプション）
            tags.add((prefix + v).toLowerCase());
        } else if (v) {
            // 重み付けがある場合も一応そのまま入れる（既存仕様維持）
            tags.add((prefix + v.replace(/[()]/g, '')).toLowerCase());
        }
    });
    return [...tags];
}

/**
 * メタデータをEagleのタグとアノテーション形式に変換
 */
function processMetadata(meta, settings, t) {
    const cats = { cp: new Set(), lora: new Set(), pos: new Set(), neg: new Set(), param: new Set() };
    const getBaseName = (p) => p ? p.split(/[/\\]/).pop().replace(/\.[^/\\.]+$/, "") : "";

    if (meta.checkpoint) cats.cp.add(getBaseName(meta.checkpoint).toLowerCase());
    if (meta.loras) meta.loras.forEach(l => cats.lora.add(getBaseName(l).toLowerCase()));
    if (meta.positive) cleanPrompt(meta.positive).forEach(tag => cats.pos.add(tag));
    if (meta.negative) cleanPrompt(meta.negative, 'neg:').forEach(tag => cats.neg.add(tag));
    
    // Tag generation uses only the Base Sampler info (meta.seed, meta.steps, etc.)
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
    if (meta.sampler_fallback) lines.push(`[Caution] ${t('log.caution.sampler_fallback')}`);
    
    if (settings.checkpoint && meta.checkpoint) lines.push(`${t('ui.option.checkpoint')}: ${getBaseName(meta.checkpoint)}`);
    if (settings.lora && meta.loras) lines.push(`${t('ui.option.lora')}: ${meta.loras.map(getBaseName).join(', ')}`);
    
    // Base Sampler Info
    let p = [];
    if (settings.steps && meta.steps) p.push(`${t('ui.option.steps')}: ${meta.steps}`);
    if (settings.cfg && meta.cfg) p.push(`CFG: ${Number(meta.cfg).toFixed(1)}`);
    if (settings.sampler && meta.sampler) p.push(`${t('ui.option.sampler')}: ${meta.sampler}`);
    if (settings.seed && meta.seed !== undefined) lines.push(`${t('ui.option.seed')}: ${meta.seed}`);
    if (p.length) lines.push(p.join(' | '));

    // Extra Samplers Info (for Note/Annotation only)
    if (settings.writeNotes && meta.extra_samplers && meta.extra_samplers.length > 1) {
        meta.extra_samplers.forEach(s => {
            if (s.is_base) return; // Skip base sampler as it's already shown
            // Format: "Seed (sampler): 12345"
            lines.push(`${t('ui.option.seed')} (${s.sampler || 'Unknown'}): ${s.seed}`);
        });
    }
    
    if (settings.positive && meta.positive) lines.push(`\n[Positive Prompt]\n${meta.positive}`);
    if (settings.negative && meta.negative) lines.push(`\n[Negative Prompt]\n${meta.negative}`);
    
    return { tags: allTags, cats, annotation: lines.length > 1 ? lines.join('\n') : '', sampler_fallback: meta.sampler_fallback };
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