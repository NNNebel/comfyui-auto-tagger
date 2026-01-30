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
    const allUsedKeys = new Set([...pluginKeys, ...indexKeys]);

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
});
