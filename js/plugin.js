const fsp = require('fs').promises;
const path = require('path');
const os = require('os');

// --- 1. 画像解析 (Fast Parser) ---
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

// --- 2. ComfyUIメタデータ抽出 ---
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
            if(inputKey === 'seed' && src.inputs['seed'] !== undefined) return resolve(val[0], 'seed');
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
    const links = workflowData.links || [];
    const nodeById = {};
    nodes.forEach(n => nodeById[n.id] = n);
    
    const resolveLink = (node, inputName) => {
        const input = node.inputs?.find(i => i.name === inputName);
        if (!input || !input.link) return undefined;
        const link = links.find(l => l[0] === input.link);
        if (!link) return undefined;
        const src = nodeById[link[1]];
        return src?.widgets_values?.[0];
    };

    nodes.forEach(node => {
        const type = node.type || node.class_type || "";
        if (type.includes("CheckpointLoader") && !metadata.checkpoint && node.widgets_values) metadata.checkpoint = path.basename(node.widgets_values?.[0] || '');
        if (type.includes("KSampler")) {
            const w = node.widgets_values || [];
            if (!metadata.seed) metadata.seed = (w[0]!==undefined)?w[0]:resolveLink(node,'seed');
            if (!metadata.steps) metadata.steps = (w[2]!==undefined)?w[2]:resolveLink(node,'steps');
            if (!metadata.cfg) metadata.cfg = (w[3]!==undefined)?w[3]:resolveLink(node,'cfg');
            if (!metadata.sampler) metadata.sampler = (w[4]!==undefined)?w[4]:resolveLink(node,'sampler_name');
        }
    });
}


Promise.all([new Promise(r => eagle.onPluginCreate(r)), new Promise(r => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', r) : r())]).then(([plugin]) => {
    
    // --- 翻訳システム (Eagle標準i18next利用) ---
    function t(key, r = {}) {
        return window.i18next ? window.i18next.t(key, r) : (r.defaultValue || key);
    }
    
    async function initI18n() {
        try {
            if (!window.i18next) {
                console.error("i18next is not available. Please ensure it's loaded by Eagle.");
                return;
            }

            const appLocale = eagle.app.locale;
            const lang = (appLocale && appLocale.startsWith('ja')) ? 'ja' : 'en';
            
            const loadJson = async (filename) => {
                const filePath = path.join(plugin.path, '_locales', filename);
                try { return JSON.parse(await fsp.readFile(filePath, 'utf8')); } 
                catch (e) { console.error(`Failed to load ${filename}`, e); return {}; } 
            };
            
            await window.i18next.init({
                lng: lang,
                fallbackLng: 'en',
                resources: {
                    en: { translation: await loadJson('en.json') },
                    ja: { translation: await loadJson('ja_JP.json') }
                },
                interpolation: { escapeValue: false }
            });

            updateUILabels();

        } catch (e) {
            console.error("[i18n] Initialization failed:", e);
        }
    }

    function updateUILabels() {
        document.title = t('ui.title');
        document.querySelector('h1').textContent = t('ui.title');
        
        const labelMap = {
            'chk-checkpoint': 'ui.option.checkpoint', 'chk-lora': 'ui.option.lora',
            'chk-positive': 'ui.option.positive', 'chk-negative': 'ui.option.negative',
            'chk-seed': 'ui.option.seed', 'chk-sampler': 'ui.option.sampler',
            'chk-steps': 'ui.option.steps', 'chk-cfg': 'ui.option.cfg',
            'chk-add-tags': 'ui.option.addTags', 'chk-write-notes': 'ui.option.writeNotes',
            'chk-debug-log': 'ui.option.debugMode'
        };
        for (const [id, key] of Object.entries(labelMap)) {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) label.textContent = t(key);
        }
        
        const sectionTitles = document.querySelectorAll('.section-title');
        if(sectionTitles[0]) sectionTitles[0].textContent = t('ui.outputSettings');
        if(sectionTitles[1]) sectionTitles[1].textContent = t('ui.extractionTarget');

        document.getElementById('startButton').textContent = t('ui.button.start');
        document.getElementById('deleteInfoButton').textContent = t('ui.button.deleteInfo');
        document.getElementById('cancelButton').textContent = t('ui.button.cancel');
    }

    let isCancelled = false;
    let logBuffer = [];
    const MAX_LOG_LINES = 100;
    
    const startButton = document.getElementById('startButton');
    const deleteButton = document.getElementById('deleteInfoButton');
    const cancelButton = document.getElementById('cancelButton');
    const logArea = document.getElementById('log');
    const chunkSizeInput = document.getElementById('chunk-size');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    
    const checkboxes = {
        checkpoint: document.getElementById('chk-checkpoint'),
        lora: document.getElementById('chk-lora'),
        positive: document.getElementById('chk-positive'),
        negative: document.getElementById('chk-negative'),
        seed: document.getElementById('chk-seed'),
        sampler: document.getElementById('chk-sampler'),
        steps: document.getElementById('chk-steps'),
        cfg: document.getElementById('chk-cfg'),
        addTags: document.getElementById('chk-add-tags'),
        writeNotes: document.getElementById('chk-write-notes'),
        debug: document.getElementById('chk-debug-log')
    };

    const LOG_DIR = path.join(os.tmpdir(), 'comfyui-auto-tagger');
    let DEBUG_LOG_FILE = '';
    
    (async () => { 
        try { 
            await fsp.mkdir(LOG_DIR, { recursive: true }); 
            DEBUG_LOG_FILE = path.join(LOG_DIR, `debug-${Date.now()}.log`);
        } catch(e) { console.error(e); } 
    })();

    async function debugLog(msg, item = null) {
        if (!checkboxes.debug || !checkboxes.debug.checked) return;
        const line = `[${new Date().toISOString()}] ${item ? `[${item.name}] ` : ''}${msg}\n`;
        console.log(msg);
        try { if(DEBUG_LOG_FILE) await fsp.appendFile(DEBUG_LOG_FILE, line); } catch(e){}
    }

    function log(key, replacements={}) {
        if (!logArea) return;
        const translatedMsg = t(key, replacements);
        logBuffer.push(translatedMsg);
        if (logBuffer.length > MAX_LOG_LINES) logBuffer.shift();
        logArea.textContent = logBuffer.join('\n');
        logArea.scrollTop = logArea.scrollHeight;
    }

    function cleanPrompt(text, prefix='') {
        if (!text || typeof text !== 'string') return [];
        const tags = new Set();
        text.replace(/\n/g, ',').split(',').forEach(t => {
            const v = t.trim();
            if (v) tags.add((prefix + v).toLowerCase());
        });
        return [...tags];
    }

    function processMetadata(meta) {
        const cats = { cp: new Set(), lora: new Set(), pos: new Set(), neg: new Set(), param: new Set() };
        
        if (meta.checkpoint) cats.cp.add(path.basename(meta.checkpoint, path.extname(meta.checkpoint)).toLowerCase());
        if (meta.loras) meta.loras.forEach(l => cats.lora.add(path.basename(l, path.extname(l)).toLowerCase()));
        if (meta.positive) cleanPrompt(meta.positive).forEach(t => cats.pos.add(t));
        if (meta.negative) cleanPrompt(meta.negative, 'neg:').forEach(t => cats.neg.add(t));
        
        if (meta.seed !== undefined) cats.param.add(`seed:${meta.seed}`);
        if (meta.steps !== undefined) cats.param.add(`steps:${meta.steps}`);
        if (meta.cfg !== undefined) cats.param.add(`cfg:${Number(meta.cfg).toFixed(2)}`);
        if (meta.sampler) cats.param.add(`sampler:${String(meta.sampler).toLowerCase()}`);

        const allTags = new Set([...cats.cp, ...cats.lora, ...cats.pos, ...cats.neg, ...cats.param]);
        
        let lines = ['[Generation Info]'];
        if (checkboxes.checkpoint.checked && meta.checkpoint) lines.push(`${t('ui.option.checkpoint')}: ${path.basename(meta.checkpoint, path.extname(meta.checkpoint))}`);
        if (checkboxes.lora.checked && meta.loras) lines.push(`${t('ui.option.lora')}: ${meta.loras.map(l=>path.basename(l,path.extname(l))).join(', ')}`);
        
        let p = [];
        if (checkboxes.steps.checked && meta.steps) p.push(`${t('ui.option.steps')}: ${meta.steps}`);
        if (checkboxes.cfg.checked && meta.cfg) p.push(`CFG: ${Number(meta.cfg).toFixed(1)}`);
        if (checkboxes.sampler.checked && meta.sampler) p.push(`Sampler: ${meta.sampler}`);
        if (checkboxes.seed.checked && meta.seed !== undefined) lines.push(`Seed: ${meta.seed}`);
        if (p.length) lines.push(p.join(' | '));
        
        if (checkboxes.positive.checked && meta.positive) lines.push(`\n[${t('ui.option.positive')}]\n${meta.positive}`);
        if (checkboxes.negative.checked && meta.negative) lines.push(`\n[${t('ui.option.negative')}]\n${meta.negative}`);
        
        return { tags: allTags, cats, annotation: lines.length > 1 ? lines.join('\n') : '' };
    }

    // --- CHUNK PROCESSING LOGIC ---
    async function processItemsInChunks(items, processFn) {
        const chunkSize = parseInt(chunkSizeInput.value, 10) || 5;
        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        let processedCount = 0;

        progressContainer.style.display = 'block';
        updateProgress(0, items.length);

        for (let i = 0; i < items.length; i += chunkSize) {
            if (isCancelled) break;
            const chunk = items.slice(i, i + chunkSize);
            
            const results = await Promise.allSettled(chunk.map(item => processFn(item)));

            results.forEach(result => {
                processedCount++;
                if (result.status === 'fulfilled') {
                    const status = result.value;
                    if (status === 'success') successCount++;
                    else if (status === 'skipped') skippedCount++;
                    else {
                        skippedCount++;
                    }
                } else {
                    errorCount++;
                }
            });
            updateProgress(processedCount, items.length);
        }
        return { successCount, errorCount, skippedCount };
    }
    
    function updateProgress(current, total) {
        const percentage = total > 0 ? (current / total) * 100 : 0;
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${current} / ${total}`;
    }


    async function startTagging() {
        startButton.disabled = true; deleteButton.disabled = true; cancelButton.style.display = 'inline-block';
        isCancelled = false;
        logBuffer = []; // ここでログバッファをクリア
        log('log.start');
        
        try {
            const items = await eagle.item.getSelected();
            if (!items.length) { log('log.noItemSelected'); resetUI(); return; }
            
            log('log.processingItems', { count: items.length });
            if (checkboxes.debug.checked) log(`[Debug] Log file: ${DEBUG_LOG_FILE}`);
            await debugLog(`START: ${items.length} items`);

            const processSingleItem = async (item) => {
                log('log.processingItem', {name: item.name}); // 個別の処理中ログ
                try {
                    const ext = path.extname(item.filePath).toLowerCase();
                    const mime = (ext === '.png') ? 'image/png' : (ext === '.webp') ? 'image/webp' : '';
                    
                    const raw = getGenInfo(await fsp.readFile(item.filePath), mime);
                    await debugLog(`Raw: ${JSON.stringify(raw)}`, item);
                    
                    const meta = extractComfyMetadata(raw);
                    const res = processMetadata(meta);
                    
                    let changed = false;
                    if (checkboxes.addTags.checked && res.tags.size > 0) {
                        const currentTags = new Set((item.tags || []).map(t => t.toLowerCase()));
                        const tagsToAdd = [];
                        
                        const addIfChecked = (set, chk) => {
                            if(chk.checked) set.forEach(t => { if(!currentTags.has(t)) tagsToAdd.push(t); });
                        };
                        addIfChecked(res.cats.cp, checkboxes.checkpoint);
                        addIfChecked(res.cats.lora, checkboxes.lora);
                        addIfChecked(res.cats.pos, checkboxes.positive);
                        addIfChecked(res.cats.neg, checkboxes.negative);
                        
                        res.cats.param.forEach(t => {
                            let ok = false;
                            if(t.startsWith('seed:') && checkboxes.seed.checked) ok=true;
                            else if(t.startsWith('steps:') && checkboxes.steps.checked) ok=true;
                            else if(t.startsWith('cfg:') && checkboxes.cfg.checked) ok=true;
                            else if(t.startsWith('sampler:') && checkboxes.sampler.checked) ok=true;
                            if(ok && !currentTags.has(t)) tagsToAdd.push(t);
                        });

                        if (tagsToAdd.length > 0) {
                            item.tags = [...(item.tags || []), ...tagsToAdd];
                            changed = true;
                        }
                    }
                    
                    if (checkboxes.writeNotes.checked) {
                        const currentAnnotation = item.annotation || '';
                        const genInfoBlock = res.annotation;
                        
                        if (genInfoBlock) {
                            const genInfoMarker = '[Generation Info]';
                            const markerIndex = currentAnnotation.indexOf(genInfoMarker);

                            let newAnnotation;

                            if (markerIndex !== -1) {
                                const userText = currentAnnotation.substring(0, markerIndex).trim();
                                newAnnotation = userText ? `${userText}\n\n${genInfoBlock}` : genInfoBlock;
                            } else {
                                newAnnotation = currentAnnotation ? `${currentAnnotation}\n\n${genInfoBlock}` : genInfoBlock;
                            }

                            if (newAnnotation !== currentAnnotation) {
                                item.annotation = newAnnotation;
                                changed = true;
                            }
                        }
                    }
                    
                    if(changed) { await item.save(); log('log.success', {name:item.name}); return 'success'; } 
                    else { log('log.skip', {name:item.name}); return 'skipped'; }
                } catch (e) {
                    log('log.error.generic', { name: item.name, message: e.message });
                    await debugLog(e.stack, item);
                    throw e; // Re-throw to be caught by Promise.allSettled
                }
            };

            const { successCount, errorCount, skippedCount } = await processItemsInChunks(items, processSingleItem);

            if(isCancelled) log('log.cancelled', { successCount, skippedCount, errorCount });
            else log('log.completed', { successCount, skippedCount, errorCount });

        } catch(e) { log('log.error.init', { message: e.message }); }
        resetUI();
    }

    async function removeInfo() {
        startButton.disabled = true; deleteButton.disabled = true; cancelButton.style.display = 'inline-block';
        isCancelled = false; // キャンセル状態をリセット
        logBuffer = []; // ログバッファをクリア
        log('log.delete.start'); // 削除開始ログ

        const items = await eagle.item.getSelected();
        if(!items.length || !confirm(t('confirm.deleteAll', {count:items.length}))) {
            resetUI();
            return;
        }
        
        await debugLog(`REMOVE: ${items.length} items`);

        const processSingleItem = async (item) => {
            if (isCancelled) return 'skipped';
            try {
                log('log.processingItem', {name: item.name}); // 個別の処理中ログ
                const ext = path.extname(item.filePath).toLowerCase();
                const mime = (ext === '.png') ? 'image/png' : (ext === '.webp') ? 'image/webp' : '';
                const raw = getGenInfo(await fsp.readFile(item.filePath), mime);
                const meta = extractComfyMetadata(raw);
                const { tags: removeTags } = processMetadata(meta);
                
                let changed = false;
                if(item.tags && item.tags.length) {
                    const before = item.tags.length;
                    item.tags = item.tags.filter(t => !removeTags.has(t.toLowerCase()));
                    if(item.tags.length < before) changed = true;
                }
                if(item.annotation && item.annotation.includes('[Generation Info]')) {
                    item.annotation = item.annotation.substring(0, item.annotation.indexOf('[Generation Info]')).trim();
                    changed = true;
                }
                if(changed) { await item.save(); log('log.delete.removing', {name: item.name, count: removeTags.size}); return 'success'; } 
                else { log('log.delete.noneFound', {name: item.name}); return 'skipped'; }
            } catch(e) {
                log('log.error.generic', { name: item.name, message: e.message });
                throw e; // Re-throw
            }
        };
        
        const { successCount, errorCount, skippedCount } = await processItemsInChunks(items, processSingleItem);
        
        if(isCancelled) log('log.delete.cancelledMessage', { removedCount: successCount, skippedCount, errorCount });
        else log('log.delete.completed', { removedCount: successCount, skippedCount, errorCount });

        resetUI();
    }

    function resetUI() {
        startButton.disabled = false; deleteButton.disabled = false; cancelButton.style.display = 'none';
        cancelButton.disabled = false;
        progressContainer.style.display = 'none'; // Hide progress bar on reset
        updateProgress(0, 0); // Reset progress bar text
    }

    const SETTINGS_KEY = 'comfyui-auto-tagger-settings';
    function saveSettings() {
        const s = {};
        for(const k in checkboxes) if(checkboxes[k]) s[k] = checkboxes[k].checked;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    }
    function loadSettings() {
        try {
            const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
            if(s) for(const k in checkboxes) if(checkboxes[k] && s[k] !== undefined) checkboxes[k].checked = s[k];
        } catch(e){}
    }

    (async () => { 
        if (typeof eagle !== 'undefined') {
            eagle.onThemeChanged((theme) => {
                document.documentElement.setAttribute('data-theme', theme);
                document.body.setAttribute('data-theme', theme);
            });
            const currentTheme = eagle.app.theme;
            document.documentElement.setAttribute('data-theme', currentTheme);
            document.body.setAttribute('data-theme', currentTheme);
        }

        await initI18n();
        loadSettings();
    })();

    startButton.onclick = () => { saveSettings(); startTagging(); };
    deleteButton.onclick = removeInfo;
    cancelButton.onclick = () => { if(!isCancelled) { isCancelled=true; cancelButton.disabled=true; log('log.cancelling'); }};
    for(const k in checkboxes) if(checkboxes[k]) checkboxes[k].onchange = saveSettings;

    console.log("Initialized.");
});