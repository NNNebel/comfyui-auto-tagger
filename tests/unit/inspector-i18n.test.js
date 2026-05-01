import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const enLocale = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), '_locales/en.json'), 'utf8'
));
const jaLocale = JSON.parse(fs.readFileSync(
  path.join(process.cwd(), '_locales/ja_JP.json'), 'utf8'
));

describe('Inspector i18n Tests', () => {

  describe('suspiciousNode translation keys', () => {
    it('should have all required warning card keys in en.json', () => {
      const suspiciousNode = enLocale.suspiciousNode;
      expect(suspiciousNode).toHaveProperty('warningCardTitle');
      expect(suspiciousNode).toHaveProperty('nodeLabel');
      expect(suspiciousNode).toHaveProperty('reasonLabel');
      expect(suspiciousNode).toHaveProperty('suggestionLabel');
    });

    it('should have all required warning card keys in ja_JP.json', () => {
      const suspiciousNode = jaLocale.suspiciousNode;
      expect(suspiciousNode).toHaveProperty('warningCardTitle');
      expect(suspiciousNode).toHaveProperty('nodeLabel');
      expect(suspiciousNode).toHaveProperty('reasonLabel');
      expect(suspiciousNode).toHaveProperty('suggestionLabel');
    });

    it('should have all reason keys in en.json', () => {
      const reasons = enLocale.suspiciousNode.reason;
      expect(reasons).toHaveProperty('imageProcessingNoInput');
      expect(reasons).toHaveProperty('vaeEncodeNoInput');
      expect(reasons).toHaveProperty('vaeDecodeNoInput');
      expect(reasons).toHaveProperty('samplerNoInput');
      expect(reasons).toHaveProperty('missingInput');
    });

    it('should have all reason keys in ja_JP.json', () => {
      const reasons = jaLocale.suspiciousNode.reason;
      expect(reasons).toHaveProperty('imageProcessingNoInput');
      expect(reasons).toHaveProperty('vaeEncodeNoInput');
      expect(reasons).toHaveProperty('vaeDecodeNoInput');
      expect(reasons).toHaveProperty('samplerNoInput');
      expect(reasons).toHaveProperty('missingInput');
    });

    it('should have all suggestion keys in en.json', () => {
      const suggestions = enLocale.suspiciousNode.suggestion;
      expect(suggestions).toHaveProperty('disconnected');
      expect(suggestions).toHaveProperty('vaeEncodeRequired');
      expect(suggestions).toHaveProperty('vaeDecodeRequired');
      expect(suggestions).toHaveProperty('samplerRequired');
    });

    it('should have all suggestion keys in ja_JP.json', () => {
      const suggestions = jaLocale.suspiciousNode.suggestion;
      expect(suggestions).toHaveProperty('disconnected');
      expect(suggestions).toHaveProperty('vaeEncodeRequired');
      expect(suggestions).toHaveProperty('vaeDecodeRequired');
      expect(suggestions).toHaveProperty('samplerRequired');
    });
  });

  describe('warning card content', () => {
    it('en.json warningCardTitle should contain warning emoji', () => {
      expect(enLocale.suspiciousNode.warningCardTitle).toContain('⚠️');
    });

    it('ja_JP.json warningCardTitle should contain warning emoji', () => {
      expect(jaLocale.suspiciousNode.warningCardTitle).toContain('⚠️');
    });

    it('reason strings should support parameter interpolation', () => {
      const enReason = enLocale.suspiciousNode.reason.imageProcessingNoInput;
      const jaReason = jaLocale.suspiciousNode.reason.imageProcessingNoInput;
      expect(enReason).toContain('{{nodeType}}');
      expect(jaReason).toContain('{{nodeType}}');
    });

    it('should have consistent key structure between en and ja_JP', () => {
      const enReasonKeys = Object.keys(enLocale.suspiciousNode.reason).sort();
      const jaReasonKeys = Object.keys(jaLocale.suspiciousNode.reason).sort();
      expect(enReasonKeys).toEqual(jaReasonKeys);

      const enSuggKeys = Object.keys(enLocale.suspiciousNode.suggestion).sort();
      const jaSuggKeys = Object.keys(jaLocale.suspiciousNode.suggestion).sort();
      expect(enSuggKeys).toEqual(jaSuggKeys);
    });
  });
});
