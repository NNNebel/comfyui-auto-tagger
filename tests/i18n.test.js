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
