document.addEventListener('DOMContentLoaded', () => {

    const fsp = require('fs').promises;
    const path = require('path');
    let ExifReader;

    try {
        ExifReader = require('exifreader');
    } catch (error) {
        try {
            ExifReader = require('../node_modules/exifreader');
        } catch (e) {
            const errorMsg = 'Failed to load exifreader. Please run "npm install exifreader" in your plugin directory.';
            console.error(errorMsg, e);
            alert(errorMsg);
            return;
        }
    }

    const startButton = document.getElementById('startButton');
    const deleteTagsButton = document.getElementById('deleteTagsButton');
    const cancelButton = document.getElementById('cancelButton');
    const logArea = document.getElementById('log');
    const chkCheckpoint = document.getElementById('chk-checkpoint');
    const chkLora = document.getElementById('chk-lora');
    const chkPositive = document.getElementById('chk-positive');
    const chkNegative = document.getElementById('chk-negative');
    const chunkSizeInput = document.getElementById('chunk-size');

    let isCancelled = false;
    let logBuffer = [];
    const MAX_LOG_LINES = 100;

    if (!startButton || !deleteTagsButton || !cancelButton || !logArea || !chkCheckpoint || !chkLora || !chkPositive || !chkNegative || !chunkSizeInput) {
        console.error("One or more UI elements could not be found. Aborting initialization.");
        return;
    }

    function log(message) {
        console.log(message);
        logBuffer.push(message);
        if (logBuffer.length > MAX_LOG_LINES) {
            logBuffer.shift();
        }
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
            if (promptNode && promptNode.inputs?.text) {
                candidates.push(...cleanAndSplitPrompt(promptNode.inputs.text));
            }
        }
        if (chkNegative.checked) {
            const nodeId = ksampler.inputs?.negative?.[0];
            const promptNode = nodeObjectById[nodeId];
            if (promptNode && promptNode.inputs?.text) {
                candidates.push(...cleanAndSplitPrompt(promptNode.inputs.text, 'neg:'));
            }
        }
        return candidates;
    }

    function resetButtons() {
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
        log('処理を開始します...');

        try {
            const items = await eagle.item.getSelected();
            if (items.length === 0) {
                log('画像が選択されていません。');
                resetButtons();
                return;
            }
            log(`${items.length}個のアイテムを処理します。`);

            const chunkSize = parseInt(chunkSizeInput.value, 10) || 5;
            let currentIndex = 0;
            let successCount = 0;
            let errorCount = 0;

            const processItem = async (item) => {
                let buffer = null, exifTags = null, workflow = null;
                try {
                    log(`[処理中] ${item.name}`);
                    buffer = await fsp.readFile(item.filePath);
                    exifTags = ExifReader.load(buffer);
                    let workflowJsonString = null;
                    if (exifTags['Model']?.description) workflowJsonString = exifTags['Model'].description.replace(/^prompt:/, '');
                    else if (exifTags['Make']?.description) workflowJsonString = exifTags['Make'].description.replace(/^workflow:/, '');
                    if (!workflowJsonString) {
                        log(`[エラー] ${item.name}: ComfyUIのWorkflow情報が見つかりませんでした。`);
                        errorCount++;
                        return;
                    }
                    const cleanedJsonString = workflowJsonString.replace(/^UNICODE\u0000+/, '').trim();
                    try {
                        workflow = JSON.parse(cleanedJsonString);
                    } catch (e) {
                        log(`[エラー] ${item.name}: WorkflowのJSONパースに失敗しました。`);
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
                        log(`[情報] ${item.name}: 解析可能なノードが見つかりませんでした。`);
                        return;
                    }
                    const finalTags = item.tags ? [...item.tags] : [];
                    const finalTagSet = new Set(finalTags);
                    const addedTags = [];
                    const allCandidates = [...getCheckpointAndLoraTags(nodesToProcess), ...getPromptTags(nodesToProcess, nodeObjectById)];
                    for (const tag of allCandidates) {
                        if (!finalTagSet.has(tag)) {
                            finalTags.push(tag);
                            finalTagSet.add(tag);
                            addedTags.push(tag);
                        }
                    }
                    if (addedTags.length > 0) {
                        log(`  -> 追加されたタグ (${addedTags.length}個): ${addedTags.join(', ')}`);
                        item.tags = finalTags;
                        await item.save();
                        log(`[成功] ${item.name}: タグを保存しました。`);
                        successCount++;
                    } else {
                        log(`[スキップ] ${item.name}: 抽出されたタグはすべて既に存在するため、更新は行いません。`);
                    }
} catch (error) {
                    log(`[致命的エラー] ${item.name}: ${error.message}`);
                    console.error(error);
                    errorCount++;
                } finally {
                    buffer = null;
                    exifTags = null;
                    workflow = null;
                }
            };

            const processChunk = async () => {
                if (isCancelled) {
                    log('------------------------------------');
                    log(`処理が中止されました。 (完了: ${successCount}, 失敗: ${errorCount})`);
                    resetButtons();
                    return;
                }
                const chunk = items.slice(currentIndex, currentIndex + chunkSize);
                if (chunk.length === 0) {
                    log('------------------------------------');
                    log(`全ての処理が完了しました。 (成功: ${successCount}, 失敗: ${errorCount})`);
                    resetButtons();
                    return;
                }
                await Promise.all(chunk.map(item => processItem(item)));
                currentIndex += chunkSize;
                const progress = Math.min(currentIndex, items.length);
                log(`... ${progress} / ${items.length} 件 処理完了 ...`);
                setTimeout(processChunk, 50);
            };
            processChunk();
        } catch (e) {
            log(`[致命的エラー] 初期化中に問題が発生しました: ${e.message}`);
            console.error(e);
            resetButtons();
        }
    }

    async function deleteSelectedItemsTags() {
        try {
            const items = await eagle.item.getSelected();
            if (items.length === 0) {
                alert('アイテムが選択されていません。');
                return;
            }
            if (!confirm(`選択中の${items.length}個のアイテムから全てのタグを削除します。よろしいですか？`)) {
                log('タグの削除をキャンセルしました。');
                return;
            }
            
            startButton.disabled = true;
            deleteTagsButton.disabled = true;
            cancelButton.style.display = 'inline-block';
            cancelButton.disabled = false;
            isCancelled = false;

            logBuffer = [];
            log(`${items.length}個のアイテムのタグを削除します...`);
            
            const chunkSize = parseInt(chunkSizeInput.value, 10) || 5;
            let currentIndex = 0;
            let deletedCount = 0;
            let skippedCount = 0;

            const processChunkAndDelete = async () => {
                if (isCancelled) {
                    log('------------------------------------');
                    log(`タグの削除が中止されました。 (削除: ${deletedCount}, スキップ: ${skippedCount})`);
                    resetButtons();
                    return;
                }

                const chunk = items.slice(currentIndex, currentIndex + chunkSize);
                if(chunk.length === 0){
                    log('------------------------------------');
                    log(`選択されたアイテムのタグ削除が完了しました。 (削除: ${deletedCount}, スキップ: ${skippedCount})`);
                    resetButtons();
                    return;
                }
                
                await Promise.all(chunk.map(async (item) => {
                    if (item.tags && item.tags.length > 0) {
                        log(`[削除中] ${item.name}`);
                        item.tags = [];
                        await item.save();
                        deletedCount++;
                    } else {
                        log(`[スキップ] ${item.name} にはタグがありません。`);
                        skippedCount++;
                    }
                }));

                currentIndex += chunkSize;
                const progress = Math.min(currentIndex, items.length);
                log(`... ${progress} / ${items.length} 件 削除完了 ...`);
                
                setTimeout(processChunkAndDelete, 50);
            };

            processChunkAndDelete();

        } catch (error) {
            log(`[エラー] タグ削除中にエラーが発生しました: ${error.message}`);
            resetButtons();
        }
    }

    startButton.addEventListener('click', startTagging);
    deleteTagsButton.addEventListener('click', deleteSelectedItemsTags);
    cancelButton.addEventListener('click', () => {
        if (!isCancelled) {
            isCancelled = true;
            cancelButton.disabled = true;
            log('... 処理を中止しています ...');
        }
    });
});
