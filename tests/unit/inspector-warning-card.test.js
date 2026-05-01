import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const inspectorPath = path.join(process.cwd(), 'inspector.html');
const inspectorExists = fs.existsSync(inspectorPath);
const inspectorContent = inspectorExists ? fs.readFileSync(inspectorPath, 'utf8') : '';

describe('Inspector Warning Card Structure Tests', () => {
  describe('CSS styles for warning card', () => {
    it.skipIf(!inspectorExists)('should have warning-card class styles defined', () => {
      expect(inspectorContent).toMatch(/\.warning-card\s*{/);
    });

    it.skipIf(!inspectorExists)('should have warning-node-item styles defined', () => {
      expect(inspectorContent).toMatch(/\.warning-node-item\s*{/);
    });

    it.skipIf(!inspectorExists)('should have has-warning tab style defined', () => {
      expect(inspectorContent).toMatch(/\.tab\.has-warning\s*{/);
    });

    it.skipIf(!inspectorExists)('should have warning-node-label styles defined', () => {
      expect(inspectorContent).toMatch(/\.warning-node-label\s*{/);
    });

    it.skipIf(!inspectorExists)('should have warning-node-value styles defined', () => {
      expect(inspectorContent).toMatch(/\.warning-node-value\s*{/);
    });

    it.skipIf(!inspectorExists)('should have warning-card-title styles defined', () => {
      expect(inspectorContent).toMatch(/\.warning-card-title\s*{/);
    });
  });

  describe('warning card color scheme', () => {
    it.skipIf(!inspectorExists)('should use amber/orange colors for warning card', () => {
      expect(inspectorContent).toMatch(/#f0a832|#d4860a|rgba\(240\s*,\s*168\s*,\s*50/);
    });
  });

  describe('JavaScript functions for warning card', () => {
    it.skipIf(!inspectorExists)('should define createWarningCard function', () => {
      expect(inspectorContent).toMatch(/function\s+createWarningCard\s*\(/);
    });

    it.skipIf(!inspectorExists)('should define resolveKey function', () => {
      expect(inspectorContent).toMatch(/function\s+resolveKey\s*\(/);
    });

    it.skipIf(!inspectorExists)('should define translation function t()', () => {
      expect(inspectorContent).toMatch(/function\s+t\s*\(/);
    });

    it.skipIf(!inspectorExists)('should have SUSPICIOUS_REASON_KEYS constant', () => {
      expect(inspectorContent).toMatch(/const\s+SUSPICIOUS_REASON_KEYS\s*=/);
    });

    it.skipIf(!inspectorExists)('should have SUSPICIOUS_SUGGESTION_KEYS constant', () => {
      expect(inspectorContent).toMatch(/const\s+SUSPICIOUS_SUGGESTION_KEYS\s*=/);
    });
  });

  describe('warning card toggle functionality', () => {
    it.skipIf(!inspectorExists)('should initialize warning card with display:none by default', () => {
      expect(inspectorContent).toMatch(/warningCard\.style\.display\s*=\s*['"]none['"]/);
    });

    it.skipIf(!inspectorExists)('should set data-warningId for card identification', () => {
      expect(inspectorContent).toMatch(/warningCard\.dataset\.warningId\s*=/);
    });

    it.skipIf(!inspectorExists)('should set panel dataset.warningId to match card', () => {
      expect(inspectorContent).toMatch(/panel\.dataset\.warningId\s*=\s*warningCard\.dataset\.warningId/);
    });

    it.skipIf(!inspectorExists)('should toggle warning card visibility on tab click', () => {
      expect(inspectorContent).toMatch(/warningCard\.style\.display\s*=\s*warningCard\.style\.display\s*===\s*['"]none['"]/);
    });
  });

  describe('warning card content structure', () => {
    it.skipIf(!inspectorExists)('should create title element with translation key', () => {
      expect(inspectorContent).toMatch(/t\(['"]suspiciousNode\.warningCardTitle/);
    });

    it.skipIf(!inspectorExists)('should create node label with translation key', () => {
      expect(inspectorContent).toMatch(/t\(['"]suspiciousNode\.nodeLabel/);
    });

    it.skipIf(!inspectorExists)('should create reason label with translation key', () => {
      expect(inspectorContent).toMatch(/t\(['"]suspiciousNode\.reasonLabel/);
    });

    it.skipIf(!inspectorExists)('should create suggestion label with translation key', () => {
      expect(inspectorContent).toMatch(/t\(['"]suspiciousNode\.suggestionLabel/);
    });

    it.skipIf(!inspectorExists)('should resolve reason keys via resolveKey function', () => {
      expect(inspectorContent).toMatch(/resolveKey\(\s*true\s*,\s*node\.reasonKey/);
    });

    it.skipIf(!inspectorExists)('should resolve suggestion keys via resolveKey function', () => {
      expect(inspectorContent).toMatch(/resolveKey\(\s*false\s*,\s*node\.suggestionKey/);
    });
  });
});
