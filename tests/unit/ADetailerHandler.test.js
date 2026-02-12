import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ADetailerHandler = require('../../js/metadata-parser/parameters/ADetailerHandler.js');

describe('ADetailerHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new ADetailerHandler();
  });

  describe('canHandle', () => {
    it('should handle parameters starting with "ADetailer "', () => {
      expect(handler.canHandle('ADetailer model')).toBe(true);
      expect(handler.canHandle('ADetailer confidence')).toBe(true);
      expect(handler.canHandle('ADetailer prompt')).toBe(true);
    });

    it('should not handle other parameters', () => {
      expect(handler.canHandle('Steps')).toBe(false);
      expect(handler.canHandle('ADetailer')).toBe(false);
      expect(handler.canHandle('adetailer model')).toBe(false);
    });
  });

  describe('handle', () => {
    it('should extract parameter name and value', () => {
      const result = handler.handle('ADetailer model', 'face_yolov8n.pt', {});
      expect(result).toEqual({
        adetailer: {
          model: 'face_yolov8n.pt'
        }
      });
    });

    it('should auto-detect integer values', () => {
      const result = handler.handle('ADetailer steps', '20', {});
      expect(result).toEqual({
        adetailer: {
          steps: 20
        }
      });
    });

    it('should auto-detect float values', () => {
      const result = handler.handle('ADetailer confidence', '0.3', {});
      expect(result).toEqual({
        adetailer: {
          confidence: 0.3
        }
      });
    });

    it('should auto-detect boolean values', () => {
      expect(handler.handle('ADetailer enabled', 'True', {})).toEqual({
        adetailer: { enabled: true }
      });
      expect(handler.handle('ADetailer enabled', 'False', {})).toEqual({
        adetailer: { enabled: false }
      });
      expect(handler.handle('ADetailer enabled', 'true', {})).toEqual({
        adetailer: { enabled: true }
      });
      expect(handler.handle('ADetailer enabled', 'false', {})).toEqual({
        adetailer: { enabled: false }
      });
    });

    it('should keep string values as strings', () => {
      const result = handler.handle('ADetailer prompt', 'detailed face', {});
      expect(result).toEqual({
        adetailer: {
          prompt: 'detailed face'
        }
      });
    });

    it('should handle negative numbers', () => {
      expect(handler.handle('ADetailer value', '-10', {})).toEqual({
        adetailer: { value: -10 }
      });
      expect(handler.handle('ADetailer value', '-0.5', {})).toEqual({
        adetailer: { value: -0.5 }
      });
    });

    it('should handle parameter names with spaces', () => {
      const result = handler.handle('ADetailer mask blur', '4', {});
      expect(result).toEqual({
        adetailer: {
          'mask blur': 4
        }
      });
    });
  });

  describe('getPriority', () => {
    it('should return medium priority', () => {
      expect(handler.getPriority()).toBe(30);
    });
  });
});
