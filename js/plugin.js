const fsp = require('fs').promises;
const path = require('path');
const { ExifTool } = require('exiftool-vendored');
const exiftool = new ExifTool();

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

    function getCheckpointAndLoraTags(nodes) {
        const candidates = new Set();
        nodes.forEach(node => {
            if (!node) return;
            const nodeType = node.type || node.class_type;
            if (!nodeType) return;

            // Checkpoint Loader
            if (chkCheckpoint.checked && /checkpoint/i.test(nodeType)) {
                const ckptName = (node.inputs && node.inputs.ckpt_name) || (node.widgets_values && node.widgets_values[0]);
                if (ckptName && typeof ckptName === 'string') {
                    candidates.add(path.basename(ckptName, path.extname(ckptName)).toLowerCase());
                }
            }
            
            // LoRA Loader (including stacks)
            if (chkLora.checked && /lora/i.test(nodeType)) {
                // Standard LoraLoader
                let loraName = (node.inputs && node.inputs.lora_name) || (node.widgets_values && node.widgets_values[0]);
                if (loraName && typeof loraName === 'string' && loraName.toLowerCase() !== 'none') {
                    candidates.add(path.basename(loraName, path.extname(loraName)).toLowerCase());
                }

                // For stack-style loaders like 'Lora Loader Stack (rgthree)'
                // API-style inputs
                if (node.inputs) {
                    for (let i = 1; i <= 5; i++) { // Check for up to 5 loras in a stack
                        loraName = node.inputs[`lora_0${i}`];
                        if (loraName && typeof loraName === 'string' && loraName.toLowerCase() !== 'none') {
                            candidates.add(path.basename(loraName, path.extname(loraName)).toLowerCase());
                        }
                    }
                }
                // GUI-style widgets_values
                if (node.widgets_values && Array.isArray(node.widgets_values)) {
                     for (let i = 0; i < node.widgets_values.length; i += 2) { // LoRA name is often every 2nd widget
                        loraName = node.widgets_values[i];
                        if (typeof loraName === 'string' && loraName.toLowerCase() !== 'none') {
                            candidates.add(path.basename(loraName, path.extname(loraName)).toLowerCase());
                        }
                     }
                }
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

                if (Array.isArray(sampler.inputs)) {
                    const inputConnection = sampler.inputs.find(inp => inp.name === inputName);
                    if (inputConnection && inputConnection.link && links && links.length > 0) {
                        const linkData = links.find(l => l[0] === inputConnection.link);
                        if (linkData) connectedNodeId = linkData[1];
                    }
                } else if (sampler.inputs && typeof sampler.inputs === 'object' && sampler.inputs[inputName] && Array.isArray(sampler.inputs[inputName])) {
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
            const getValue = (name, index, expectedType) => {
                let value;
                if (sampler.inputs && sampler.inputs[name] !== undefined) {
                    value = sampler.inputs[name];
                } else if (sampler.widgets_values && sampler.widgets_values.length > index) {
                    value = sampler.widgets_values[index];
                }

                if (value !== undefined) {
                    if (typeof value === expectedType) {
                        return value;
                    }
                    if (expectedType === 'number' && typeof value === 'string' && !isNaN(parseFloat(value))) {
                        return parseFloat(value);
                    }
                }
                return undefined;
            };

            const seed = getValue('seed', WIDGET_MAP.seed, 'number');
            const steps = getValue('steps', WIDGET_MAP.steps, 'number');
            const cfg = getValue('cfg', WIDGET_MAP.cfg, 'number');
            const sampler_name = getValue('sampler_name', WIDGET_MAP.sampler_name, 'string');

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
                candidates.add(`sampler:${sampler_name.toLowerCase()}`);
            }
        });
        
        return [...candidates];
    }
    
    const SETTINGS_KEY = 'comfyui-auto-tagger-settings';
    const allCheckboxes = [chkCheckpoint, chkLora, chkPositive, chkNegative, chkSeed, chkSampler, chkSteps, chkCfg];

    function saveCheckboxState() {
        const settings = {};
        allCheckboxes.forEach(chk => {
            settings[chk.id] = chk.checked;
        });
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    function loadCheckboxState() {
        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                allCheckboxes.forEach(chk => {
                    if (settings[chk.id] !== undefined) {
                        chk.checked = settings[chk.id];
                    } else {
                        chk.checked = true; // Default to true if a new checkbox is added
                    }
                });
            } catch (e) {
                console.error('Failed to load settings', e);
                allCheckboxes.forEach(chk => chk.checked = true);
            }
        } else {
            allCheckboxes.forEach(chk => chk.checked = true);
        }
    }

    function resetButtons() {
        if(!startButton || !deleteTagsButton || !cancelButton) return;
        startButton.disabled = false;
        deleteTagsButton.disabled = false;
        cancelButton.style.display = 'none';
        cancelButton.disabled = false;
    }

    async function processWorkflowForTags(item) {
        const tags = await exiftool.read(item.filePath);
    
        const getTagValue = (tag) => {
            if (!tag) return null;
            if (typeof tag === 'string') return tag;
            if (Array.isArray(tag)) return tag[0];
            if (tag.value) {
                if (Array.isArray(tag.value)) return tag.value[0];
                return tag.value;
            }
            return null;
        };
    
        let workflowJsonString = getTagValue(tags.Model); // API format is more reliable
        if (!workflowJsonString) workflowJsonString = getTagValue(tags.Make); // Fallback to GUI format
        if (!workflowJsonString) workflowJsonString = getTagValue(tags.UserComment);
        if (!workflowJsonString) workflowJsonString = getTagValue(tags.ImageDescription);
        if (!workflowJsonString) workflowJsonString = getTagValue(tags.XPComment);
        if (!workflowJsonString) workflowJsonString = getTagValue(tags.XMPDescription);
    
        if (workflowJsonString) {
            if (workflowJsonString.startsWith('prompt:')) {
                workflowJsonString = workflowJsonString.substring('prompt:'.length);
            } else if (workflowJsonString.startsWith('workflow:')) {
                workflowJsonString = workflowJsonString.substring('workflow:'.length);
            } else {
                return { error: 'No prompt: or workflow: prefix found.' };
            }
        } else {
            return { error: 'No workflow or prompt data found in Exif.' };
        }
    
        let workflow;
        try {
            const cleanedJsonString = workflowJsonString.replace(/^UNICODE\u0000+/, '').trim();
            workflow = JSON.parse(cleanedJsonString);
        } catch (e) {
            return { error: `JSON parse error: ${e.message}` };
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
    
        const tagsToLookFor = new Set([
            ...getCheckpointAndLoraTags(nodesToProcess),
            ...getPromptTags(nodesToProcess, links, nodeObjectById),
            ...getKsamplerTags(nodesToProcess)
        ]);
    
        return { tags: tagsToLookFor };
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

                    const allCandidates = result.tags;
                    const finalTags = item.tags ? [...item.tags] : [];
                    const finalTagSet = new Set(finalTags.map(t => t.toLowerCase()));
                    let addedSomething = false;
                    
                    allCandidates.forEach(tag => {
                        if (!finalTagSet.has(tag)) {
                            finalTags.push(tag);
                            finalTagSet.add(tag);
                            addedSomething = true;
                        }
                    });

                    if (addedSomething) {
                        item.tags = finalTags;
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
                log('------------------------------------');
                log(t('log.cancelled', { successCount, skippedCount, errorCount }));
            } else {
                log('------------------------------------');
                log(t('log.completed', { successCount, skippedCount, errorCount }));
            }
            resetButtons();

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
            isCancelled = false;
            log(t('log.delete.start'));
            
            let removedCount = 0, skippedCount = 0, errorCount = 0;

            for (const item of items) {
                if (isCancelled) break;
                try {
                    const result = await processWorkflowForTags(item);
                    if (result.error) {
                        log(t('log.delete.noCandidates', { name: item.name }));
                        skippedCount++;
                        continue;
                    }
                    
                    const tagsToLookFor = result.tags;
                    if (tagsToLookFor.size === 0) {
                        log(t('log.delete.noCandidates', { name: item.name }));
                        skippedCount++;
                        continue;
                    }

                    const originalTags = item.tags ? [...item.tags] : [];
                    let tagsRemovedThisItem = [];
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
                }
            }
            
            if (isCancelled) {
                log('------------------------------------');
                log(t('log.delete.cancelledMessage', { removedCount, skippedCount, errorCount })); 
            } else {
                log('------------------------------------');
                log(t('log.delete.completed', { removedCount, skippedCount, errorCount })); 
            }
            resetButtons();
        } catch (error) {
            log(t('log.error.init', { message: error.message }));
            resetButtons();
        }
    }
    
    applyLocale();
    loadCheckboxState();
    
    startButton.addEventListener('click', () => {
        saveCheckboxState();
        startTagging();
    });
    deleteTagsButton.addEventListener('click', removePluginTags);
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

    // Clean up exiftool process on exit
    window.addEventListener('beforeunload', () => {
        exiftool.end();
    });

    console.log("Plugin successfully initialized.");
});
