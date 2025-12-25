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
        resolve(); // Already ready
    }
});

Promise.all([i18nReadyPromise, domReadyPromise]).then(() => {
    
    // --- All code now lives inside the resolved promise ---

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
    const chunkSizeInput = document.getElementById('chunk-size');
    const checkpointLabel = document.querySelector('label[for="chk-checkpoint"]');
    const loraLabel = document.querySelector('label[for="chk-lora"]');
    const positiveLabel = document.querySelector('label[for="chk-positive"]');
    const negativeLabel = document.querySelector('label[for="chk-negative"]');
    const chunkSizeLabel = document.querySelector('label[for="chunk-size"]');
    const title = document.querySelector('h1');

    function applyLocale() {
        document.title = t('ui.title');
        title.textContent = t('ui.title');
        checkpointLabel.textContent = t('ui.option.checkpoint');
        loraLabel.textContent = t('ui.option.lora');
        positiveLabel.textContent = t('ui.option.positive');
        negativeLabel.textContent = t('ui.option.negative');
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
        const tags = promptText.replace(/\n/g, ',').split(',');
        return tags.map(tag => (prefix + tag.trim()).toLowerCase()).filter(tag => tag.length > prefix.length);
    }

    function getCheckpointAndLoraTags(nodes) {
        const candidates = [];
        if (chkCheckpoint.checked) {
            nodes.filter(n => n && (n.class_type === 'CheckpointLoaderSimple' || n.class_type === 'CheckpointLoader')).forEach(n => {
                const ckptName = n.inputs?.ckpt_name;
                if (ckptName) candidates.push(path.basename(ckptName, path.extname(ckptName)));
            });
        }
        if (chkLora.checked) {
            nodes.filter(n => n && n.class_type === 'LoraLoader').forEach(n => {
                const loraName = n.inputs?.lora_name;
                if (loraName) candidates.push(path.basename(loraName, path.extname(loraName)));
            });
        }
        return candidates;
    }

    function getPromptTags(nodes, nodeObjectById) {
        const candidates = [];
        if (!chkPositive.checked && !chkNegative.checked) return candidates;
        const ksampler = nodes.filter(node => node && node.class_type === 'KSampler').reverse()[0];
        if (!ksampler) return candidates;
        if (chkPositive.checked) {
            const nodeId = ksampler.inputs?.positive?.[0];
            const promptNode = nodeObjectById[nodeId];
            if (promptNode && promptNode.inputs?.text) candidates.push(...cleanAndSplitPrompt(promptNode.inputs.text));
        }
        if (chkNegative.checked) {
            const nodeId = ksampler.inputs?.negative?.[0];
            const promptNode = nodeObjectById[nodeId];
            if (promptNode && promptNode.inputs?.text) candidates.push(...cleanAndSplitPrompt(promptNode.inputs.text, 'neg:'));
        }
        return candidates;
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

            const processItem = async (item) => {
                let buffer = null, exifTags = null, workflow = null;
                try {
                    log(t('log.processingItem', { name: item.name }));
                    buffer = await fsp.readFile(item.filePath);
                    exifTags = ExifReader.load(buffer);
                    let workflowJsonString = null;
                    if (exifTags['Model']?.description) workflowJsonString = exifTags['Model'].description.replace(/^prompt:/, '');
                    else if (exifTags['Make']?.description) workflowJsonString = exifTags['Make'].description.replace(/^workflow:/, '');
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
                    let nodesToProcess = [], nodeObjectById = {};
                    if (workflow.nodes && Array.isArray(workflow.nodes)) {
                        nodesToProcess = workflow.nodes;
                        nodesToProcess.forEach(n => nodeObjectById[n.id] = n);
                    } else if (workflow && typeof workflow === 'object') {
                        Object.keys(workflow).forEach(id => { if(workflow[id] && typeof workflow[id] === 'object') workflow[id].id = id; });
                        nodesToProcess = Object.values(workflow);
                        nodeObjectById = workflow;
                    }
                    if (nodesToProcess.length === 0) {
                        log(t('log.info.noNodes', { name: item.name }));
                        return;
                    }
                    
                    const finalTags = item.tags ? [...item.tags] : [];
                    const finalTagSet = new Set(finalTags);
                    let addedSomething = false;

                    const cpLoraCandidates = getCheckpointAndLoraTags(nodesToProcess);
                    for (const tag of cpLoraCandidates) {
                        if (!finalTagSet.has(tag)) {
                            finalTags.push(tag);
                            finalTagSet.add(tag);
                            addedSomething = true;
                        }
                    }
                    const promptCandidates = getPromptTags(nodesToProcess, nodeObjectById);
                    for (const tag of promptCandidates) {
                        if (!finalTagSet.has(tag)) {
                            finalTags.push(tag);
                            finalTagSet.add(tag);
                            addedSomething = true;
                        }
                    }

                    if (addedSomething) {
                        const originalTagSet = new Set(item.tags || []);
                        const newAddedTags = finalTags.filter(tag => !originalTagSet.has(tag));
                        log(t('log.tagsAdded', { count: newAddedTags.length, tags: newAddedTags.join(', ') }));
                        item.tags = finalTags;
                        await item.save();
                        log(t('log.success', { name: item.name }));
                        successCount++;
                    } else {
                        const allCandidates = [...cpLoraCandidates, ...promptCandidates];
                        if (allCandidates.length > 0) {
                            log(t('log.skip', { name: item.name }));
                        } else {
                            log(t('log.info.noNodes', { name: item.name }));
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
                    log(t('log.cancelled', { successCount, errorCount }));
                    resetButtons();
                    return;
                }
                const chunk = items.slice(currentIndex, currentIndex + chunkSize);
                if (chunk.length === 0) {
                    log('------------------------------------');
                    log(t('log.completed', { successCount, errorCount }));
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
            if (!confirm(t('confirm.deleteAll', { count: items.length })))
            {
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

            const processItemForRemoval = async (item) => {
                let buffer = null, exifTags = null, workflow = null;
                try {
                    buffer = await fsp.readFile(item.filePath);
                    exifTags = ExifReader.load(buffer);
                    let workflowJsonString = null;
                    if (exifTags['Model']?.description) workflowJsonString = exifTags['Model'].description.replace(/^prompt:/, '');
                    else if (exifTags['Make']?.description) workflowJsonString = exifTags['Make'].description.replace(/^workflow:/, '');
                    if (!workflowJsonString) {
                        log(t('log.delete.noCandidates', { name: item.name }));
                        skippedCount++;
                        return;
                    }
                    const cleanedJsonString = workflowJsonString.replace(/^UNICODE\u0000+/, '').trim();
                    try {
                        workflow = JSON.parse(cleanedJsonString);
                    } catch (e) {
                        log(t('log.error.jsonParse', { name: item.name }));
                        skippedCount++;
                        return;
                    }
                    let nodesToProcess = [], nodeObjectById = {};
                    if (workflow.nodes && Array.isArray(workflow.nodes)) {
                        nodesToProcess = workflow.nodes;
                        nodesToProcess.forEach(n => nodeObjectById[n.id] = n);
                    } else if (workflow && typeof workflow === 'object') {
                        Object.keys(workflow).forEach(id => { if (workflow[id] && typeof workflow[id] === 'object') workflow[id].id = id; });
                        nodesToProcess = Object.values(workflow);
                        nodeObjectById = workflow;
                    }
                    if (nodesToProcess.length === 0) {
                        log(t('log.delete.noCandidates', { name: item.name }));
                        skippedCount++;
                        return;
                    }
                    const tagsToLookFor = new Set([...getCheckpointAndLoraTags(nodesToProcess), ...getPromptTags(nodesToProcess, nodeObjectById)]);
                    if (tagsToLookFor.size === 0) {
                        log(t('log.delete.noCandidates', { name: item.name }));
                        skippedCount++;
                        return;
                    }
                    const originalTags = item.tags ? [...item.tags] : [];
                    const tagsRemovedThisItem = [];
                    const newTags = originalTags.filter(tag => {
                        if (tagsToLookFor.has(tag)) {
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
                    skippedCount++;
                } finally {
                    buffer = null; exifTags = null; workflow = null;
                }
            };

            const processChunkAndDelete = async () => {
                if (isCancelled) {
                    log('------------------------------------');
                    log(t('log.delete.cancelledMessage'));
                    resetButtons();
                    return;
                }
                const chunk = items.slice(currentIndex, currentIndex + chunkSize);
                if (chunk.length === 0) {
                    log('------------------------------------');
                    log(t('log.delete.completed', { removedCount, skippedCount }));
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
    
    // --- Final Initialization ---
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