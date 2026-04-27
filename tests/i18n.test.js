import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('i18n Consistency Tests', () => {
    const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../_locales/en.json'), 'utf8'));
    const ja = JSON.parse(fs.readFileSync(path.join(__dirname, '../_locales/ja_JP.json'), 'utf8'));

    // 再帰的に全てのキーを取得する関数
    const getAllKeys = (obj, prefix = '') => {
        return Object.keys(obj).reduce((res, el) => {
            if (Array.isArray(obj[el])) return res;
            if (typeof obj[el] === 'object' && obj[el] !== null) {
                return [...res, ...getAllKeys(obj[el], prefix + el + '.')];
            }
            return [...res, prefix + el];
        }, []);
    };

    const enKeys = getAllKeys(en);
    const jaKeys = getAllKeys(ja);

    it('should have all keys from en.json in ja_JP.json', () => {
        enKeys.forEach(key => {
            expect(jaKeys).toContain(key);
        });
    });

    it('should have all keys from ja_JP.json in en.json', () => {
        jaKeys.forEach(key => {
            expect(enKeys).toContain(key);
        });
    });
});

describe('i18n Usage Validation', () => {
    const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../_locales/en.json'), 'utf8'));
    const ja = JSON.parse(fs.readFileSync(path.join(__dirname, '../_locales/ja_JP.json'), 'utf8'));

    // 再帰的に全てのキーを取得する関数
    const getAllKeys = (obj, prefix = '') => {
        return Object.keys(obj).reduce((res, el) => {
            if (Array.isArray(obj[el])) return res;
            if (typeof obj[el] === 'object' && obj[el] !== null) {
                return [...res, ...getAllKeys(obj[el], prefix + el + '.')];
            }
            return [...res, prefix + el];
        }, []);
    };

    const enKeys = new Set(getAllKeys(en));
    const jaKeys = new Set(getAllKeys(ja));

    // コード内で使用されている翻訳キーを抽出
    const extractUsedKeys = (filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        const keys = new Set();

        // log('key', ...) パターン（console.logを除外）
        // 前に console. がないことを確認
        const logMatches = content.matchAll(/(?<!console\.)\blog\s*\(\s*['"]([^'"]+)['"]/g);
        for (const match of logMatches) {
            keys.add(match[1]);
        }

        // t('key') パターン（変数宣言を除外）
        const tMatches = content.matchAll(/(?<!const\s+)\bt\s*\(\s*['"]([^'"]+)['"]/g);
        for (const match of tMatches) {
            keys.add(match[1]);
        }

        return keys;
    };

    // plugin.js と index.html から使用されているキーを抽出
    const pluginKeys = extractUsedKeys(path.join(__dirname, '../js/plugin.js'));
    const indexKeys = extractUsedKeys(path.join(__dirname, '../index.html'));
    const inspectorKeys = extractUsedKeys(path.join(__dirname, '../inspector.html'));
    const allUsedKeys = new Set([...pluginKeys, ...indexKeys, ...inspectorKeys]);

    it('should have all translation keys used in plugin.js defined in locale files', () => {
        const missingKeys = [];
        for (const key of allUsedKeys) {
            if (!enKeys.has(key) && !jaKeys.has(key)) {
                missingKeys.push(key);
            }
        }

        if (missingKeys.length > 0) {
            expect.fail(`Missing translation keys: ${missingKeys.join(', ')}`);
        }
    });

    it('should have all translation keys used in plugin.js defined in en.json', () => {
        const missingKeys = [];
        for (const key of allUsedKeys) {
            if (!enKeys.has(key)) {
                missingKeys.push(key);
            }
        }

        if (missingKeys.length > 0) {
            expect.fail(`Missing translation keys in en.json: ${missingKeys.join(', ')}`);
        }
    });

    it('should have all translation keys used in plugin.js defined in ja_JP.json', () => {
        const missingKeys = [];
        for (const key of allUsedKeys) {
            if (!jaKeys.has(key)) {
                missingKeys.push(key);
            }
        }

        if (missingKeys.length > 0) {
            expect.fail(`Missing translation keys in ja_JP.json: ${missingKeys.join(', ')}`);
        }
    });

    // Detect hardcoded Japanese text in HTML files (outside of <script>, <style>, and comments)
    it('should not have hardcoded Japanese text in index.html (except icons)', () => {
        const indexContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

        // Remove script, style tags and HTML comments
        let cleaned = indexContent.replace(/<script[\s\S]*?<\/script>/g, '');
        cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/g, '');
        cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

        const japanesePattern = /[぀-ゟ゠-ヿ一-鿿가-힯]/g;
        const lines = cleaned.split('\n');
        const hardcodedLines = [];

        lines.forEach((line, idx) => {
            // Skip lines that contain t() calls (already translated)
            if (line.includes("t('") || line.includes('t("')) return;

            const match = line.match(japanesePattern);
            if (match && match.length > 0) {
                hardcodedLines.push({ line: idx + 1, content: line.trim() });
            }
        });

        if (hardcodedLines.length > 0) {
            const details = hardcodedLines.map(h => `Line ${h.line}: ${h.content}`).join('\n');
            expect.fail(`Found hardcoded Japanese text in index.html that should be translated:\n${details}`);
        }
    });

    it('should not have hardcoded Japanese text in inspector.html (except icons)', () => {
        const inspectorContent = fs.readFileSync(path.join(__dirname, '../inspector.html'), 'utf8');

        // Remove script, style tags and HTML comments
        let cleaned = inspectorContent.replace(/<script[\s\S]*?<\/script>/g, '');
        cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/g, '');
        cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

        const japanesePattern = /[぀-ゟ゠-ヿ一-鿿가-힯]/g;
        const lines = cleaned.split('\n');
        const hardcodedLines = [];

        lines.forEach((line, idx) => {
            // Skip lines that contain t() calls (already translated)
            if (line.includes("t('") || line.includes('t("')) return;

            const match = line.match(japanesePattern);
            if (match && match.length > 0) {
                hardcodedLines.push({ line: idx + 1, content: line.trim() });
            }
        });

        if (hardcodedLines.length > 0) {
            const details = hardcodedLines.map(h => `Line ${h.line}: ${h.content}`).join('\n');
            expect.fail(`Found hardcoded Japanese text in inspector.html that should be translated:\n${details}`);
        }
    });
});
