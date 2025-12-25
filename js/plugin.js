const fsp = require('fs').promises;
const path = require('path');
let ExifReader;
let isExifReaderLoaded = true;

try {
    ExifReader = require('exifreader');
} catch (error) {
    try {
        ExifReader = require('../node_modules/exifreader');
    } catch (e) {
        console.error('Failed to load exifreader.', e);
        alert('Fatal Error: exifreader library not found. Please check the developer console.');
        isExifReaderLoaded = false;
    }
}

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
    const deleteTagsButton = document.getElementById('deleteTagsButton');
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
    const title = document.querySelector('h1');

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
        startButton.textContent = t('ui.button.start');
        deleteTagsButton.textContent = t('ui.button.deleteAll');
        cancelButton.textContent = t('ui.button.cancel');
        log(t('log.initial'));
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

        // Handle Dynamic Prompts syntax {A|B|C}
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
            // Replace the processed part with a comma to ensure separation
            processedText = processedText.replace(match[0], ',');
        }
        
        // Process the rest of the prompt
        const remainingTags = processedText.replace(/\n/g, ',').split(',');
        remainingTags.forEach(tag => {
            const trimmed = tag.trim();
            if (trimmed) {
                finalTags.add((prefix + trimmed).toLowerCase());
            }
        });

        return [...finalTags];
    }

    function getCheckpointAndLoraTags(nodes) {
        const candidates = new Set();
        nodes.forEach(node => {
            if (!node) return;
            const nodeType = node.type || node.class_type;
            if (!nodeType) return;

            if (chkCheckpoint.checked && (nodeType === 'CheckpointLoader' || nodeType === 'CheckpointLoaderSimple')) {
                const ckptName = (node.inputs && node.inputs.ckpt_name) || (node.widgets_values && node.widgets_values[0]);
                if (ckptName) candidates.add(path.basename(ckptName, path.extname(ckptName)));
            }
            if (chkLora.checked && (nodeType === 'LoraLoader')) {
                const loraName = (node.inputs && node.inputs.lora_name) || (node.widgets_values && node.widgets_values[0]);
                if (loraName) candidates.add(path.basename(loraName, path.extname(loraName)));
            }
        });
        return [...candidates];
    }

    function getPromptTags(nodes, links, nodeObjectById) {
        const candidates = new Set();
        if (!chkPositive.checked && !chkNegative.checked) return [];

        const samplerNodes = nodes.filter(n => {
            if (!n) return false;
            const nodeType = n.type || n.class_type;
            return nodeType && /sampler/i.test(nodeType);
        });

        samplerNodes.forEach(sampler => {
            const findPromptText = (inputName) => {
                let connectedNodeId = null;
                const inputConnection = sampler.inputs?.find(inp => inp.name === inputName);

                if (inputConnection && inputConnection.link && links && links.length > 0) { // GUI Style
                    const linkData = links.find(l => l[0] === inputConnection.link);
                    if (linkData) connectedNodeId = linkData[1];
                } else if (sampler.inputs?.[inputName] && Array.isArray(sampler.inputs[inputName])) { // API Style
                    connectedNodeId = parseInt(sampler.inputs[inputName][0], 10);
                }

                if (connectedNodeId === null) return null;
                const promptNode = nodeObjectById[connectedNodeId] || nodes.find(n => n.id === connectedNodeId);
                if (!promptNode) return null;
                
                const text = (promptNode.inputs && promptNode.inputs.text) || (promptNode.widgets_values && promptNode.widgets_values[0]);
                return typeof text === 'string' ? text : null;
            };

            if (chkPositive.checked) {
                const text = findPromptText('positive');
                if(text) cleanAndSplitPrompt(text).forEach(tag => candidates.add(tag));
            }
            if (chkNegative.checked) {
                const text = findPromptText('negative');
                if(text) cleanAndSplitPrompt(text, 'neg:').forEach(tag => candidates.add(tag));
            }
        });

        return [...candidates];
    }

    function getKsamplerTags(nodes) {
        const candidates = new Set();
        if (!chkSeed.checked && !chkSteps.checked && !chkCfg.checked && !chkSampler.checked) {
            return [];
        }
        
        const samplerNodes = nodes.filter(n => {
            if (!n) return false;
            const nodeType = n.type || n.class_type;
            return nodeType && /sampler/i.test(nodeType);
        });

        const WIDGET_MAP = { seed: 0, steps: 2, cfg: 3, sampler_name: 4 };

        samplerNodes.forEach(sampler => {
            const getValue = (name, index) => {
                if (sampler.inputs && sampler.inputs[name] !== undefined) return sampler.inputs[name];
                if (sampler.widgets_values && sampler.widgets_values.length > index) return sampler.widgets_values[index];
                return undefined;
            };

            const seed = getValue('seed', WIDGET_MAP.seed);
            const steps = getValue('steps', WIDGET_MAP.steps);
            const cfg = getValue('cfg', WIDGET_MAP.cfg);
            const sampler_name = getValue('sampler_name', WIDGET_MAP.sampler_name);

            if (chkSeed.checked && seed !== undefined) {
                candidates.add(`seed:${seed}`);
            }
            if (chkSteps.checked && steps !== undefined) {
                candidates.add(`steps:${steps}`);
            }
            if (chkCfg.checked && cfg !== undefined) {
                candidates.add(`cfg:${Number(cfg).toFixed(2)}`);
            }
            if (chkSampler.checked && sampler_name) {
                candidates.add(`sampler:${sampler_name}`);
            }
        });
        
        return [...candidates];
    }
    
    function resetButtons() {
        if(!startButton || !deleteTagsButton || !cancelButton) return;
        startButton.disabled = false;
        deleteTagsButton.disabled = false;
        cancelButton.style.display = 'none';
        cancelButton.disabled = false;
    }

    async function startTagging() {
        startButton.disabled = true;
        deleteTagsButton.disabled = true;
        cancelButton.style.display = 'inline-block';
        cancelButton.disabled = false;
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

            const chunkSize = parseInt(chunkSizeInput.value, 10) || 5;
            let currentIndex = 0;
            let successCount = 0;
            let errorCount = 0;
            let skippedCount = 0;

            const processItem = async (item) => {
                let buffer = null, exifTags = null, workflow = null;
                try {
                    log(t('log.processingItem', { name: item.name }));
                    buffer = await fsp.readFile(item.filePath);
                    exifTags = ExifReader.load(buffer);

                    let workflowJsonString = null;
                    if (exifTags['Make']?.description) workflowJsonString = exifTags['Make'].description.replace(/^workflow:/, '');
                    else if (exifTags['Model']?.description) workflowJsonString = exifTags['Model'].description.replace(/^prompt:/, '');

                    if (!workflowJsonString) {
                        log(t('log.error.noWorkflow', { name: item.name }));
                        skippedCount++;
                        return;
                    }

                    try {
                        const cleanedJsonString = workflowJsonString.replace(/^UNICODE\u0000+/, '').trim();
                        workflow = JSON.parse(cleanedJsonString);
                        
                        // --- File Dump for Debugging ---
                        const tempDir = 'C:\\Users\\elara\\.gemini\\tmp\\d06720aeff9f2d379bea69b4483174d300dcc0ceca1b6b485007065ab146ffe8';
                        try {
                            // We don't need to create this directory as it should exist.
                            const sanitizedName = item.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                            const workflowDumpPath = path.join(tempDir, `${sanitizedName}_workflow.json`);
                            await fsp.writeFile(workflowDumpPath, JSON.stringify(workflow, null, 2));
                            log(`[DEBUG] Full workflow object saved to: ${workflowDumpPath}`);
                        } catch (e) {
                            log(`[ERROR] Failed to write debug file: ${e.message}`);
                        }
                        // --- End of File Dump ---

                    } catch (e) {
                        log(t('log.error.jsonParse', { name: item.name }));
                        errorCount++;
                        return;
                    }
                    
                    let nodesToProcess = [], nodeObjectById = {}, links = [];
                    if (workflow.nodes && Array.isArray(workflow.nodes)) { // GUI-style
                        nodesToProcess = workflow.nodes;
                        links = workflow.links || [];
                        nodesToProcess.forEach(n => {
                            if (n) nodeObjectById[n.id] = n;
                        });
                    } else if (workflow && typeof workflow === 'object') { // API-style
                        Object.keys(workflow).forEach(id => { 
                            if (workflow[id] && typeof workflow[id] === 'object') {
                                workflow[id].id = parseInt(id, 10);
                            }
                         });
                        nodesToProcess = Object.values(workflow);
                        nodeObjectById = workflow;
                    }

                    if (nodesToProcess.length === 0) {
                        log(t('log.info.noNodes', { name: item.name }));
                        skippedCount++;
                        return;
                    }
                    
                    const finalTags = item.tags ? [...item.tags] : [];
                    const finalTagSet = new Set(finalTags);
                    let addedSomething = false;

                    const allCandidates = [
                        ...getCheckpointAndLoraTags(nodesToProcess),
                        ...getPromptTags(nodesToProcess, links, nodeObjectById),
                        ...getKsamplerTags(nodesToProcess)
                    ];

                    for (const tag of allCandidates) {
                        if (!finalTagSet.has(tag)) {
                            finalTags.push(tag);
                            finalTagSet.add(tag);
                            addedSomething = true;
                        }
                    }

                    if (addedSomething) {
                        const originalTagSet = new Set(item.tags || []);
                        const newAddedTags = finalTags.filter(tag => !originalTagSet.has(tag));
                        log(t('log.tagsAdded', { count: newAddedTags.length, tags: `  -> ${newAddedTags.join(', ')}` }));
                        item.tags = finalTags;
                        await item.save();
                        log(t('log.success', { name: item.name }));
                        successCount++;
                    } else {
                        if (allCandidates.length > 0) {
                            log(t('log.skip.allExist', { name: item.name }));
                            skippedCount++;
                        } else {
                            log(t('log.info.noNodes', { name: item.name }));
                            skippedCount++;
                        }
                    }
                } catch (error) {
                    log(t('log.error.generic', { name: item.name, message: error.message }));
                    console.error(error);
                    errorCount++;
                } finally {
                    buffer = null; exifTags = null; workflow = null;
                }
            };

            const processChunk = async () => {
                if (isCancelled) {
                    log('------------------------------------');
                    log(t('log.cancelled', { successCount, skippedCount, errorCount }));
                    resetButtons();
                    return;
                }
                const chunk = items.slice(currentIndex, currentIndex + chunkSize);
                if (chunk.length === 0) {
                    log('------------------------------------');
                    log(t('log.completed', { successCount, skippedCount, errorCount }));
                    resetButtons();
                    return;
                }
                await Promise.all(chunk.map(item => processItem(item)));
                currentIndex += chunkSize;
                const progress = Math.min(currentIndex, items.length);
                log(t('log.progress', { progress, total: items.length }));
                setTimeout(processChunk, 50);
            };
            processChunk();
        } catch (e) {
            log(t('log.error.init', { message: e.message }));
            console.error(e);
            resetButtons();
        }
    }

    async function removePluginTags() {
        try {
            const items = await eagle.item.getSelected();
            if (items.length === 0) {
                alert(t('alert.noItemSelected'));
                return;
            }
            if (!confirm(t('confirm.deleteAll', { count: items.length }))) {
                log(t('log.delete.cancelled'));
                return;
            }
            startButton.disabled = true;
            deleteTagsButton.disabled = true;
            cancelButton.style.display = 'inline-block';
            cancelButton.disabled = false;
            isCancelled = false;
            logBuffer = [];
            log(t('log.delete.start'));
            const chunkSize = parseInt(chunkSizeInput.value, 10) || 5;
            let currentIndex = 0;
            let removedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;

            const processItemForRemoval = async (item) => {
                let buffer = null, exifTags = null, workflow = null;
                try {
                    buffer = await fsp.readFile(item.filePath);
                    exifTags = ExifReader.load(buffer);
                    let workflowJsonString = null;
                    if (exifTags['Make']?.description) workflowJsonString = exifTags['Make'].description.replace(/^workflow:/, '');
                    else if (exifTags['Model']?.description) workflowJsonString = exifTags['Model'].description.replace(/^prompt:/, '');
                    
                    if (!workflowJsonString) {
                        log(t('log.error.noWorkflow', { name: item.name }));
                        errorCount++;
                        return;
                    }
                    const cleanedJsonString = workflowJsonString.replace(/^UNICODE\u0000+/, '').trim();
                    try {
                        workflow = JSON.parse(cleanedJsonString);
                    } catch (e) {
                        log(t('log.error.jsonParse', { name: item.name }));
                        errorCount++;
                        return;
                    }
                    
                    let nodesToProcess = [], nodeObjectById = {}, links = [];
                    if (workflow.nodes && Array.isArray(workflow.nodes)) { // GUI-style
                        nodesToProcess = workflow.nodes;
                        links = workflow.links || [];
                        nodesToProcess.forEach(n => {
                            if (n) nodeObjectById[n.id] = n;
                        });
                    } else if (workflow && typeof workflow === 'object') { // API-style
                        Object.keys(workflow).forEach(id => { 
                            if (workflow[id] && typeof workflow[id] === 'object') {
                                workflow[id].id = parseInt(id, 10);
                            }
                         });
                        nodesToProcess = Object.values(workflow);
                        nodeObjectById = workflow;
                    }

                    if (nodesToProcess.length === 0) {
                        log(t('log.delete.noCandidates', { name: item.name }));
                        skippedCount++;
                        return;
                    }

                    const tagsToLookFor = new Set([
                        ...getCheckpointAndLoraTags(nodesToProcess),
                        ...getPromptTags(nodesToProcess, links, nodeObjectById),
                        ...getKsamplerTags(nodesToProcess)
                    ]);

                    if (tagsToLookFor.size === 0) {
                        log(t('log.delete.noCandidates', { name: item.name }));
                        skippedCount++;
                        return;
                    }
                    const originalTags = item.tags ? [...item.tags] : [];
                    const tagsRemovedThisItem = [];
                    const newTags = originalTags.filter(tag => {
                        const lowerCaseTag = tag.toLowerCase();
                        if (tagsToLookFor.has(lowerCaseTag)) {
                            tagsRemovedThisItem.push(tag);
                            return false;
                        }
                        return true;
                    });
                    if (newTags.length < originalTags.length) {
                        log(t('log.delete.removing', { name: item.name, count: tagsRemovedThisItem.length }));
                        log(t('log.delete.tagsRemoved', { tags: tagsRemovedThisItem.join(', ') }));
                        item.tags = newTags;
                        await item.save();
                        removedCount++;
                    } else {
                        log(t('log.delete.noneFound', { name: item.name }));
                        skippedCount++;
                    }
                } catch (error) {
                    log(t('log.error.generic', { name: item.name, message: error.message }));
                    console.error(error);
                    errorCount++;
                } finally {
                    buffer = null; exifTags = null; workflow = null;
                }
            };

            const processChunkAndDelete = async () => {
                if (isCancelled) {
                    log('------------------------------------');
                    log(t('log.delete.cancelledMessage', { removedCount, skippedCount, errorCount })); 
                    resetButtons();
                    return;
                }
                const chunk = items.slice(currentIndex, currentIndex + chunkSize);
                if (chunk.length === 0) {
                    log('------------------------------------');
                    log(t('log.delete.completed', { removedCount, skippedCount, errorCount })); 
                    resetButtons();
                    return;
                }
                await Promise.all(chunk.map(item => processItemForRemoval(item)));
                currentIndex += chunkSize;
                const progress = Math.min(currentIndex, items.length);
                log(t('log.progress', { progress, total: items.length }));
                setTimeout(processChunkAndDelete, 50);
            };
            processChunkAndDelete();
        } catch (error) {
            log(t('log.error.init', { message: error.message }));
            resetButtons();
        }
    }
    
    if (!isExifReaderLoaded) {
        log("Error: A critical library (ExifReader) failed to load.");
        return;
    }
    
    applyLocale();
    
    startButton.addEventListener('click', startTagging);
    deleteTagsButton.addEventListener('click', removePluginTags);
    cancelButton.addEventListener('click', () => {
        if (!isCancelled) {
            isCancelled = true;
            cancelButton.disabled = true;
            log(t('log.cancelling'));
        }
    });

    console.log("Plugin successfully initialized.");
});
