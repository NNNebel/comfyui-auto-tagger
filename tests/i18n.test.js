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

    // Detect hardcoded text (both Japanese and English) that should be translated
    it('should use i18n for all UI text in index.html', () => {
        const indexContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

        // Remove script, style tags and HTML comments
        let cleaned = indexContent.replace(/<script[\s\S]*?<\/script>/g, '');
        cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/g, '');
        cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
        // Remove img alt text and title attributes (not part of visible UI)
        cleaned = cleaned.replace(/\s(?:alt|title|placeholder)="[^"]*"/g, '');

        const lines = cleaned.split('\n');
        const suspiciousLines = [];

        lines.forEach((line, idx) => {
            // Skip lines that contain t() calls or are just HTML tags
            if (line.includes("t('") || line.includes('t("')) return;
            if (line.trim().match(/^<[^>]*>$|^<\/[^>]*>$/)) return;

            // Detect Japanese text
            const japanesePattern = /[ぁ-ゟ゠-ヿァ-ヴー一-鿿々〆〤]/;
            // Detect suspicious English UI text (capitalized words that look like labels)
            // But skip common HTML attributes and technical terms
            const englishPattern = />\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*</;

            if (japanesePattern.test(line)) {
                suspiciousLines.push({ line: idx + 1, content: line.trim(), reason: 'Japanese text' });
            } else {
                const match = line.match(englishPattern);
                if (match && !['DOCTYPE', 'HTML', 'Head', 'Body', 'Meta', 'Link', 'Div', 'Span', 'Input', 'Label', 'Button'].includes(match[1])) {
                    suspiciousLines.push({ line: idx + 1, content: line.trim(), reason: `Possible hardcoded UI text: "${match[1]}"` });
                }
            }
        });

        if (suspiciousLines.length > 0) {
            const details = suspiciousLines.map(h => `Line ${h.line} [${h.reason}]: ${h.content}`).join('\n');
            expect.fail(`Found text that should be translated in index.html:\n${details}`);
        }
    });

    it('should use i18n for all UI text in inspector.html', () => {
        const inspectorContent = fs.readFileSync(path.join(__dirname, '../inspector.html'), 'utf8');

        // Remove script, style tags and HTML comments
        let cleaned = inspectorContent.replace(/<script[\s\S]*?<\/script>/g, '');
        cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/g, '');
        cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
        // Remove attributes
        cleaned = cleaned.replace(/\s(?:alt|title|placeholder|href|src)="[^"]*"/g, '');

        const lines = cleaned.split('\n');
        const suspiciousLines = [];

        lines.forEach((line, idx) => {
            // Skip lines with t() calls or just HTML tags
            if (line.includes("t('") || line.includes('t("') || line.includes('textContent') || line.includes('appendChild')) return;
            if (line.trim().match(/^<[^>]*>$|^<\/[^>]*>$/)) return;

            // Detect Japanese text
            const japanesePattern = /[ぁ-ゟ゠-ヿァ-ヴー一-鿿々〆〤]/;
            // Detect suspicious English UI text
            const englishPattern = />\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*</;

            if (japanesePattern.test(line)) {
                suspiciousLines.push({ line: idx + 1, content: line.trim(), reason: 'Japanese text' });
            } else {
                const match = line.match(englishPattern);
                if (match && !['Div', 'Span', 'P', 'Br', 'Copy', 'Copied'].includes(match[1])) {
                    suspiciousLines.push({ line: idx + 1, content: line.trim(), reason: `Possible hardcoded UI text: "${match[1]}"` });
                }
            }
        });

        if (suspiciousLines.length > 0) {
            const details = suspiciousLines.map(h => `Line ${h.line} [${h.reason}]: ${h.content}`).join('\n');
            expect.fail(`Found text that should be translated in inspector.html:\n${details}`);
        }
    });
});
