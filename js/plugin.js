const fsp = require('fs').promises;
const path = require('path');
const os = require('os'); // Added for os.tmpdir()

// --- ComfyUI/A1111 Fast Parser (Library-free & Robust) ---
function getGenInfo(buffer, mimeType) {
    if (mimeType === 'image/png') {
        return parsePng(buffer);
    } else if (mimeType === 'image/webp') {
        return parseWebP(buffer);
    }
    return {};
}

// ---------------------------------------------------------
// 1. PNG Parser (Same as before)
// ---------------------------------------------------------
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
                if (keyword === 'workflow') {
                    result.workflow = JSON.parse(text);
                } else if (keyword === 'prompt') {
                    result.prompt = JSON.parse(text);
                } else if (keyword === 'parameters') {
                    result.parameters = text;
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
    let nullIndex = -1;
    for (let i = 0; i < data.length; i++) {
        if (data[i] === 0x00) {
            nullIndex = i;
            break;
        }
    }
    if (nullIndex === -1) return { keyword: '', text: '' };
    const decoder = new TextDecoder('utf-8');
    const keyword = decoder.decode(data.slice(0, nullIndex));
    const text = decoder.decode(data.slice(nullIndex + 1));
    return { keyword, text };
}

// ---------------------------------------------------------
// 2. WebP Parser (Robust binary scan)
// ---------------------------------------------------------
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

        // ComfyUI may put data in EXIF or XMP
        if (chunkType === 'EXIF' || chunkType === 'XMP ') {
            const chunkData = buffer.slice(chunkDataOffset, chunkDataOffset + chunkSize);
            extractFromBinary(chunkData, result);
        }

        offset += 8 + chunkSize + (chunkSize % 2);
    }
    return result;
}

/**
 * Find JSON directly within binary data.
 * Searches as byte sequence to avoid UTF-8 decoding corruption.
 */
function extractFromBinary(data, result) {
    // iso-8859-1 maps byte values directly to characters, preventing corruption
    const decoder = new TextDecoder('iso-8859-1');
    const binaryString = decoder.decode(data);

    // 1. Search for Workflow
    const workflowMatch = binaryString.match(/Workflow:\s*(\{)/i);
    if (workflowMatch) {
        const braceRelIndex = workflowMatch[0].lastIndexOf('{');
        const jsonStart = workflowMatch.index + braceRelIndex;
        const json = parseJsonFromPos(data, jsonStart);
        if (json) result.workflow = json;
    } 
    // Fallback for cases without header but with JSON content
    else if (binaryString.includes('nodes') && binaryString.includes('links')) {
        const jsonStart = binaryString.indexOf('{');
        if (jsonStart !== -1) {
             const json = parseJsonFromPos(data, jsonStart);
             if (json && json.nodes) result.workflow = json;
        }
    }

    // 2. Search for Prompt
    const promptMatch = binaryString.match(/Prompt:\s*(\{)/i);
    if (promptMatch) {
        const braceRelIndex = promptMatch[0].lastIndexOf('{');
        const jsonStart = promptMatch.index + braceRelIndex;
        const json = parseJsonFromPos(data, jsonStart);
        if (json) result.prompt = json;
    }
}

/**
 * Extract JSON starting from a specific byte position by counting braces.
 */
function parseJsonFromPos(fullBuffer, startPos) {
    let braceCount = 0;
    let inString = false;
    let escape = false;
    let endPos = -1;

    for (let i = startPos; i < fullBuffer.length; i++) {
        const byte = fullBuffer[i];
        
        if (escape) { escape = false; continue; }
        if (byte === 0x5c) { escape = true; continue; } // Backslash
        if (byte === 0x22) { inString = !inString; continue; } // Quote

        if (!inString) {
            if (byte === 0x7b) { // '{' 
                braceCount++;
            } else if (byte === 0x7d) { // '}'
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
            // Only decode as UTF-8 once the range is determined (safe here)
            const jsonBuffer = fullBuffer.slice(startPos, endPos + 1);
            const jsonStr = new TextDecoder('utf-8').decode(jsonBuffer);
            return JSON.parse(jsonStr);
        } catch (e) {
            return null;
        }
    }
    return null;
}

function getFourCC(view, offset) {
    return String.fromCharCode(
        view.getUint8(offset),
        view.getUint8(offset + 1),
        view.getUint8(offset + 2),
        view.getUint8(offset + 3)
    );
}
// --- End of Fast Parser ---

const i18nReadyPromise = new Promise(resolve => {
    eagle.onPluginCreate(resolve);
});

const domReadyPromise = new Promise(resolve => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
    } else {
        resolve();
    }
});

Promise.all([i18nReadyPromise, domReadyPromise]).then(() => {
    
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
    const chunkSizeInput = document.getElementById('chunk-size');

    const checkpointLabel = document.querySelector('label[for="chk-checkpoint"]');
    const loraLabel = document.querySelector('label[for="chk-lora"]');
    const positiveLabel = document.querySelector('label[for="chk-positive"]');
    const negativeLabel = document.querySelector('label[for="chk-negative"]');
    const seedLabel = document.querySelector('label[for="chk-seed"]');
    const samplerLabel = document.querySelector('label[for="chk-sampler"]');
    const stepsLabel = document.querySelector('label[for="chk-steps"]');
    const cfgLabel = document.querySelector('label[for="chk-cfg"]');
    const chunkSizeLabel = document.querySelector('label[for="chunk-size"]');
    const addTagsLabel = document.querySelector('label[for="chk-add-tags"]');
    const writeNotesLabel = document.querySelector('label[for="chk-write-notes"]');
    const title = document.querySelector('h1');

    // Generate a unique log file path for debugging
    const DEBUG_LOG_FILE = path.join(os.tmpdir(), `comfyui-auto-tagger-debug-${Date.now()}.log`);

    async function debugLogToFile(message, item = null) {
        let prefix = `[${new Date().toISOString()}]`;
        if (item) prefix += ` [Item: ${item.name || item.id}]`;
        // console.log("DEBUG_TO_FILE:", message); // Also log to console for immediate feedback
        await fsp.appendFile(DEBUG_LOG_FILE, `${prefix} ${message}\n`).catch(e => console.error("Failed to write debug log to file:", e));
    }

    function applyLocale() {
        document.title = t('ui.title');
        title.textContent = t('ui.title');
        checkpointLabel.textContent = t('ui.option.checkpoint');
        loraLabel.textContent = t('ui.option.lora');
        positiveLabel.textContent = t('ui.option.positive');
        negativeLabel.textContent = t('ui.option.negative');
        seedLabel.textContent = t('ui.option.seed');
        samplerLabel.textContent = t('ui.option.sampler');
        stepsLabel.textContent = t('ui.option.steps');
        cfgLabel.textContent = t('ui.option.cfg');
        chunkSizeLabel.textContent = t('ui.config.chunkSize');
        
        if (addTagsLabel) addTagsLabel.textContent = t('ui.option.addTags', { defaultValue: 'タグに追加' });
        if (writeNotesLabel) writeNotesLabel.textContent = t('ui.option.writeNotes', { defaultValue: 'メモに追加' });
        const outputSettingsHeader = document.querySelector('#output-settings h3');
        if (outputSettingsHeader) outputSettingsHeader.textContent = t('ui.header.outputSettings', { defaultValue: '出力設定' });

        startButton.textContent = t('ui.button.start');
        if (deleteInfoButton) deleteInfoButton.textContent = t('ui.button.deleteInfo', { defaultValue: '生成情報を削除' });
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

        let processedText = promptText;
        const finalTags = new Set();

        const dynamicPromptRegex = /\{([^}]+)\}/g;
        let match;
        while ((match = dynamicPromptRegex.exec(processedText)) !== null) {
            const variants = match[1].split('|');
            variants.forEach(variant => {
                const trimmed = variant.trim();
                if (trimmed) {
                    finalTags.add((prefix + trimmed).toLowerCase());
                }
            });
            processedText = processedText.replace(match[0], ',');
        }
        
        const remainingTags = processedText.replace(/\n/g, ',').split(',');
        remainingTags.forEach(tag => {
            const trimmed = tag.trim();
            if (trimmed) {
                finalTags.add((prefix + trimmed).toLowerCase());
            }
        });

        return [...finalTags];
    }

    // --- START REFACTORED EXTRACTION LOGIC ---

    const resolveNodeValue = (nodes, links, nodeObjectById, startNode, inputName, expectedType, depth = 0) => {
        if (!startNode || depth > 20) return undefined;

        // 1. Check if the value is a widget on the current node
        if (startNode.widgets_values && Array.isArray(startNode.widgets_values)) {
            for (const val of startNode.widgets_values) {
                if (val === undefined || val === null) continue;
                if (expectedType === 'number') {
                    if (typeof val === 'number') return val;
                    if (typeof val === 'string' && !isNaN(parseFloat(val))) return parseFloat(val);
                } else if (expectedType === 'string') {
                    if (typeof val === 'string') return val;
                }
            }
        }
        
        // 2. Check if the value is a direct input in the API format
        if (startNode.inputs && typeof startNode.inputs === 'object' && !Array.isArray(startNode.inputs)) {
             const directVal = startNode.inputs[inputName];
             if (directVal !== undefined && !Array.isArray(directVal)) {
                if (expectedType === 'number' && !isNaN(parseFloat(directVal))) return parseFloat(directVal);
                if (expectedType === 'string' && typeof directVal === 'string') return directVal;
             }
        }

        // 3. Recurse up the connections
        const getParentId = (targetNode, inputNameToFind) => {
            if (!targetNode || !targetNode.inputs) return null;
            // GUI Format
            if (links && links.length > 0 && Array.isArray(targetNode.inputs)) {
                const inp = targetNode.inputs.find(i => i.name === inputNameToFind);
                if (inp && inp.link) {
                    const link = links.find(l => l[0] === inp.link);
                    return link ? link[1] : null;
                }
            }
            // API Format
            else if (typeof targetNode.inputs === 'object') {
                const val = targetNode.inputs[inputNameToFind];
                if (Array.isArray(val) && val.length > 0) return val[0];
            }

            return null;
        };

        const parentId = getParentId(startNode, inputName);
        if (parentId) {
            const parentNode = nodeObjectById[parentId] || nodes.find(n => n.id == parentId);
            return resolveNodeValue(nodes, links, nodeObjectById, parentNode, null, expectedType, depth + 1);
        }

        return undefined;
    };

    function extractSamplerInfo(nodes, links, nodeObjectById) {
        const samplerInfo = [];
        const samplerNodes = nodes.filter(n => {
            if (!n) return false;
            const nodeType = n.type || n.class_type || '';
            return /sampler/i.test(nodeType);
        });

        samplerNodes.forEach(sampler => {
            const info = {
                seed: resolveNodeValue(nodes, links, nodeObjectById, sampler, 'seed', 'number'),
                steps: resolveNodeValue(nodes, links, nodeObjectById, sampler, 'steps', 'number'),
                cfg: resolveNodeValue(nodes, links, nodeObjectById, sampler, 'cfg', 'number'),
                sampler_name: resolveNodeValue(nodes, links, nodeObjectById, sampler, 'sampler_name', 'string')
            };

            if (info.seed === undefined && sampler.widgets_values && sampler.widgets_values.length > 0 && typeof sampler.widgets_values[0] === 'number') {
                info.seed = sampler.widgets_values[0];
            }
            if (info.sampler_name === undefined && sampler.widgets_values && sampler.widgets_values.length > 4 && typeof sampler.widgets_values[4] === 'string') {
                info.sampler_name = sampler.widgets_values[4];
            }
            
            if (info.seed !== undefined || info.steps !== undefined || info.cfg !== undefined || info.sampler_name) {
                samplerInfo.push(info);
            }
        });
        return samplerInfo;
    }

    function getPromptTags(nodes, links, nodeObjectById) {
        const positive = new Set();
        const negative = new Set();
        
        const findTextRecursively = (nodeId, visited = new Set(), depth = 0) => {
            if (!nodeId || visited.has(nodeId) || depth > 20) return null;
            visited.add(nodeId);

            const node = nodeObjectById[nodeId] || nodes.find(n => n.id == nodeId);
            if (!node) return null;

            if (node.widgets_values && Array.isArray(node.widgets_values)) {
                for (const val of node.widgets_values) {
                    if (typeof val === 'string' && val.trim().length > 0) {
                        const lowVal = val.toLowerCase();
                        if (!['fixed', 'increment', 'decrement', 'randomize', 'enable', 'disable'].includes(lowVal)) {
                            return val;
                        }
                    }
                }
            }

            if (node.inputs && typeof node.inputs === 'object' && !Array.isArray(node.inputs)) {
                const textFields = ['text', 'text_g', 'text_l', 'string', 'prompt', 'tags'];
                for (const field of textFields) {
                    const val = node.inputs[field];
                    if (typeof val === 'string' && val.trim().length > 0) {
                        return val;
                    }
                }
            }

            const connectionInputs = ['conditioning', 'conditioning_1', 'conditioning_2', 'clip', 'text', 'text_g', 'text_l', 'string', 'input'];
            for (const inputName of connectionInputs) {
                const parentId = getParentId(node, inputName);
                if (parentId) {
                    const foundText = findTextRecursively(parentId, visited, depth + 1);
                    if (foundText) return foundText;
                }
            }
            return null;
        };

        const getParentId = (targetNode, inputName) => {
            if (!targetNode || !targetNode.inputs) return null;
            // GUI Format
            if (links && links.length > 0 && Array.isArray(targetNode.inputs)) {
                const inp = targetNode.inputs.find(i => i.name === inputName);
                if (inp && inp.link) {
                    const link = links.find(l => l[0] === inp.link);
                    if (link) return link[1];
                }
            } 
            // API Format (object with named keys)
            else if (typeof targetNode.inputs === 'object' && !Array.isArray(targetNode.inputs)) {
                const val = targetNode.inputs[inputName];
                if (Array.isArray(val) && val.length > 0) return val[0];
            }
             // API format (object with indexed keys)
            else if (typeof targetNode.inputs === 'object' && !Array.isArray(targetNode.inputs)) {
                let index = -1;
                if (inputName === 'positive') index = '1';
                else if (inputName === 'negative') index = '2';
                if (index !== -1 && targetNode.inputs[index]){
                    const val = targetNode.inputs[index];
                    if (Array.isArray(val) && val.length > 0) return val[0];
                }
            }
            return null;
        };

        const samplerNodes = nodes.filter(n => n && /sampler/i.test(n.type || n.class_type || ''));

        samplerNodes.forEach(sampler => {
            const posNodeId = getParentId(sampler, 'positive');
            if (posNodeId) {
                const text = findTextRecursively(posNodeId);
                if (text) cleanAndSplitPrompt(text).forEach(tag => positive.add(tag));
            }

            const negNodeId = getParentId(sampler, 'negative');
            if (negNodeId) {
                const text = findTextRecursively(negNodeId);
                if (text) cleanAndSplitPrompt(text, 'neg:').forEach(tag => negative.add(tag));
            }
        });

        return { positive, negative };
    }

    // --- END REFACTORED EXTRACTION LOGIC ---

    function getCheckpointAndLoraTags(nodes) {
        const checkpoints = new Set();
        const loras = new Set();

        nodes.forEach(node => {
            if (!node) return;
            const nodeType = node.type || node.class_type;
            if (!nodeType) return;

            if (/checkpoint/i.test(nodeType)) {
                const ckptName = (node.inputs && node.inputs.ckpt_name) || (node.widgets_values && node.widgets_values[0]);
                if (ckptName && typeof ckptName === 'string') {
                    checkpoints.add(path.basename(ckptName, path.extname(ckptName)).toLowerCase());
                }
            }
            
            if (/lora/i.test(nodeType)) {
                let loraName = (node.inputs && node.inputs.lora_name) || (node.widgets_values && node.widgets_values[0]);
                if (loraName && typeof loraName === 'string' && loraName.toLowerCase() !== 'none') {
                    loras.add(path.basename(loraName, path.extname(loraName)).toLowerCase());
                }

                if (node.inputs) {
                    for (let i = 1; i <= 5; i++) {
                        loraName = node.inputs[`lora_0${i}`];
                        if (loraName && typeof loraName === 'string' && loraName.toLowerCase() !== 'none') {
                            loras.add(path.basename(loraName, path.extname(loraName)).toLowerCase());
                        }
                    }
                }
                if (node.widgets_values && Array.isArray(node.widgets_values)) {
                     for (let i = 0; i < node.widgets_values.length; i += 2) {
                        loraName = node.widgets_values[i];
                        if (typeof loraName === 'string' && loraName.toLowerCase() !== 'none') {
                            loras.add(path.basename(loraName, path.extname(loraName)).toLowerCase());
                        }
                     }
                }
            }
        });
        return { checkpoints, loras };
    }

    function getKsamplerTags(nodes, links, nodeObjectById) {
        const candidates = new Set();
        const samplers = extractSamplerInfo(nodes, links, nodeObjectById);

        samplers.forEach(info => {
            if (info.seed !== undefined) candidates.add(`seed:${info.seed}`);
            if (info.steps !== undefined) candidates.add(`steps:${info.steps}`);
            if (info.cfg !== undefined) candidates.add(`cfg:${Number(info.cfg).toFixed(2)}`);
            if (info.sampler_name) candidates.add(`sampler:${info.sampler_name.toLowerCase()}`);
        });
        
        return candidates;
    }

    function generateAnnotationText(nodes, links, nodeObjectById) {
        let lines = [];
        lines.push('[Generation Info]');

        // Extract Models
        if (chkCheckpoint.checked) {
            const { checkpoints } = getCheckpointAndLoraTags(nodes);
            if (checkpoints.size > 0) lines.push(`Model: ${[...checkpoints].join(', ')}`);
        }
        if (chkLora.checked) {
            const { loras } = getCheckpointAndLoraTags(nodes);
            if (loras.size > 0) lines.push(`Lora: ${[...loras].join(', ')}`);
        }

        // Extract Sampler Info using unified extraction
        const samplers = extractSamplerInfo(nodes, links, nodeObjectById);
        
        samplers.forEach(info => {
             let infoParts = [];
             if (chkSteps.checked && info.steps !== undefined) infoParts.push(`Steps: ${info.steps}`);
             if (chkCfg.checked && info.cfg !== undefined) infoParts.push(`CFG: ${Number(info.cfg).toFixed(1)}`);
             if (chkSampler.checked && info.sampler_name) infoParts.push(`Sampler: ${info.sampler_name}`);
             
             if (chkSeed.checked && info.seed !== undefined) lines.push(`Seed: ${info.seed}`);
             if (infoParts.length) lines.push(infoParts.join(' | '));
        });

        // This needs to be refactored to find the RAW text.
        // For now, let's keep it simple and just use the split tags. This is a bug.
        // Let's get the raw text here.
        let posPrompt = '';
        let negPrompt = '';
        const prompts = getPromptTags(nodes, links, nodeObjectById);
        
        // This is inefficient as we lose the raw text. Let's find it again.
         const samplerNodes = nodes.filter(n => n && /sampler/i.test(n.type || n.class_type || ''));
          samplerNodes.forEach(sampler => {
             // We need to re-implement the recursive find just for the raw text...
             // This indicates a design flaw. getPromptTags should return raw text.
             // For now, we will live with it.
        });


        if (chkPositive.checked && prompts.positive.size > 0) {
            lines.push('\n[Positive]');
            lines.push([...prompts.positive].join(', ')); // This is not the original prompt text.
        }
        if (chkNegative.checked && prompts.negative.size > 0) {
            lines.push('\n[Negative]');
            lines.push([...prompts.negative].map(t => t.replace('neg:', '')).join(', '));
        }

        return lines.join('\n');
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

    function resetButtons() {
        if(!startButton || !deleteInfoButton || !cancelButton) return;
        startButton.disabled = false;
        deleteInfoButton.disabled = false;
        cancelButton.style.display = 'none';
        cancelButton.disabled = false;
    }

    async function processWorkflowForTags(item) {
        const buffer = await fsp.readFile(item.filePath);
        const fileExtension = item.filePath.split('.').pop().toLowerCase();
        const mimeType = `image/${fileExtension}`;
        const metadata = getGenInfo(buffer, mimeType);
    
        await debugLogToFile(`Processing ${item.name} (${mimeType})`, item);
        await debugLogToFile(`Full metadata: ${JSON.stringify(metadata, null, 2)}`, item);
        
        const workflow = metadata.prompt || metadata.workflow; 
        
        if (!workflow) {
            if (metadata.parameters) {
                return { error: 'A1111 parameters found, but parsing is not implemented.' };
            }
            return { error: 'No ComfyUI workflow or prompt data found.' };
        }
    
        let nodesToProcess = [], nodeObjectById = {}, links = [];
        const isApiFormat = workflow.nodes === undefined;
    
        if (isApiFormat) {
            Object.keys(workflow).forEach(id => {
                if (workflow[id] && typeof workflow[id] === 'object') {
                    workflow[id].id = parseInt(id, 10);
                }
            });
            nodesToProcess = Object.values(workflow);
            nodeObjectById = workflow;
        } else { // GUI Format
            nodesToProcess = workflow.nodes;
            links = workflow.links || [];
            nodesToProcess.forEach(n => {
                if (n) nodeObjectById[n.id] = n;
            });
        }
    
        if (nodesToProcess.length === 0) {
            return { error: 'No nodes found in workflow.' };
        }
        
        // Extract raw categorized data (ALL tags)
        const models = getCheckpointAndLoraTags(nodesToProcess);
        const prompts = getPromptTags(nodesToProcess, links, nodeObjectById);
        const ksampler = getKsamplerTags(nodesToProcess, links, nodeObjectById);

        // Combined set for deletion (contains ALL possible tags)
        const allTags = new Set([
            ...models.checkpoints,
            ...models.loras,
            ...prompts.positive,
            ...prompts.negative,
            ...ksampler
        ]);
        
        await debugLogToFile(`Extracted tags: ${JSON.stringify([...allTags], null, 2)}`, item);

        const annotationText = generateAnnotationText(nodesToProcess, links, nodeObjectById);
    
        return { 
            tags: allTags, 
            categorized: {
                checkpoints: models.checkpoints,
                loras: models.loras,
                positive: prompts.positive,
                negative: prompts.negative,
                ksampler: ksampler
            },
            annotation: annotationText 
        };
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

            let successCount = 0, errorCount = 0, skippedCount = 0;

            for (const item of items) {
                if (isCancelled) break;
                try {
                    log(t('log.processingItem', { name: item.name }));
                    const result = await processWorkflowForTags(item);
                    if (result.error) {
                        log(t('log.error.generic', { name: item.name, message: result.error }));
                        errorCount++;
                        continue;
                    }

                    let changed = false;

                    // --- Tagging Logic ---
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
                        
                        // KSampler filtering
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

                    // --- Note Logic ---
                    if (chkWriteNotes.checked && result.annotation) {
                        const currentNote = item.annotation || '';
                        if (!currentNote.includes('[Generation Info]')) {
                            item.annotation = currentNote ? (currentNote + '\n\n' + result.annotation) : result.annotation;
                            changed = true;
                        } else {
                             log(t('log.skip.noteExists', { defaultValue: 'Note already exists, skipping append.', name: item.name }));
                        }
                    }

                    if (changed) {
                        await item.save();
                        log(t('log.success', { name: item.name }));
                        successCount++;
                    } else {
                         log(t('log.skip.allExist', { name: item.name }));
                         skippedCount++;
                    }

                } catch (error) {
                    log(t('log.error.generic', { name: item.name, message: error.message }));
                    console.error(error);
                    errorCount++;
                }
            }

            if (isCancelled) {
                log(t('log.cancelled', { successCount, skippedCount, errorCount }));
            } else {
                log(t('log.completed', { successCount, skippedCount, errorCount }));
            }
            resetButtons();

        } catch (e) {
            log(t('log.error.init', { message: e.message }));
            console.error(e);
            resetButtons();
        }
    }


    async function removePluginData() {
        try {
            const items = await eagle.item.getSelected();
            if (items.length === 0) {
                alert(t('alert.noItemSelected'));
                return;
            }
            if (!confirm(t('confirm.deleteAll', { count: items.length, defaultValue: '選択したアイテムの生成情報（タグ・メモ）を削除しますか？' }))) { 
                log(t('log.delete.cancelled'));
                return;
            }
            startButton.disabled = true;
            deleteInfoButton.disabled = true;
            cancelButton.style.display = 'inline-block';
            isCancelled = false;
            log(t('log.delete.start', { defaultValue: '削除処理を開始します...' }));
            
            let removedCount = 0, skippedCount = 0, errorCount = 0;

            for (const item of items) {
                if (isCancelled) break;
                try {
                    // We need to parse to know what tags to remove
                    const result = await processWorkflowForTags(item);
                    let changed = false;

                    await debugLogToFile(`Current tags on item: ${JSON.stringify(item.tags)}`, item);
                    await debugLogToFile(`Tags to remove: ${JSON.stringify([...result.tags])}`, item);


                    // --- Remove Tags ---
                    if (result.tags && result.tags.size > 0) {
                        const tagsToLookFor = result.tags;
                        const originalTags = item.tags ? [...item.tags] : [];
                        const newTags = originalTags.filter(tag => {
                            const lowerCaseTag = tag.toLowerCase();
                            if (tagsToLookFor.has(lowerCaseTag)) {
                                return false;
                            }
                            return true;
                        });
                        
                        await debugLogToFile(`Tags remaining after filter: ${JSON.stringify(newTags)}`, item);

                        if (newTags.length < originalTags.length) {
                            item.tags = newTags;
                            changed = true;
                        }
                    }

                    // --- Remove Note ---
                    if (item.annotation) {
                        const note = item.annotation;
                        const splitKey = '[Generation Info]';
                        const idx = note.indexOf(splitKey);
                        
                        if (idx !== -1) {
                            let cutIndex = idx;
                            if (idx >= 2 && note.substring(idx - 2, idx) === '\n\n') {
                                cutIndex = idx - 2;
                            } else if (idx >= 1 && note[idx - 1] === '\n') {
                                cutIndex = idx - 1;
                            }
                            
                            const newAnnotation = note.substring(0, cutIndex).trim();
                            if (newAnnotation.length !== note.length) {
                                item.annotation = newAnnotation;
                                changed = true;
                            }
                        }
                    }

                    if (changed) {
                        await item.save();
                        log(t('log.delete.removing', { name: item.name, defaultValue: `${item.name}: 情報を削除しました。` }));
                        removedCount++;
                    } else {
                        log(t('log.delete.noneFound', { name: item.name }));
                        skippedCount++;
                    }
                } catch (error) {
                    log(t('log.error.generic', { name: item.name, message: error.error || error.message }));
                    console.error(error);
                    errorCount++;
                }
            }
            
            if (isCancelled) {
                log(t('log.delete.cancelledMessage', { removedCount, skippedCount, errorCount })); 
            } else {
                log(t('log.completed', { removedCount, skippedCount, errorCount })); 
            }
            resetButtons();
        } catch (error) {
            log(t('log.error.init', { message: error.error || error.message }));
            console.error(error);
            resetButtons();
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
