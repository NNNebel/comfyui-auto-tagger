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
            'chk-add-tags': 'ui.option.addTags', 'chk-write-notes': 'ui.option.writeNotes'
        };
        document.querySelector('h1').textContent = t('ui.title');
        for (const [id, key] of Object.entries(labelMap)) {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) label.textContent = t(key);
        }
        
        // セクションタイトルの翻訳
        const sectionTitles = document.querySelectorAll('.section-title');
        if(sectionTitles[0]) sectionTitles[0].textContent = t('ui.outputSettings');
        if(sectionTitles[1]) sectionTitles[1].textContent = t('ui.extractionTarget');

        // チャンクサイズラベルの翻訳
        const chunkSizeLabel = document.querySelector('label[for="chunk-size"]');
        if (chunkSizeLabel) chunkSizeLabel.textContent = t('ui.config.chunkSize');

        document.getElementById('startButton').textContent = t('ui.button.start');
        document.getElementById('deleteInfoButton').textContent = t('ui.button.deleteInfo');
        document.getElementById('cancelButton').textContent = t('ui.button.cancel');
    }

    // --- 2. ステート管理 ---
    let isCancelled = false;
    let logBuffer = [];
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
        writeNotes: document.getElementById('chk-write-notes')
    };

    function getSettings() {
        const s = {};
        for(const k in checkboxes) s[k] = checkboxes[k].checked;
        return s;
    }

    function log(key, replacements={}) {
        const msg = t(key, replacements);
        logBuffer.push(msg);
        if (logBuffer.length > 100) logBuffer.shift();
        logArea.textContent = logBuffer.join('\n');
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
        let processedCount = 0;

        updateProgress(0, items.length);

        for (let i = 0; i < items.length; i += chunkSize) {
            if (isCancelled) break;
            const chunk = items.slice(i, i + chunkSize);
            
            // 並列処理だが、UIスレッドをブロックしないようPromise.allSettled待機
            const results = await Promise.allSettled(chunk.map(processFn));

            results.forEach(result => {
                processedCount++;
                if (result.status === 'fulfilled') {
                    const status = result.value; // 'success', 'skipped', 'error'
                    if (status === 'success') successCount++;
                    else if (status === 'skipped') skippedCount++;
                    else errorCount++;
                } else {
                    errorCount++;
                }
            });
            updateProgress(processedCount, items.length);
            
            // UI更新のための微小なウェイト
            await new Promise(r => setTimeout(r, 10));
        }
        return { successCount, skippedCount, errorCount };
    }

    // --- 5. メインアクション ---
    async function startTagging() {
        isCancelled = false;
        logBuffer = [];
        log('log.start');
        
        const items = await eagle.item.getSelected();
        if (!items.length) { log('log.noItemSelected'); return; }

        setUIState(true); // UIロック & プログレスバー表示
        const settings = getSettings();

        // 個別のアイテム処理関数
        const processItem = async (item) => {
            try {
                log('log.processingItem', {name: item.name});
                const ext = path.extname(item.filePath).toLowerCase();
                const buffer = await fsp.readFile(item.filePath);
                
                const raw = getGenInfo(buffer, ext === '.png' ? 'image/png' : 'image/webp');
                const meta = extractComfyMetadata(raw);
                const res = processMetadata(meta, settings, t);
                
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
                if (changed) { 
                    await item.save(); 
                    log('log.success', {name: item.name});
                    return 'success';
                } else { 
                    log('log.skip', {name: item.name});
                    return 'skipped';
                }
            } catch (e) { 
                log('log.error.generic', { name: item.name, message: e.message });
                return 'error';
            }
        };

        const result = await processItemsInChunks(items, processItem);
        log(isCancelled ? 'log.cancelled' : 'log.completed', result);
        setUIState(false); // UIロック解除
    }

    async function removeInfo() {
        isCancelled = false;
        logBuffer = [];
        log('log.delete.start');

        const items = await eagle.item.getSelected();
        if (!items.length) { log('log.noItemSelected'); return; }
        if (!confirm(t('confirm.deleteAll', {count: items.length}))) return;

        setUIState(true); // UIロック
        const allSettingsOn = {
            checkpoint: true, lora: true, positive: true, negative: true,
            seed: true, sampler: true, steps: true, cfg: true,
            addTags: true, writeNotes: true
        };

        const processItem = async (item) => {
            try {
                log('log.processingItem', {name: item.name});
                const ext = path.extname(item.filePath).toLowerCase();
                const buffer = await fsp.readFile(item.filePath);
                
                const raw = getGenInfo(buffer, ext === '.png' ? 'image/png' : 'image/webp');
                const meta = extractComfyMetadata(raw);
                const res = processMetadata(meta, allSettingsOn, t);
                
                let changed = false;
                if (item.tags && item.tags.length > 0 && res.tags.size > 0) {
                    const beforeCount = item.tags.length;
                    item.tags = item.tags.filter(tag => !res.tags.has(tag.toLowerCase()));
                    if (item.tags.length < beforeCount) changed = true;
                }

                if (item.annotation) {
                    const marker = '[Generation Info]';
                    const idx = item.annotation.indexOf(marker);
                    if (idx !== -1) {
                        const newAnnotation = item.annotation.substring(0, idx).trim();
                        if (newAnnotation !== item.annotation) {
                            item.annotation = newAnnotation;
                            changed = true;
                        }
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
});