// js/plugin.js
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');

Promise.all([
    new Promise(r => eagle.onPluginCreate(r)), 
    new Promise(r => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', r) : r())
]).then(([plugin]) => {
    
    // --- 1. UI・Eagle連携用ユーティリティ ---
    function t(key, r = {}) {
        return window.i18next ? window.i18next.t(key, r) : (r.defaultValue || key);
    }
    
    async function initI18n() {
        try {
            const appLocale = eagle.app.locale;
            const lang = (appLocale && appLocale.startsWith('ja')) ? 'ja' : 'en';
            const loadJson = async (filename) => {
                const filePath = path.join(plugin.path, '_locales', filename);
                return JSON.parse(await fsp.readFile(filePath, 'utf8'));
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
            
            // Initialize dictionary after i18n is ready
            if (window.initializeDictionary) {
                await window.initializeDictionary();
            }
        } catch (e) { console.error("[i18n] Init failed", e); }
    }

    function updateUILabels() {
        const labelMap = {
            'chk-checkpoint': 'ui.option.checkpoint', 'chk-lora': 'ui.option.lora',
            'chk-positive': 'ui.option.positive', 'chk-negative': 'ui.option.negative',
            'chk-seed': 'ui.option.seed', 'chk-sampler': 'ui.option.sampler',
            'chk-steps': 'ui.option.steps', 'chk-cfg': 'ui.option.cfg',
            'chk-add-tags': 'ui.option.addTags', 'chk-write-notes': 'ui.option.writeNotes',
            'chk-debug-log': 'ui.option.debugMode'
        };
        document.querySelector('h1').textContent = t('ui.title');
        for (const [id, key] of Object.entries(labelMap)) {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) label.textContent = t(key);
        }
        
        const sectionTitles = document.querySelectorAll('.section-title');
        if(sectionTitles[0]) sectionTitles[0].textContent = t('ui.outputSettings');
        if(sectionTitles[1]) sectionTitles[1].textContent = t('ui.suspiciousNodeHandling');
        if(sectionTitles[2]) sectionTitles[2].textContent = t('ui.extractionTarget');

        const chunkSizeLabel = document.querySelector('label[for="chunk-size"]');
        if (chunkSizeLabel) chunkSizeLabel.textContent = t('ui.config.chunkSize');
        
        // Suspicious node handling
        const suspiciousNodeLabel = document.querySelector('label[for="suspicious-node-handling"]');
        if (suspiciousNodeLabel) suspiciousNodeLabel.textContent = t('ui.processingMethod');
        
        const suspiciousNodeDesc = document.querySelector('.section-title + div div[style*="font-size: 11px"]');
        if (suspiciousNodeDesc) suspiciousNodeDesc.textContent = t('ui.suspiciousNodeDescription');
        
        // Suspicious node handling select options
        const suspiciousNodeSelect = document.getElementById('suspicious-node-handling');
        if (suspiciousNodeSelect) {
            const options = suspiciousNodeSelect.querySelectorAll('option');
            if (options[0]) options[0].textContent = t('ui.option.exclude');
            if (options[1]) options[1].textContent = t('ui.option.ask');
            if (options[2]) options[2].textContent = t('ui.option.include');
        }
        
        // Dialog translations
        const dialogHeader = document.querySelector('#suspicious-node-dialog .dialog-header');
        if (dialogHeader) dialogHeader.textContent = t('suspiciousNode.title');
        
        const dialogFilenameLabel = document.querySelector('#suspicious-node-dialog .dialog-info > div:first-child strong');
        if (dialogFilenameLabel) dialogFilenameLabel.textContent = t('ui.dialog.filename');
        
        const dialogImage = document.getElementById('dialog-image');
        if (dialogImage) dialogImage.alt = t('ui.dialog.imagePreview');
        
        const btnExcludeNode = document.getElementById('btn-exclude-node');
        if (btnExcludeNode) btnExcludeNode.textContent = t('ui.dialog.excludeNode');
        
        const btnIncludeNode = document.getElementById('btn-include-node');
        if (btnIncludeNode) btnIncludeNode.textContent = t('ui.dialog.includeNode');
        
        const btnExcludeImage = document.getElementById('btn-exclude-image');
        if (btnExcludeImage) btnExcludeImage.textContent = t('ui.dialog.excludeImage');
        
        const btnIncludeImage = document.getElementById('btn-include-image');
        if (btnIncludeImage) btnIncludeImage.textContent = t('ui.dialog.includeImage');
        
        const shiftHint = document.querySelector('#suspicious-node-dialog .dialog-actions + div');
        if (shiftHint) shiftHint.textContent = t('ui.dialog.shiftHint');

        // Settings dialog translations
        const settingsTitle = document.querySelector('.settings-header span');
        if (settingsTitle) settingsTitle.textContent = t('ui.settings.title');
        
        const settingsSectionTitles = document.querySelectorAll('.settings-section-title');
        if (settingsSectionTitles[0]) settingsSectionTitles[0].textContent = t('ui.settings.processingSettings');
        if (settingsSectionTitles[1]) settingsSectionTitles[1].textContent = t('ui.suspiciousNodeHandling');
        if (settingsSectionTitles[2]) settingsSectionTitles[2].textContent = t('ui.settings.dictionarySettings');
        if (settingsSectionTitles[3]) settingsSectionTitles[3].textContent = t('ui.settings.tagGenerationSettings');
        if (settingsSectionTitles[4]) settingsSectionTitles[4].textContent = t('ui.settings.debugSettings');
        if (settingsSectionTitles[5]) settingsSectionTitles[5].textContent = t('ui.settings.support');
        
        const chunkSizeSettingsLabel = document.querySelector('label[for="chunk-size-settings"]');
        if (chunkSizeSettingsLabel) chunkSizeSettingsLabel.textContent = t('ui.settings.chunkSize');
        
        const suspiciousNodeHandlingSettingsLabel = document.querySelector('label[for="suspicious-node-handling-settings"]');
        if (suspiciousNodeHandlingSettingsLabel) suspiciousNodeHandlingSettingsLabel.textContent = t('ui.processingMethod');
        
        const suspiciousNodeHandlingSettingsSelect = document.getElementById('suspicious-node-handling-settings');
        if (suspiciousNodeHandlingSettingsSelect) {
            const options = suspiciousNodeHandlingSettingsSelect.querySelectorAll('option');
            if (options[0]) options[0].textContent = t('ui.option.exclude');
            if (options[1]) options[1].textContent = t('ui.option.ask');
            if (options[2]) options[2].textContent = t('ui.option.include');
        }
        
        const fetchDictionaryLabel = document.querySelector('label[for="chk-fetch-dictionary-settings"]');
        if (fetchDictionaryLabel) fetchDictionaryLabel.textContent = t('ui.settings.fetchDictionary');
        
        const includeAllSamplersLabel = document.querySelector('label[for="chk-include-all-samplers-settings"]');
        if (includeAllSamplersLabel) includeAllSamplersLabel.textContent = t('ui.settings.includeAllSamplers');
        
        const debugModeSettingsLabel = document.querySelector('label[for="chk-debug-log-settings"]');
        if (debugModeSettingsLabel) debugModeSettingsLabel.textContent = t('ui.settings.debugMode');
        
        const btnReportIssue = document.getElementById('btn-report-issue');
        if (btnReportIssue) btnReportIssue.textContent = t('ui.settings.reportIssue');
        
        const settingsDescriptions = document.querySelectorAll('.settings-description');
        if (settingsDescriptions[0]) settingsDescriptions[0].textContent = t('ui.settings.chunkSizeDescription');
        if (settingsDescriptions[1]) settingsDescriptions[1].textContent = t('ui.suspiciousNodeDescription');
        if (settingsDescriptions[2]) settingsDescriptions[2].textContent = t('ui.settings.fetchDictionaryDescription');
        if (settingsDescriptions[3]) settingsDescriptions[3].textContent = t('ui.settings.includeAllSamplersDescription');
        if (settingsDescriptions[4]) settingsDescriptions[4].textContent = t('ui.settings.debugModeDescription');
        if (settingsDescriptions[5]) settingsDescriptions[5].textContent = t('ui.settings.reportIssueDescription');
        
        // Suspicious node dialog content
        const dialogNodeDescription = document.getElementById('dialog-node-description');
        if (dialogNodeDescription) dialogNodeDescription.textContent = t('suspiciousNode.description');
        
        const dialogNodeQuestion = document.getElementById('dialog-node-question');
        if (dialogNodeQuestion) dialogNodeQuestion.textContent = t('suspiciousNode.question');
        
        const dialogNodeInfo = document.querySelector('#suspicious-node-dialog .dialog-node-info');
        if (dialogNodeInfo) {
            const graphTitleDiv = dialogNodeInfo.querySelector('div:nth-child(4) > div:first-child');
            if (graphTitleDiv) graphTitleDiv.textContent = t('suspiciousNode.graphTitle');
            
            const commonCasesDiv = dialogNodeInfo.querySelector('div:nth-child(5) > div:first-child');
            if (commonCasesDiv) commonCasesDiv.textContent = t('suspiciousNode.commonCases');
            
            const caseSpans = dialogNodeInfo.querySelectorAll('div:nth-child(5) > div:nth-child(2) > div > span');
            if (caseSpans[0]) caseSpans[0].textContent = t('suspiciousNode.case1');
            if (caseSpans[1]) caseSpans[1].textContent = t('suspiciousNode.case2');
            
            const hintDivs = dialogNodeInfo.querySelectorAll('div:nth-child(6) > div');
            if (hintDivs[0]) hintDivs[0].textContent = t('suspiciousNode.hint');
            if (hintDivs[1]) hintDivs[1].textContent = t('suspiciousNode.hintDetail');
        }

        document.getElementById('startButton').textContent = t('ui.button.start');
        document.getElementById('deleteInfoButton').textContent = t('ui.button.deleteInfo');
        document.getElementById('cancelButton').textContent = t('ui.button.cancel');
    }

    // --- 2. ステート管理 ---
    let isCancelled = false;
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
        scheduler: document.getElementById('chk-scheduler'),
        steps: document.getElementById('chk-steps'),
        cfg: document.getElementById('chk-cfg'),
        addTags: document.getElementById('chk-add-tags'),
        writeNotes: document.getElementById('chk-write-notes'),
        debug: document.getElementById('chk-debug-log'),
        includeAllSamplers: document.getElementById('chk-include-all-samplers')
    };
    
    const suspiciousNodeHandlingSelect = document.getElementById('suspicious-node-handling');

    // --- 2.1 Debug Logging ---
    const LOG_DIR = path.join(os.tmpdir(), 'comfyui-auto-tagger');
    let DEBUG_LOG_FILE = '';
    
    (async () => { 
        try { 
            await fsp.mkdir(LOG_DIR, { recursive: true }); 
            DEBUG_LOG_FILE = path.join(LOG_DIR, `debug-${Date.now()}.log`);
        } catch(e) { console.error(e); } 
    })();

    // Unified debug logging function
    async function debugLog(msg, item = null, level = 'info') {
        if (!checkboxes.debug || !checkboxes.debug.checked) return;
        
        const timestamp = new Date().toISOString();
        const itemPrefix = item ? `[${item.name}] ` : '';
        const levelPrefix = `[${level.toUpperCase()}]`;
        const line = `[${timestamp}] ${levelPrefix} ${itemPrefix}${msg}\n`;
        
        // Output to console based on level
        switch(level) {
            case 'error':
                console.error(`${levelPrefix} ${itemPrefix}${msg}`);
                break;
            case 'warn':
                console.warn(`${levelPrefix} ${itemPrefix}${msg}`);
                break;
            default:
                console.log(`${levelPrefix} ${itemPrefix}${msg}`);
        }
        
        // Write to log file
        try { 
            if(DEBUG_LOG_FILE) await fsp.appendFile(DEBUG_LOG_FILE, line); 
        } catch(e){
            console.error('Failed to write debug log:', e);
        }
    }

    // Make debugLog available globally for other modules
    window.debugLog = debugLog;
    window.isDebugMode = () => checkboxes.debug && checkboxes.debug.checked;

    function getSettings() {
        const s = {};
        for(const k in checkboxes) if(checkboxes[k]) s[k] = checkboxes[k].checked;
        return s;
    }
    function log(key, replacements={}) {
        const msg = t(key, replacements);
        const div = document.createElement('div');
        if (msg.includes('[Caution]') || msg.includes('[要確認]')) {
            div.className = 'log-caution';
        }
        div.textContent = msg;
        logArea.appendChild(div);
        if (logArea.childNodes.length > 200) logArea.removeChild(logArea.firstChild);
        logArea.scrollTop = logArea.scrollHeight;
    }

    // --- 3. UI Helper Functions ---
    function updateProgress(current, total) {
        const percentage = total > 0 ? (current / total) * 100 : 0;
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${current} / ${total}`;
    }

    function setUIState(processing) {
        const startBtn = document.getElementById('startButton');
        const deleteBtn = document.getElementById('deleteInfoButton');
        const cancelBtn = document.getElementById('cancelButton');
        
        if (processing) {
            startBtn.disabled = true;
            deleteBtn.disabled = true;
            cancelBtn.style.display = 'inline-block';
            cancelBtn.disabled = false;
            progressContainer.style.display = 'block';
        } else {
            startBtn.disabled = false;
            deleteBtn.disabled = false;
            cancelBtn.style.display = 'none';
            progressContainer.style.display = 'none';
            updateProgress(0, 0);
        }
    }

    // --- 4. Chunk Processing Logic ---
    async function processItemsInChunks(items, processFn, forceSequential = false) {
        const chunkSize = forceSequential ? 1 : (parseInt(chunkSizeInput.value, 10) || 5);
        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        let cautionCount = 0;
        let processedCount = 0;

        updateProgress(0, items.length);

        for (let i = 0; i < items.length; i += chunkSize) {
            if (isCancelled) break;
            const chunk = items.slice(i, i + chunkSize);
            
            // If forceSequential, process one by one without Promise.allSettled
            let results;
            if (forceSequential) {
                results = [];
                for (const item of chunk) {
                    try {
                        const result = await processFn(item);
                        results.push({ status: 'fulfilled', value: result });
                    } catch (error) {
                        results.push({ status: 'rejected', reason: error });
                    }
                }
            } else {
                results = await Promise.allSettled(chunk.map(processFn));
            }

            results.forEach(result => {
                processedCount++;
                if (result.status === 'fulfilled') {
                    const status = result.value; // 'success', 'skipped', 'error', 'caution'
                    if (status === 'success') successCount++;
                    else if (status === 'skipped') skippedCount++;
                    else if (status === 'caution') { 
                        successCount++; 
                        cautionCount++; 
                    }
                    else errorCount++;
                } else {
                    errorCount++;
                }
            });
            updateProgress(processedCount, items.length);
            
            await new Promise(r => setTimeout(r, 10));
        }
        return { successCount, skippedCount, errorCount, cautionCount };
    }

    // --- 5. メインアクション ---
    async function startTagging() {
        isCancelled = false;
        logArea.innerHTML = '';
        log('log.start');
        
        // Reset global suspicious node decision
        if (window.resetGlobalSuspiciousNodeDecision) {
            window.resetGlobalSuspiciousNodeDecision();
        }
        
        const items = await eagle.item.getSelected();
        if (!items.length) { log('log.noItemSelected'); return; }

        setUIState(true); 
        const settings = getSettings();
        
        // Get chunk size from input
        const currentChunkSize = parseInt(chunkSizeInput.value, 10) || 5;
        
        // Debug: Output current settings
        await debugLog('=== PROCESSING STARTED ===');
        await debugLog('Selected items: ' + items.length);
        await debugLog('Current settings: ' + JSON.stringify(settings, null, 2));
        await debugLog('Chunk size: ' + currentChunkSize);
        await debugLog('Suspicious node handling: ' + (window.getSuspiciousNodeHandling ? window.getSuspiciousNodeHandling() : 'exclude'));
        
        if (checkboxes.debug.checked && DEBUG_LOG_FILE) {
            log('log.debugLogFile', { path: DEBUG_LOG_FILE });
        }
        await debugLog('Debug log file: ' + DEBUG_LOG_FILE);

        // Initialize MetadataService
        const metadataService = new MetadataService();
        await debugLog('MetadataService initialized');

        const processItem = async (item) => {
            try {
                await debugLog('--- Processing item: ' + item.name + ' ---');
                log('log.processingItem', {name: item.name});
                const ext = path.extname(item.filePath).toLowerCase();
                const buffer = await fsp.readFile(item.filePath);
                const mimeType = ext === '.png' ? 'image/png' : 'image/webp';
                
                await debugLog('File info: ext=' + ext + ', size=' + buffer.length + ' bytes, mimeType=' + mimeType, item);
                
                // Get suspicious node handling option from UI
                const suspiciousNodeHandling = window.getSuspiciousNodeHandling ? window.getSuspiciousNodeHandling() : 'exclude';
                await debugLog('Suspicious node handling: ' + suspiciousNodeHandling, item);
                
                // Use new MetadataService with options
                await debugLog('Extracting metadata...', item);
                const metadata = metadataService.extractPreferredMetadata(buffer, mimeType, 'comfyui', {
                    suspiciousNodeHandling: suspiciousNodeHandling
                });
                
                if (metadata) {
                    await debugLog('=== METADATA EXTRACTION COMPLETE ===', item);
                    await debugLog('Format: ' + metadata.format, item);
                    
                    // Log full metadata content
                    await debugLog('--- Full Metadata Content ---', item);
                    await debugLog(JSON.stringify(metadata, null, 2), item);
                    await debugLog('--- End of Full Metadata ---', item);
                    
                    // Log summary
                    await debugLog('--- Metadata Summary ---', item);
                    await debugLog('Checkpoint: ' + (metadata.checkpoint || 'none'), item);
                    await debugLog('LoRAs: ' + (metadata.loras ? metadata.loras.length : 0), item);
                    if (metadata.loras && metadata.loras.length > 0) {
                        for (var loraIdx = 0; loraIdx < metadata.loras.length; loraIdx++) {
                            var lora = metadata.loras[loraIdx];
                            await debugLog('  LoRA ' + (loraIdx + 1) + ': ' + lora.name + ' (weight: ' + lora.weight + ')', item);
                        }
                    }
                    await debugLog('Sampler: ' + (metadata.sampler || 'none'), item);
                    await debugLog('Scheduler: ' + (metadata.scheduler || 'none'), item);
                    await debugLog('Seed: ' + (metadata.seed || 'none'), item);
                    await debugLog('Steps: ' + (metadata.steps || 'none'), item);
                    await debugLog('CFG: ' + (metadata.cfg || 'none'), item);
                    await debugLog('Generation Steps: ' + (metadata.generationSteps ? metadata.generationSteps.length : 0), item);
                    if (metadata.generationSteps && metadata.generationSteps.length > 0) {
                        for (var stepIdx = 0; stepIdx < metadata.generationSteps.length; stepIdx++) {
                            var step = metadata.generationSteps[stepIdx];
                            await debugLog('  Step ' + (stepIdx + 1) + ': ' + (step.label || 'Unlabeled') + ' (sampler: ' + step.sampler + ')', item);
                        }
                    }
                    await debugLog('Suspicious Nodes: ' + (metadata.suspiciousNodes ? metadata.suspiciousNodes.length : 0), item);
                    await debugLog('Sampler Fallback: ' + (metadata.sampler_fallback ? 'YES' : 'NO'), item);
                } else {
                    await debugLog('No metadata found', item, 'warn');
                }

                if (!metadata) {
                    log('log.noMetadata', {name: item.name});
                    return 'skipped';
                }

                // Track if suspicious nodes were detected
                let hasSuspiciousNodes = false;

                // Check if there are suspicious nodes and handle them
                if (metadata.suspiciousNodes && metadata.suspiciousNodes.length > 0) {
                    hasSuspiciousNodes = true;
                    await debugLog('=== SUSPICIOUS NODES DETECTED ===', item, 'warn');
                    await debugLog('Count: ' + metadata.suspiciousNodes.length, item, 'warn');
                    
                    for (var i = 0; i < metadata.suspiciousNodes.length; i++) {
                        var node = metadata.suspiciousNodes[i];
                        await debugLog('  Node ' + (i + 1) + ':', item, 'warn');
                        await debugLog('    ID: ' + node.nodeId, item, 'warn');
                        await debugLog('    Type: ' + node.nodeType, item, 'warn');
                        await debugLog('    Reason Key: ' + (node.reasonKey || 'unknown'), item, 'warn');
                        if (node.missingInputs && Array.isArray(node.missingInputs)) {
                            await debugLog('    Missing inputs: ' + JSON.stringify(node.missingInputs), item, 'warn');
                            await debugLog('    Reason: ' + (node.missingInputs.includes('latent_image') || node.missingInputs.includes('latent') ? 'Missing latent connection' : 
                                                            node.missingInputs.includes('image') ? 'Missing image connection' : 
                                                            'Missing required inputs: ' + node.missingInputs.join(', ')), item, 'warn');
                        }
                        if (node.affectedSteps && node.affectedSteps.length > 0) {
                            await debugLog('    Affected steps: ' + node.affectedSteps.length, item, 'warn');
                            for (var j = 0; j < node.affectedSteps.length; j++) {
                                var step = node.affectedSteps[j];
                                await debugLog('      Step ' + (j + 1) + ': index=' + step.stepIndex + ', nodeId=' + step.stepNodeId + ', type=' + step.stepNodeType, item, 'warn');
                            }
                        }
                    }
                    
                    if (suspiciousNodeHandling === 'exclude') {
                        await debugLog('Action: Automatically excluding suspicious nodes', item);
                        log('log.caution.suspicious_nodes_excluded', {name: item.name, count: metadata.suspiciousNodes.length});
                    } else if (suspiciousNodeHandling === 'include') {
                        await debugLog('Action: Including all nodes (ignoring suspicious status)', item);
                        log('log.caution.suspicious_nodes_included', {name: item.name, count: metadata.suspiciousNodes.length});
                    } else if (suspiciousNodeHandling === 'ask') {
                        await debugLog('Action: Showing dialog to user', item);
                        // Check if handleSuspiciousNodes is available
                        if (typeof window.handleSuspiciousNodes !== 'function') {
                            await debugLog('ERROR: window.handleSuspiciousNodes is not defined!', item, 'error');
                            log('log.error.generic', { name: item.name, message: 'Dialog function not available' });
                            // Fallback to exclude mode
                            log('log.caution.suspicious_nodes_excluded', {name: item.name, count: metadata.suspiciousNodes.length});
                        } else {
                            await debugLog('Showing suspicious node dialog', item);
                            
                            try {
                                // Show dialog and wait for user decision
                                const decision = await window.handleSuspiciousNodes(item, metadata.suspiciousNodes);
                                
                                await debugLog('User decision received: ' + JSON.stringify(decision), item);
                                
                                if (decision) {
                                    await debugLog('Re-parsing with user decision: action=' + decision.action, item);
                                    // Re-parse with user decision
                                    const metadataWithDecision = metadataService.extractPreferredMetadata(buffer, mimeType, 'comfyui', {
                                        suspiciousNodeHandling: decision.action, // Use user's decision ('exclude' or 'include')
                                        overrides: decision.overrides || {} // Apply per-node overrides if any
                                    });
                                    if (metadataWithDecision) {
                                        await debugLog('Metadata updated with user decision', item);
                                        Object.assign(metadata, metadataWithDecision);
                                    }
                                    
                                    // Log the decision
                                    if (decision.action === 'exclude') {
                                        log('log.caution.suspicious_nodes_excluded', {name: item.name, count: metadata.suspiciousNodes.length});
                                    } else if (decision.action === 'include') {
                                        log('log.caution.suspicious_nodes_included', {name: item.name, count: metadata.suspiciousNodes.length});
                                    }
                                } else {
                                    await debugLog('User cancelled dialog', item, 'warn');
                                }
                            } catch (error) {
                                await debugLog(`ERROR in handleSuspiciousNodes: ${error.message}`, item);
                                log('log.error.generic', { name: item.name, message: error.message });
                            }
                        }
                    }
                }

                // Pass parsed metadata directly to processMetadata
                const res = processMetadata(metadata, settings, t);
                
                let changed = false;
                if (settings.addTags && res.tags.size > 0) {
                    const current = new Set((item.tags || []).map(t => t.toLowerCase()));
                    const toAdd = Array.from(res.tags).filter(tag => !current.has(tag));
                    if (toAdd.length > 0) {
                        item.tags = [...(item.tags || []), ...toAdd];
                        changed = true;
                    }
                }
                if (settings.writeNotes && res.annotation) {
                    const marker = '[Generation Info]';
                    const current = item.annotation || '';
                    const idx = current.indexOf(marker);
                    item.annotation = idx !== -1 ? current.substring(0, idx).trim() + '\n\n' + res.annotation : (current ? current + '\n\n' : '') + res.annotation;
                    changed = true;
                }

                if (res.sampler_fallback) {
                    log('log.caution.sampler_fallback_item', {name: item.name});
                }

                if (changed) { 
                    await item.save();
                    // Enhanced log message with step count
                    if (res.stepCount && res.stepCount > 1) {
                        log('log.success', {name: `${item.name} (${res.stepCount} steps detected)`});
                    } else {
                        log('log.success', {name: item.name});
                    }
                    // Return caution if suspicious nodes were detected or sampler fallback was used
                    return (hasSuspiciousNodes || res.sampler_fallback) ? 'caution' : 'success';
                } else { 
                    log('log.skip', {name: item.name});
                    return 'skipped';
                }
            } catch (e) { 
                log('log.error.generic', { name: item.name, message: e.message });
                await debugLog(e.stack, item);
                return 'error';
            }
        };

        // Check if we need sequential processing (ask mode)
        const suspiciousNodeHandling = window.getSuspiciousNodeHandling ? window.getSuspiciousNodeHandling() : 'exclude';
        const forceSequential = suspiciousNodeHandling === 'ask';
        
        const result = await processItemsInChunks(items, processItem, forceSequential);
        log(isCancelled ? 'log.cancelled' : 'log.completed', result);
        setUIState(false); 
        
        // Trigger update if API supports it
        if (typeof eagle.item.trigger === 'function') {
            eagle.item.trigger("update", items);
        }
    }

    async function removeInfo(event) {
        isCancelled = false;
        logArea.innerHTML = '';
        log('log.delete.start');

        const isForceMode = event && event.shiftKey;

        const items = await eagle.item.getSelected();
        if (!items.length) { log('log.noItemSelected'); return; }
        
        const confirmMsg = isForceMode 
            ? t('confirm.forceDeleteAll', {count: items.length}) 
            : t('confirm.deleteAll', {count: items.length});

        if (!confirm(confirmMsg)) return;

        setUIState(true); // UIロック
        // 全ての設定をONにして、生成されうる全タグを取得対象とする
        const allSettingsOn = {
            checkpoint: true, lora: true, positive: true, negative: true,
            seed: true, sampler: true, steps: true, cfg: true,
            addTags: true, writeNotes: true,
            includeAllSamplers: true  // Include all samplers to ensure all tags are removed
        };
        
        await debugLog(`REMOVE (Force: ${isForceMode}): ${items.length} items`);
        
        if (checkboxes.debug.checked && DEBUG_LOG_FILE) {
            log('log.debugLogFile', { path: DEBUG_LOG_FILE });
        }

        const processItem = async (item) => {
            try {
                log('log.processingItem', {name: item.name});
                let changed = false;

                if (isForceMode) {
                    // --- Force Delete Mode: Remove ALL tags and annotations ---
                    if (item.tags && item.tags.length > 0) {
                        item.tags = [];
                        changed = true;
                    }
                    if (item.annotation) {
                        item.annotation = '';
                        changed = true;
                    }
                } else {
                    // --- Normal Mode ---
                    const ext = path.extname(item.filePath).toLowerCase();
                    const buffer = await fsp.readFile(item.filePath);
                    const mimeType = ext === '.png' ? 'image/png' : 'image/webp';
                    
                    // Use new MetadataService
                    const metadataService = new MetadataService();
                    const metadata = metadataService.extractPreferredMetadata(buffer, mimeType, 'comfyui');
                    
                    if (metadata) {
                        // Pass parsed metadata directly to processMetadata
                        const res = processMetadata(metadata, allSettingsOn, t);
                        
                        if (item.tags && item.tags.length > 0 && res.tags.size > 0) {
                            const beforeCount = item.tags.length;
                            item.tags = item.tags.filter(tag => !res.tags.has(tag.toLowerCase()));
                            if (item.tags.length < beforeCount) changed = true;
                        }
                    }
                }
                
                // Remove [Generation Info] annotation section (both modes)
                if (item.annotation) {
                    const newAnnotation = removeAnnotation(item.annotation);
                    if (newAnnotation !== item.annotation) {
                        item.annotation = newAnnotation;
                        changed = true;
                    }
                }

                if (changed) { 
                    await item.save(); 
                    log('log.delete.removing', {name: item.name});
                    return 'success';
                } else { 
                    log('log.delete.noneFound', {name: item.name});
                    return 'skipped';
                }
            } catch (e) { 
                log('log.error.generic', { name: item.name, message: e.message });
                return 'error';
            }
        };
        
        const result = await processItemsInChunks(items, processItem);
        
        if (isCancelled) log('log.delete.cancelledMessage', { removedCount: result.successCount, skippedCount: result.skippedCount, errorCount: result.errorCount });
        else log('log.delete.completed', { removedCount: result.successCount, skippedCount: result.skippedCount, errorCount: result.errorCount });
        
        setUIState(false); // UIロック解除
        
        // Trigger update if API supports it
        if (typeof eagle.item.trigger === 'function') {
            eagle.item.trigger("update", items);
        }
    }

    // --- 6. 設定保存・復元 ---
    const SETTINGS_KEY = 'comfyui-auto-tagger-settings';
    function saveSettings() {
        const s = {};
        for(const k in checkboxes) if(checkboxes[k]) s[k] = checkboxes[k].checked;
        // Save suspicious node handling setting
        if (suspiciousNodeHandlingSelect) {
            s.suspiciousNodeHandling = suspiciousNodeHandlingSelect.value;
        }
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    }
    function loadSettings() {
        try {
            const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
            if(s) {
                for(const k in checkboxes) {
                    if(checkboxes[k] && s[k] !== undefined) checkboxes[k].checked = s[k];
                }
                // Restore suspicious node handling setting
                if (suspiciousNodeHandlingSelect && s.suspiciousNodeHandling !== undefined) {
                    suspiciousNodeHandlingSelect.value = s.suspiciousNodeHandling;
                }
            }
        } catch(e) { console.error("Failed to load settings", e); }
    }

    // --- 7. 初期化 ---
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

    document.getElementById('startButton').onclick = () => { saveSettings(); startTagging(); };
    document.getElementById('deleteInfoButton').onclick = removeInfo;
    document.getElementById('cancelButton').onclick = () => isCancelled = true;
    
    // チェックボックス変更時にも保存
    for(const k in checkboxes) {
        if(checkboxes[k]) checkboxes[k].onchange = saveSettings;
    }
    
    // 疑わしいノードの処理方法変更時にも保存
    if (suspiciousNodeHandlingSelect) {
        suspiciousNodeHandlingSelect.onchange = saveSettings;
    }
    
    // Listen for settings changed event from settings dialog
    document.addEventListener('settingsChanged', saveSettings);
    
    console.log("Initialized.");
});
