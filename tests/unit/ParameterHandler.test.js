import { describe, it, expect } from 'vitest';
import ParameterHandler from '../../js/metadata-parser/parameters/ParameterHandler.js';

describe('ParameterHandler', () => {
  describe('Base class behavior', () => {
    it('should throw error when canHandle is not implemented', () => {
      const handler = new ParameterHandler();
      expect(() => handler.canHandle('test')).toThrow('ParameterHandler.canHandle() must be implemented by subclass');
    });

    it('should throw error when handle is not implemented', () => {
      const handler = new ParameterHandler();
      expect(() => handler.handle('key', 'value', {})).toThrow('ParameterHandler.handle() must be implemented by subclass');
    });

    it('should return default priority of 100', () => {
      const handler = new ParameterHandler();
      expect(handler.getPriority()).toBe(100);
    });
  });

  describe('Subclass implementation', () => {
    class TestHandler extends ParameterHandler {
      canHandle(key) {
        return key === 'TestKey';
      }

      handle(key, value, context) {
        return { test_key: value };
      }

      getPriority() {
        return 50;
      }
    }

    it('should allow subclass to implement canHandle', () => {
      const handler = new TestHandler();
      expect(handler.canHandle('TestKey')).toBe(true);
      expect(handler.canHandle('OtherKey')).toBe(false);
    });

    it('should allow subclass to implement handle', () => {
      const handler = new TestHandler();
      const result = handler.handle('TestKey', 'test_value', {});
      expect(result).toEqual({ test_key: 'test_value' });
    });

    it('should allow subclass to override getPriority', () => {
      const handler = new TestHandler();
      expect(handler.getPriority()).toBe(50);
    });
  });

  describe('Multiple handlers with different priorities', () => {
    class HighPriorityHandler extends ParameterHandler {
      canHandle(key) {
        return key === 'SharedKey';
      }

      handle(key, value, context) {
        return { high: value };
      }

      getPriority() {
        return 10;
      }
    }

    class LowPriorityHandler extends ParameterHandler {
      canHandle(key) {
        return key === 'SharedKey';
      }

      handle(key, value, context) {
        return { low: value };
      }

      getPriority() {
        return 200;
      }
    }

    it('should support priority-based handler selection', () => {
      const highHandler = new HighPriorityHandler();
      const lowHandler = new LowPriorityHandler();

      expect(highHandler.getPriority()).toBeLessThan(lowHandler.getPriority());
      expect(highHandler.canHandle('SharedKey')).toBe(true);
      expect(lowHandler.canHandle('SharedKey')).toBe(true);
    });
  });

  describe('Context usage in handlers', () => {
    class ContextAwareHandler extends ParameterHandler {
      canHandle(key) {
        return key === 'ContextKey';
      }

      handle(key, value, context) {
        return {
          value: value,
          has_context: Object.keys(context).length > 0,
          context_data: context.existing_data
        };
      }
    }

    it('should pass context to handler', () => {
      const handler = new ContextAwareHandler();
      const context = { existing_data: 'test' };
      const result = handler.handle('ContextKey', 'value', context);

      expect(result.value).toBe('value');
      expect(result.has_context).toBe(true);
      expect(result.context_data).toBe('test');
    });

    it('should handle empty context', () => {
      const handler = new ContextAwareHandler();
      const result = handler.handle('ContextKey', 'value', {});

      expect(result.value).toBe('value');
      expect(result.has_context).toBe(false);
      expect(result.context_data).toBeUndefined();
    });
  });
});
