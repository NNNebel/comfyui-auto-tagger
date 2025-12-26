const fsp = require('fs').promises;
const path = require('path');
const os = require('os');

// --- ComfyUI/A1111 Fast Parser (Library-free & Robust) ---
function getGenInfo(buffer, mimeType) {
    if (mimeType === 'image/png') {
        return parsePng(buffer);
    } else if (mimeType === 'image/webp') {
        return parseWebP(buffer);
    }
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
            } catch (e) {
                console.error(`Error parsing JSON from ${keyword} chunk`, e);
            }
        }
        offset += length + 4;
    }
    return result;
}

function decodePngText(data) {
    const nullIndex = data.indexOf(0x00);
    if (nullIndex === -1) return { keyword: '', text: '' };
    const decoder = new TextDecoder('utf-8');
    const keyword = decoder.decode(data.slice(0, nullIndex));
    const text = decoder.decode(data.slice(nullIndex + 1));
    return { keyword, text };
}

function parseWebP(buffer) {
    const result = {};
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    if (getFourCC(view, 0) !== 'RIFF' || getFourCC(view, 8) !== 'WEBP') return result;
    let offset = 12;
    while (offset < view.byteLength) {
        if (offset + 8 > view.byteLength) break;
        const chunkType = getFourCC(view, offset);
        const chunkSize = view.getUint32(offset + 4, true);
        const chunkDataOffset = offset + 8;
        if (chunkType === 'EXIF' || chunkType === 'XMP ') {
            const chunkData = buffer.slice(chunkDataOffset, chunkDataOffset + chunkSize);
            extractFromBinary(chunkData, result);
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
            const braceRelIndex = match[0].lastIndexOf('{');
            const jsonStart = match.index + braceRelIndex;
            const json = parseJsonFromPos(data, jsonStart);
            if (json) {
                result[key.toLowerCase()] = json;
            }
        }
    };
    parseJson('workflow');
    parseJson('prompt');

    if (!result.workflow && binaryString.includes('nodes') && binaryString.includes('links')) {
        const jsonStart = binaryString.indexOf('{');
        if (jsonStart !== -1) {
             const json = parseJsonFromPos(data, jsonStart);
             if (json && json.nodes) result.workflow = json;
        }
    }
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
                if (braceCount === 0) {
                    endPos = i;
                    break;
                }
            }
        }
    }
    if (endPos !== -1) {
        try {
            const jsonBuffer = fullBuffer.slice(startPos, endPos + 1);
            return JSON.parse(new TextDecoder('utf-8').decode(jsonBuffer));
        } catch (e) { return null; }
    }
    return null;
}

function getFourCC(view, offset) {
    return String.fromCharCode(
        view.getUint8(offset), view.getUint8(offset + 1),
        view.getUint8(offset + 2), view.getUint8(offset + 3)
    );
}
// --- End of Fast Parser ---

// --- START NEW METADATA EXTRACTION LOGIC ---

/**
 * Extracts metadata from ComfyUI's execution graph (prompt) first,
 * then falls back to the UI graph (workflow).
 */
function extractComfyMetadata(json) {
    const metadata = {};

    if (json.prompt) {
        try {
            extractFromPrompt(json.prompt, metadata);
        } catch (e) { console.error("Prompt parsing failed:", e); }
    }
    
    if (json.workflow) {
        try {
            extractFromWorkflow(json.workflow, metadata);
        } catch (e) { console.error("Workflow parsing failed:", e); }
    }

    return metadata;
}

function extractFromPrompt(promptData, metadata) {
    const resolve = (nodeId, inputKey) => {
        const node = promptData[nodeId];
        if (!node || !node.inputs) return null;
        const val = node.inputs[inputKey];
        
        if (Array.isArray(val) && val.length === 2 && typeof val[0] === 'string') {
            const sourceNodeId = val[0];
            const sourceNode = promptData[sourceNodeId];
            if (!sourceNode) return null;

            const classType = sourceNode.class_type;
            if (sourceNode.inputs[inputKey] !== undefined) return resolve(sourceNodeId, inputKey);
            
            const commonKeys = ['value', 'int', 'float', 'text', 'string'];
            for(const key of commonKeys) {
                if (sourceNode.inputs[key] !== undefined) return resolve(sourceNodeId, key);
            }
            if (inputKey === 'seed' && sourceNode.inputs['seed'] !== undefined) return resolve(sourceNodeId, 'seed');
            
            return null;
        }
        return val;
    };

    for (const id in promptData) {
        const node = promptData[id];
        if (!node.class_type) continue;

        if (node.class_type.includes("CheckpointLoader") && !metadata.checkpoint) {
            metadata.checkpoint = resolve(id, "ckpt_name");
        }
        
        if (node.class_type === "LoraLoader" && !metadata.loras) {
             const loraName = resolve(id, "lora_name");
             if (loraName) metadata.loras = [loraName];
        }

        if (node.class_type.includes("KSampler")) {
            const props = {
                steps: resolve(id, "steps"),
                cfg: resolve(id, "cfg"),
                seed: resolve(id, "seed"),
                sampler: resolve(id, "sampler_name"),
                scheduler: resolve(id, "scheduler"),
                denoise: resolve(id, "denoise"),
                positive: resolve(id, "positive"),
                negative: resolve(id, "negative")
            };
            for(const key in props) {
                if(props[key] !== null && metadata[key] === undefined) metadata[key] = props[key];
            }
        }
    }
}

function extractFromWorkflow(workflowData, metadata) {
    if (!workflowData.nodes) return;

    const nodes = workflowData.nodes;
    const links = workflowData.links || [];
    const nodeById = {};
    nodes.forEach(n => nodeById[n.id] = n);

    const resolveLink = (node, inputName, type) => {
        if (!node || !node.inputs) return undefined;
        
        const input = node.inputs.find(i => i.name === inputName);
        if (!input || input.link === null || input.link === undefined) return undefined;

        const link = links.find(l => l[0] === input.link);
        if (!link) return undefined;

        const sourceNodeId = link[1];
        const sourceNode = nodeById[sourceNodeId];
        if (!sourceNode) return undefined;

        if (sourceNode.widgets_values && sourceNode.widgets_values.length > 0) {
            return sourceNode.widgets_values[0];
        }
        return undefined;
    };

    nodes.forEach(node => {
        const type = node.type || node.class_type || "";

        if (type.includes("CheckpointLoader")) {
            if (!metadata.checkpoint && node.widgets_values) {
                metadata.checkpoint = path.basename(node.widgets_values[0]);
            }
        }
        
        if (type === "LoraLoader") {
            if (!metadata.loras && node.widgets_values) {
                metadata.loras = [path.basename(node.widgets_values[0])];
            }
        }

        if (type.includes("KSampler")) {
            const w = node.widgets_values || [];
            if (!metadata.seed) metadata.seed = (w[0] !== undefined) ? w[0] : resolveLink(node, 'seed');
            if (!metadata.steps) metadata.steps = (w[2] !== undefined) ? w[2] : resolveLink(node, 'steps');
            if (!metadata.cfg) metadata.cfg = (w[3] !== undefined) ? w[3] : resolveLink(node, 'cfg');
            if (!metadata.sampler) metadata.sampler = (w[4] !== undefined) ? w[4] : resolveLink(node, 'sampler_name');
            if (!metadata.scheduler) metadata.scheduler = (w[5] !== undefined) ? w[5] : resolveLink(node, 'scheduler');
        }
    });
}
// --- END NEW METADATA EXTRACTION LOGIC ---


Promise.all([new Promise(r => eagle.onPluginCreate(r)), new Promise(r => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', r) : r())]).then(([plugin]) => {
    
    // ... (rest of the code is largely the same, but uses the new metadata object) ...

    function t(key, replacements = {}) {
        if (typeof i18next === 'undefined') {
            console.error('i18next is not defined!');
            let msg = key;
            for (const rKey in replacements) {
                msg = msg.replace(`{{${rKey}}}`, replacements[rKey]);
            }
            return msg;
        }
        return i18next.t(key, replacements);
    }

    let isCancelled = false;
    let logBuffer = [];
    const MAX_LOG_LINES = 100;

    const startButton = document.getElementById('startButton');
    const deleteInfoButton = document.getElementById('deleteInfoButton');
    const cancelButton = document.getElementById('cancelButton');
    const logArea = document.getElementById('log');
    const chkCheckpoint = document.getElementById('chk-checkpoint');
    const chkLora = document.getElementById('chk-lora');
    const chkPositive = document.getElementById('chk-positive');
    const chkNegative = document.getElementById('chk-negative');
    const chkSeed = document.getElementById('chk-seed');
    const chkSampler = document.getElementById('chk-sampler');
    const chkSteps = document.getElementById('chk-steps');
    const chkCfg = document.getElementById('chk-cfg');
    const chkAddTags = document.getElementById('chk-add-tags');
    const chkWriteNotes = document.getElementById('chk-write-notes');

    const DEBUG_LOG_FILE = path.join(os.tmpdir(), `comfyui-auto-tagger-debug-${Date.now()}.log`);

    async function debugLogToFile(message, item = null) {
        let prefix = `[${new Date().toISOString()}]`;
        if (item) prefix += ` [Item: ${item.name || item.id}]`;
        await fsp.appendFile(DEBUG_LOG_FILE, `${prefix} ${message}\n`).catch(e => console.error("Failed to write debug log to file:", e));
    }

    function applyLocale() {
        document.title = t('ui.title');
        document.querySelector('h1').textContent = t('ui.title');
        document.querySelector('label[for="chk-checkpoint"]').textContent = t('ui.option.checkpoint');
        document.querySelector('label[for="chk-lora"]').textContent = t('ui.option.lora');
        document.querySelector('label[for="chk-positive"]').textContent = t('ui.option.positive');
        document.querySelector('label[for="chk-negative"]').textContent = t('ui.option.negative');
        document.querySelector('label[for="chk-seed"]').textContent = t('ui.option.seed');
        document.querySelector('label[for="chk-sampler"]').textContent = t('ui.option.sampler');
        document.querySelector('label[for="chk-steps"]').textContent = t('ui.option.steps');
        document.querySelector('label[for="chk-cfg"]').textContent = t('ui.option.cfg');
        document.querySelector('label[for="chk-add-tags"]').textContent = t('ui.option.addTags', { defaultValue: 'タグに追加' });
        document.querySelector('label[for="chk-write-notes"]').textContent = t('ui.option.writeNotes', { defaultValue: 'メモに追加' });
        document.querySelector('#output-settings h3').textContent = t('ui.header.outputSettings', { defaultValue: '出力設定' });

        startButton.textContent = t('ui.button.start');
        deleteInfoButton.textContent = t('ui.button.deleteInfo', { defaultValue: '生成情報を削除' });
        cancelButton.textContent = t('ui.button.cancel');
        log(t('log.initial'));
        log(`DEBUG LOGGING TO: ${DEBUG_LOG_FILE}`);
    }

    function log(message) {
        if (!logArea) return;
        console.log(message);
        logBuffer.push(message);
        if (logBuffer.length > MAX_LOG_LINES) logBuffer.shift();
        logArea.textContent = logBuffer.join('\n');
        logArea.scrollTop = logArea.scrollHeight;
    }

    function cleanAndSplitPrompt(promptText, prefix = '') {
        if (!promptText || typeof promptText !== 'string') return [];
        let processedText = promptText.replace(/\n/g, ',');
        const finalTags = new Set();
        processedText.split(',').forEach(tag => {
            const trimmed = tag.trim();
            if (trimmed) finalTags.add((prefix + trimmed).toLowerCase());
        });
        return [...finalTags];
    }

    function processExtractedMetadata(metadata) {
        const categorized = {
            checkpoints: new Set(),
            loras: new Set(),
            positive: new Set(),
            negative: new Set(),
            ksampler: new Set()
        };

        if (metadata.checkpoint) categorized.checkpoints.add(path.basename(metadata.checkpoint, path.extname(metadata.checkpoint)).toLowerCase());
        if (metadata.loras) metadata.loras.forEach(l => categorized.loras.add(path.basename(l, path.extname(l)).toLowerCase()));
        
        if (metadata.positive) cleanAndSplitPrompt(metadata.positive).forEach(t => categorized.positive.add(t));
        if (metadata.negative) cleanAndSplitPrompt(metadata.negative, 'neg:').forEach(t => categorized.negative.add(t));

        if (metadata.seed !== undefined) categorized.ksampler.add(`seed:${metadata.seed}`);
        if (metadata.steps !== undefined) categorized.ksampler.add(`steps:${metadata.steps}`);
        if (metadata.cfg !== undefined) categorized.ksampler.add(`cfg:${Number(metadata.cfg).toFixed(2)}`);
        if (metadata.sampler) categorized.ksampler.add(`sampler:${metadata.sampler.toLowerCase()}`);
        
        const allTags = new Set([...categorized.checkpoints, ...categorized.loras, ...categorized.positive, ...categorized.negative, ...categorized.ksampler]);

        // Generate Annotation Text
        let lines = [];
        lines.push('[Generation Info]');
        if (chkCheckpoint.checked && metadata.checkpoint) lines.push(`Model: ${path.basename(metadata.checkpoint, path.extname(metadata.checkpoint))}`);
        if (chkLora.checked && metadata.loras) lines.push(`Lora: ${metadata.loras.map(l => path.basename(l, path.extname(l))).join(', ')}`);
        
        let infoParts = [];
        if (chkSteps.checked && metadata.steps !== undefined) infoParts.push(`Steps: ${metadata.steps}`);
        if (chkCfg.checked && metadata.cfg !== undefined) infoParts.push(`CFG: ${Number(metadata.cfg).toFixed(1)}`);
        if (chkSampler.checked && metadata.sampler) infoParts.push(`Sampler: ${metadata.sampler}`);
        if (chkSeed.checked && metadata.seed !== undefined) lines.push(`Seed: ${metadata.seed}`);
        if (infoParts.length) lines.push(infoParts.join(' | '));
        
        if (chkPositive.checked && metadata.positive) {
            lines.push('\n[Positive]');
            lines.push(metadata.positive);
        }
        if (chkNegative.checked && metadata.negative) {
            lines.push('\n[Negative]');
            lines.push(metadata.negative);
        }
        
        const annotation = lines.length > 1 ? lines.join('\n') : '';

        return { tags: allTags, categorized, annotation };
    }

    async function startTagging() {
        startButton.disabled = true;
        deleteInfoButton.disabled = true;
        cancelButton.style.display = 'inline-block';
        isCancelled = false;
        logBuffer = [];
        log(t('log.start'));

        try {
            const items = await eagle.item.getSelected();
            if (items.length === 0) {
                log(t('log.noItemSelected'));
                resetButtons();
                return;
            }
            log(t('log.processingItems', { count: items.length }));
            await debugLogToFile(`\n--- START TAGGING RUN: ${items.length} items ---`);


            for (const item of items) {
                if (isCancelled) break;
                try {
                    log(t('log.processingItem', { name: item.name }));
                    
                    const ext = path.extname(item.filePath).toLowerCase();
                    let mimeType = '';
                    if (ext === '.png') mimeType = 'image/png';
                    else if (ext === '.webp') mimeType = 'image/webp';

                    const rawMetadata = getGenInfo(await fsp.readFile(item.filePath), mimeType);
                    await debugLogToFile(`Full raw metadata: ${JSON.stringify(rawMetadata, null, 2)}`, item);

                    const extracted = extractComfyMetadata(rawMetadata);
                    const result = processExtractedMetadata(extracted);
                    
                    let changed = false;
                    
                    if (chkAddTags.checked) {
                        const finalTags = item.tags ? [...item.tags] : [];
                        const finalTagSet = new Set(finalTags.map(t => t.toLowerCase()));
                        
                        const addIfChecked = (tagSet, checkbox) => {
                            if (checkbox.checked) {
                                tagSet.forEach(tag => {
                                    if (!finalTagSet.has(tag)) {
                                        finalTags.push(tag);
                                        finalTagSet.add(tag);
                                        changed = true;
                                    }
                                });
                            }
                        };

                        addIfChecked(result.categorized.checkpoints, chkCheckpoint);
                        addIfChecked(result.categorized.loras, chkLora);
                        addIfChecked(result.categorized.positive, chkPositive);
                        addIfChecked(result.categorized.negative, chkNegative);
                        
                        result.categorized.ksampler.forEach(tag => {
                            let shouldAdd = false;
                            if (tag.startsWith('seed:') && chkSeed.checked) shouldAdd = true;
                            else if (tag.startsWith('steps:') && chkSteps.checked) shouldAdd = true;
                            else if (tag.startsWith('cfg:') && chkCfg.checked) shouldAdd = true;
                            else if (tag.startsWith('sampler:') && chkSampler.checked) shouldAdd = true;
                            
                            if (shouldAdd && !finalTagSet.has(tag)) {
                                finalTags.push(tag);
                                finalTagSet.add(tag);
                                changed = true;
                            }
                        });

                        if (changed) item.tags = finalTags;
                    }

                    if (chkWriteNotes.checked && result.annotation) {
                        const currentNote = item.annotation || '';
                        if (!currentNote.includes('[Generation Info]')) {
                            item.annotation = currentNote ? (currentNote + '\n\n' + result.annotation) : result.annotation;
                            changed = true;
                        }
                    }

                    if (changed) {
                        await item.save();
                        log(t('log.success', { name: item.name }));
                    } else {
                         log(t('log.skip.allExist', { name: item.name }));
                    }

                } catch (error) {
                    log(t('log.error.generic', { name: item.name, message: error.message }));
                    console.error(error);
                }
            }
            resetButtons();

        } catch (e) {
            log(t('log.error.init', { message: e.message }));
            resetButtons();
        }
    }

    async function removePluginData() {
        try {
            const items = await eagle.item.getSelected();
            if (items.length === 0) return;
            if (!confirm(t('confirm.deleteAll', { count: items.length, defaultValue: `選択した${items.length}個のアイテムから、このプラグインが生成した可能性のある全ての情報を削除しますか？` }))) { 
                return;
            }
            
            startButton.disabled = true;
            deleteInfoButton.disabled = true;
            
            await debugLogToFile(`\n--- REMOVE DATA RUN: ${items.length} items ---`);

            for (const item of items) {
                if (isCancelled) break;
                try {
                    const ext = path.extname(item.filePath).toLowerCase();
                    let mimeType = '';
                    if (ext === '.png') mimeType = 'image/png';
                    else if (ext === '.webp') mimeType = 'image/webp';

                    const rawMetadata = getGenInfo(await fsp.readFile(item.filePath), mimeType);
                    const extracted = extractComfyMetadata(rawMetadata);
                    const { tags: tagsToRemove } = processExtractedMetadata(extracted);
                    
                    let changed = false;

                    await debugLogToFile(`Current tags: ${JSON.stringify(item.tags)}`, item);
                    await debugLogToFile(`Tags to remove: ${JSON.stringify([...tagsToRemove])}`, item);

                    if (tagsToRemove.size > 0 && item.tags && item.tags.length > 0) {
                        const originalTagCount = item.tags.length;
                        item.tags = item.tags.filter(tag => !tagsToRemove.has(tag.toLowerCase()));
                        if (item.tags.length < originalTagCount) {
                            changed = true;
                        }
                    }

                    if (item.annotation && item.annotation.includes('[Generation Info]')) {
                        item.annotation = item.annotation.substring(0, item.annotation.indexOf('[Generation Info]')).trim();
                        changed = true;
                    }

                    if (changed) {
                        await item.save();
                        log(`[${item.name}] 情報を削除しました。`);
                    } else {
                         log(`[${item.name}] 削除対象の情報は見つかりませんでした。`);
                    }
                } catch (error) {
                    log(t('log.error.generic', { name: item.name, message: error.message }));
                }
            }
            resetButtons();
        } catch (error) {
            log(t('log.error.init', { message: error.message }));
            resetButtons();
        }
    }

    function resetButtons() {
        if(!startButton || !deleteInfoButton || !cancelButton) return;
        startButton.disabled = false;
        deleteInfoButton.disabled = false;
        cancelButton.style.display = 'none';
        cancelButton.disabled = false;
    }
    
    const SETTINGS_KEY = 'comfyui-auto-tagger-settings';
    const allCheckboxes = [chkCheckpoint, chkLora, chkPositive, chkNegative, chkSeed, chkSampler, chkSteps, chkCfg, chkAddTags, chkWriteNotes];

    function saveCheckboxState() {
        const settings = {};
        allCheckboxes.forEach(chk => {
            if (chk) settings[chk.id] = chk.checked;
        });
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    function loadCheckboxState() {
        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                allCheckboxes.forEach(chk => {
                    if (chk && settings[chk.id] !== undefined) {
                        chk.checked = settings[chk.id];
                    } else if (chk) {
                        chk.checked = true;
                    }
                });
            } catch (e) {
                console.error('Failed to load settings', e);
                allCheckboxes.forEach(chk => { if(chk) chk.checked = true; });
            }
        } else {
            allCheckboxes.forEach(chk => { if(chk) chk.checked = true; });
        }
    }
    
    applyLocale();
    loadCheckboxState();
    
    startButton.addEventListener('click', () => {
        saveCheckboxState();
        startTagging();
    });
    deleteInfoButton.addEventListener('click', removePluginData);
    cancelButton.addEventListener('click', () => {
        if (!isCancelled) {
            isCancelled = true;
            cancelButton.disabled = true;
            log(t('log.cancelling'));
        }
    });

    allCheckboxes.forEach(chk => {
        chk.addEventListener('change', saveCheckboxState);
    });

    console.log("Plugin successfully initialized.");
});