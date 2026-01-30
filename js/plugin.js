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
        if(sectionTitles[1]) sectionTitles[1].textContent = t('ui.extractionTarget');

        const chunkSizeLabel = document.querySelector('label[for="chunk-size"]');
        if (chunkSizeLabel) chunkSizeLabel.textContent = t('ui.config.chunkSize');

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
        debug: document.getElementById('chk-debug-log')
    };

    // --- 2.1 Debug Logging ---
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
    async function processItemsInChunks(items, processFn) {
        const chunkSize = parseInt(chunkSizeInput.value, 10) || 5;
        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        let cautionCount = 0;
        let processedCount = 0;

        updateProgress(0, items.length);

        for (let i = 0; i < items.length; i += chunkSize) {
            if (isCancelled) break;
            const chunk = items.slice(i, i + chunkSize);
            
            const results = await Promise.allSettled(chunk.map(processFn));

            results.forEach(result => {
                processedCount++;
                if (result.status === 'fulfilled') {
                    const status = result.value; // 'success', 'skipped', 'error', 'caution'
                    if (status === 'success') successCount++;
                    else if (status === 'skipped') skippedCount++;
                    else if (status === 'caution') { successCount++; cautionCount++; }
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
        
        const items = await eagle.item.getSelected();
        if (!items.length) { log('log.noItemSelected'); return; }

        setUIState(true); 
        const settings = getSettings();
        
        if (checkboxes.debug.checked) log(`[Debug] Log file: ${DEBUG_LOG_FILE}`);
        await debugLog(`START: ${items.length} items`);

        // Initialize MetadataService
        const metadataService = new MetadataService();

        const processItem = async (item) => {
            try {
                log('log.processingItem', {name: item.name});
                const ext = path.extname(item.filePath).toLowerCase();
                const buffer = await fsp.readFile(item.filePath);
                const mimeType = ext === '.png' ? 'image/png' : 'image/webp';
                
                // Use new MetadataService
                const metadata = metadataService.extractPreferredMetadata(buffer, mimeType, 'comfyui');
                await debugLog(`Metadata: ${JSON.stringify(metadata)}`, item);

                if (!metadata) {
                    log('log.noMetadata', {name: item.name});
                    return 'skipped';
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
                    return res.sampler_fallback ? 'caution' : 'success';
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

        const result = await processItemsInChunks(items, processItem);
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
            addTags: true, writeNotes: true
        };
        
        await debugLog(`REMOVE (Force: ${isForceMode}): ${items.length} items`);

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
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    }
    function loadSettings() {
        try {
            const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
            if(s) {
                for(const k in checkboxes) {
                    if(checkboxes[k] && s[k] !== undefined) checkboxes[k].checked = s[k];
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
    
    console.log("Initialized.");
});
