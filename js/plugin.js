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

    // --- 3. メインアクション ---
    async function startTagging() {
        isCancelled = false;
        logBuffer = [];
        log('log.start');
        
        const items = await eagle.item.getSelected();
        if (!items.length) { log('log.noItemSelected'); return; }

        const settings = getSettings();
        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const item of items) {
            if (isCancelled) break;
            try {
                log('log.processingItem', {name: item.name});
                const ext = path.extname(item.filePath).toLowerCase();
                const buffer = await fsp.readFile(item.filePath);
                
                // core.js の関数を呼び出し
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
                    // 既存のノートを保持しつつ更新
                    const marker = '[Generation Info]';
                    const current = item.annotation || '';
                    const idx = current.indexOf(marker);
                    item.annotation = idx !== -1 ? current.substring(0, idx).trim() + '\n\n' + res.annotation : (current ? current + '\n\n' : '') + res.annotation;
                    changed = true;
                }
                if (changed) { 
                    await item.save(); 
                    log('log.success', {name: item.name});
                    successCount++;
                } else { 
                    log('log.skip', {name: item.name});
                    skippedCount++;
                }
            } catch (e) { 
                log('log.error.generic', { name: item.name, message: e.message }); 
                errorCount++;
            }
        }
        log(isCancelled ? 'log.cancelled' : 'log.completed', { successCount, skippedCount, errorCount });
    }

    async function removeInfo() {
        isCancelled = false;
        logBuffer = [];
        log('log.delete.start');

        const items = await eagle.item.getSelected();
        if (!items.length) { log('log.noItemSelected'); return; }
        if (!confirm(t('confirm.deleteAll', {count: items.length}))) return;

        // 全ての設定をONにして、生成されうる全タグを取得対象とする
        const allSettingsOn = {
            checkpoint: true, lora: true, positive: true, negative: true,
            seed: true, sampler: true, steps: true, cfg: true,
            addTags: true, writeNotes: true
        };

        let removedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const item of items) {
            if (isCancelled) break;
            try {
                log('log.processingItem', {name: item.name});
                const ext = path.extname(item.filePath).toLowerCase();
                const buffer = await fsp.readFile(item.filePath);
                
                const raw = getGenInfo(buffer, ext === '.png' ? 'image/png' : 'image/webp');
                const meta = extractComfyMetadata(raw);
                // 全てのタグ・アノテーションを抽出対象とするため、全設定ONで呼び出す
                const res = processMetadata(meta, allSettingsOn, t);
                
                let changed = false;
                
                // タグ削除
                if (item.tags && item.tags.length > 0 && res.tags.size > 0) {
                    const beforeCount = item.tags.length;
                    // 大文字小文字を区別せず削除
                    item.tags = item.tags.filter(tag => !res.tags.has(tag.toLowerCase()));
                    if (item.tags.length < beforeCount) changed = true;
                }

                // アノテーション削除
                if (item.annotation) {
                    const marker = '[Generation Info]';
                    const idx = item.annotation.indexOf(marker);
                    if (idx !== -1) {
                        // マーカーより前だけ残す（トリミング含む）
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
                    removedCount++;
                } else { 
                    log('log.delete.noneFound', {name: item.name});
                    skippedCount++;
                }
            } catch (e) { 
                log('log.error.generic', { name: item.name, message: e.message });
                errorCount++;
            }
        }
        
        if (isCancelled) log('log.delete.cancelledMessage', { removedCount, skippedCount, errorCount });
        else log('log.delete.completed', { removedCount, skippedCount, errorCount });
    }

    // --- 4. 初期化 ---
    (async () => {
        await initI18n();
        // localStorageからの設定読み込み等は省略
    })();

    document.getElementById('startButton').onclick = startTagging;
    document.getElementById('deleteInfoButton').onclick = removeInfo;
    document.getElementById('cancelButton').onclick = () => isCancelled = true;
});