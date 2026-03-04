import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { ErrorHandler } = require('../../js/metadata-parser/utils/ErrorHandler.js');

describe('ErrorHandler', () => {
  let consoleErrorSpy;
  let consoleWarnSpy;
  let consoleLogSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('logParsingError', () => {
    it('should log error with component and context', () => {
      const error = new Error('Test error');
      ErrorHandler.logParsingError('TestComponent', error, { key: 'value' });

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      
      expect(loggedData.level).toBe('error');
      expect(loggedData.component).toBe('TestComponent');
      expect(loggedData.message).toBe('Parsing failed');
      expect(loggedData.error).toBe('Test error');
      expect(loggedData.context).toEqual({ key: 'value' });
      expect(loggedData.timestamp).toBeDefined();
    });

    it('should handle error without message', () => {
      ErrorHandler.logParsingError('TestComponent', 'string error', {});

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.error).toBe('string error');
    });

    it('should handle empty context', () => {
      const error = new Error('Test error');
      ErrorHandler.logParsingError('TestComponent', error);

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.context).toEqual({});
    });

    it('should include timestamp in ISO format', () => {
      const error = new Error('Test error');
      ErrorHandler.logParsingError('TestComponent', error);

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('logWarning', () => {
    it('should log warning with component and context', () => {
      ErrorHandler.logWarning('TestComponent', 'Test warning', { key: 'value' });

      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      
      expect(loggedData.level).toBe('warn');
      expect(loggedData.component).toBe('TestComponent');
      expect(loggedData.message).toBe('Test warning');
      expect(loggedData.context).toEqual({ key: 'value' });
      expect(loggedData.timestamp).toBeDefined();
    });

    it('should handle empty context', () => {
      ErrorHandler.logWarning('TestComponent', 'Test warning');

      expect(consoleWarnSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(loggedData.context).toEqual({});
    });
  });

  describe('logInfo', () => {
    it('should log info with component and context', () => {
      ErrorHandler.logInfo('TestComponent', 'Test info', { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      
      expect(loggedData.level).toBe('info');
      expect(loggedData.component).toBe('TestComponent');
      expect(loggedData.message).toBe('Test info');
      expect(loggedData.context).toEqual({ key: 'value' });
      expect(loggedData.timestamp).toBeDefined();
    });

    it('should handle empty context', () => {
      ErrorHandler.logInfo('TestComponent', 'Test info');

      expect(consoleLogSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(loggedData.context).toEqual({});
    });
  });

  describe('safeExecute', () => {
    it('should return function result on success', () => {
      const fn = () => 42;
      const result = ErrorHandler.safeExecute(fn, null, 'TestComponent');
      expect(result).toBe(42);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should return fallback on error', () => {
      const fn = () => { throw new Error('Test error'); };
      const result = ErrorHandler.safeExecute(fn, 'fallback', 'TestComponent');
      expect(result).toBe('fallback');
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
    });

    it('should return null fallback by default', () => {
      const fn = () => { throw new Error('Test error'); };
      const result = ErrorHandler.safeExecute(fn);
      expect(result).toBeNull();
    });

    it('should log error with component and context', () => {
      const fn = () => { throw new Error('Test error'); };
      ErrorHandler.safeExecute(fn, null, 'TestComponent', { key: 'value' });

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.component).toBe('TestComponent');
      expect(loggedData.context).toEqual({ key: 'value' });
    });

    it('should use "Unknown" as default component', () => {
      const fn = () => { throw new Error('Test error'); };
      ErrorHandler.safeExecute(fn, null);

      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.component).toBe('Unknown');
    });

    it('should handle function with return value', () => {
      const fn = () => ({ data: 'test' });
      const result = ErrorHandler.safeExecute(fn, {}, 'TestComponent');
      expect(result).toEqual({ data: 'test' });
    });
  });

  describe('safeExecuteAsync', () => {
    it('should return async function result on success', async () => {
      const fn = async () => 42;
      const result = await ErrorHandler.safeExecuteAsync(fn, null, 'TestComponent');
      expect(result).toBe(42);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should return fallback on error', async () => {
      const fn = async () => { throw new Error('Test error'); };
      const result = await ErrorHandler.safeExecuteAsync(fn, 'fallback', 'TestComponent');
      expect(result).toBe('fallback');
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
    });

    it('should return null fallback by default', async () => {
      const fn = async () => { throw new Error('Test error'); };
      const result = await ErrorHandler.safeExecuteAsync(fn);
      expect(result).toBeNull();
    });

    it('should log error with component and context', async () => {
      const fn = async () => { throw new Error('Test error'); };
      await ErrorHandler.safeExecuteAsync(fn, null, 'TestComponent', { key: 'value' });

      expect(consoleErrorSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.component).toBe('TestComponent');
      expect(loggedData.context).toEqual({ key: 'value' });
    });

    it('should handle async function with return value', async () => {
      const fn = async () => ({ data: 'test' });
      const result = await ErrorHandler.safeExecuteAsync(fn, {}, 'TestComponent');
      expect(result).toEqual({ data: 'test' });
    });

    it('should handle promise rejection', async () => {
      const fn = async () => Promise.reject(new Error('Rejected'));
      const result = await ErrorHandler.safeExecuteAsync(fn, 'fallback', 'TestComponent');
      expect(result).toBe('fallback');
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
    });
  });

  describe('wrap', () => {
    it('should create wrapped function that returns result on success', () => {
      const fn = (x) => x * 2;
      const wrapped = ErrorHandler.wrap(fn, null, 'TestComponent');
      
      const result = wrapped(21);
      expect(result).toBe(42);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should create wrapped function that returns fallback on error', () => {
      const fn = () => { throw new Error('Test error'); };
      const wrapped = ErrorHandler.wrap(fn, 'fallback', 'TestComponent');
      
      const result = wrapped();
      expect(result).toBe('fallback');
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
    });

    it('should pass arguments to wrapped function', () => {
      const fn = (a, b, c) => a + b + c;
      const wrapped = ErrorHandler.wrap(fn, null, 'TestComponent');
      
      const result = wrapped(1, 2, 3);
      expect(result).toBe(6);
    });

    it('should log error with argument count in context', () => {
      const fn = () => { throw new Error('Test error'); };
      const wrapped = ErrorHandler.wrap(fn, null, 'TestComponent');
      
      wrapped(1, 2, 3);
      
      const loggedData = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(loggedData.context.args).toBe(3);
    });

    it('should handle wrapped function with no arguments', () => {
      const fn = () => 'result';
      const wrapped = ErrorHandler.wrap(fn, null, 'TestComponent');
      
      const result = wrapped();
      expect(result).toBe('result');
    });

    it('should create multiple independent wrapped functions', () => {
      const fn1 = (x) => x * 2;
      const fn2 = (x) => x * 3;
      
      const wrapped1 = ErrorHandler.wrap(fn1, null, 'Component1');
      const wrapped2 = ErrorHandler.wrap(fn2, null, 'Component2');
      
      expect(wrapped1(5)).toBe(10);
      expect(wrapped2(5)).toBe(15);
    });
  });
});


  describe('logDebug', () => {
    it('should log debug message', () => {
      const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      ErrorHandler.setMinLevel('debug');
      ErrorHandler.logDebug('TestComponent', 'Debug message', { key: 'value' });

      expect(consoleDebugSpy).toHaveBeenCalledOnce();
      const loggedData = JSON.parse(consoleDebugSpy.mock.calls[0][0]);
      
      expect(loggedData.level).toBe('debug');
      expect(loggedData.component).toBe('TestComponent');
      expect(loggedData.message).toBe('Debug message');
      expect(loggedData.context).toEqual({ key: 'value' });
      
      consoleDebugSpy.mockRestore();
      ErrorHandler.setMinLevel('info'); // Reset to default
    });

    it('should not log debug when min level is info', () => {
      const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      ErrorHandler.setMinLevel('info');
      ErrorHandler.logDebug('TestComponent', 'Debug message', {});

      expect(consoleDebugSpy).not.toHaveBeenCalled();
      
      consoleDebugSpy.mockRestore();
    });
  });

  describe('error aggregation', () => {
    beforeEach(() => {
      ErrorHandler.clearErrors();
    });

    it('should collect errors', () => {
      const error = new Error('Test error');
      ErrorHandler.logParsingError('TestComponent', error, {});

      const errors = ErrorHandler.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].level).toBe('error');
      expect(errors[0].component).toBe('TestComponent');
    });

    it('should collect warnings', () => {
      ErrorHandler.logWarning('TestComponent', 'Warning message', {});

      const errors = ErrorHandler.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].level).toBe('warn');
    });

    it('should not collect info messages', () => {
      ErrorHandler.logInfo('TestComponent', 'Info message', {});

      const errors = ErrorHandler.getErrors();
      expect(errors).toHaveLength(0);
    });

    it('should clear errors', () => {
      ErrorHandler.logParsingError('TestComponent', new Error('Test'), {});
      expect(ErrorHandler.getErrors()).toHaveLength(1);

      ErrorHandler.clearErrors();
      expect(ErrorHandler.getErrors()).toHaveLength(0);
    });
  });

  describe('setMinLevel', () => {
    afterEach(() => {
      ErrorHandler.setMinLevel('info'); // Reset to default
    });

    it('should set minimum log level', () => {
      const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      ErrorHandler.setMinLevel('debug');
      ErrorHandler.logDebug('TestComponent', 'Debug message', {});
      expect(consoleDebugSpy).toHaveBeenCalledOnce();

      consoleDebugSpy.mockRestore();
    });

    it('should filter logs below min level', () => {
      const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const consoleInfoSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      ErrorHandler.setMinLevel('warn');
      ErrorHandler.logDebug('TestComponent', 'Debug message', {});
      ErrorHandler.logInfo('TestComponent', 'Info message', {});
      
      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();

      consoleDebugSpy.mockRestore();
      consoleInfoSpy.mockRestore();
    });
  });

  describe('Soft Warning', () => {
    let localConsoleWarnSpy;
    
    beforeEach(() => {
      ErrorHandler.clearWarnings();
      localConsoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    
    afterEach(() => {
      localConsoleWarnSpy.mockRestore();
    });

    it('should log soft warning', () => {
      ErrorHandler.logSoftWarning('ComfyUIParser', 'Nodes skipped but extraction succeeded', {
        excludedCount: 2
      });

      // Soft warning uses console.warn
      expect(localConsoleWarnSpy).toHaveBeenCalled();
      const loggedData = JSON.parse(localConsoleWarnSpy.mock.calls[localConsoleWarnSpy.mock.calls.length - 1][0]);
      expect(loggedData.message).toContain('[Soft Warning]');
    });

    it('should collect soft warnings', () => {
      ErrorHandler.logSoftWarning('ComfyUIParser', 'Warning 1', { count: 1 });
      ErrorHandler.logSoftWarning('ComfyUIParser', 'Warning 2', { count: 2 });

      const warnings = ErrorHandler.getSoftWarnings();
      expect(warnings).toHaveLength(2);
      expect(warnings[0].message).toBe('Warning 1');
      expect(warnings[1].message).toBe('Warning 2');
    });

    it('should include timestamp in soft warning', () => {
      ErrorHandler.logSoftWarning('ComfyUIParser', 'Test warning', {});

      const warnings = ErrorHandler.getSoftWarnings();
      expect(warnings[0].timestamp).toBeDefined();
      expect(warnings[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should clear soft warnings', () => {
      ErrorHandler.logSoftWarning('ComfyUIParser', 'Test warning', {});
      expect(ErrorHandler.getSoftWarnings()).toHaveLength(1);

      ErrorHandler.clearWarnings();
      expect(ErrorHandler.getSoftWarnings()).toHaveLength(0);
    });
  });

  describe('Hard Warning', () => {
    let localConsoleErrorSpy;
    
    beforeEach(() => {
      ErrorHandler.clearWarnings();
      localConsoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    
    afterEach(() => {
      localConsoleErrorSpy.mockRestore();
    });

    it('should log hard warning', () => {
      ErrorHandler.logHardWarning('ComfyUIParser', 'Nodes skipped and extraction failed', {
        excludedCount: 2
      });

      // Hard warning uses console.error
      expect(localConsoleErrorSpy).toHaveBeenCalled();
      const loggedData = JSON.parse(localConsoleErrorSpy.mock.calls[localConsoleErrorSpy.mock.calls.length - 1][0]);
      expect(loggedData.message).toContain('[Hard Warning]');
    });

    it('should collect hard warnings', () => {
      ErrorHandler.logHardWarning('ComfyUIParser', 'Warning 1', { count: 1 });
      ErrorHandler.logHardWarning('ComfyUIParser', 'Warning 2', { count: 2 });

      const warnings = ErrorHandler.getHardWarnings();
      expect(warnings).toHaveLength(2);
      expect(warnings[0].message).toBe('Warning 1');
      expect(warnings[1].message).toBe('Warning 2');
    });

    it('should include timestamp in hard warning', () => {
      ErrorHandler.logHardWarning('ComfyUIParser', 'Test warning', {});

      const warnings = ErrorHandler.getHardWarnings();
      expect(warnings[0].timestamp).toBeDefined();
      expect(warnings[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should clear hard warnings', () => {
      ErrorHandler.logHardWarning('ComfyUIParser', 'Test warning', {});
      expect(ErrorHandler.getHardWarnings()).toHaveLength(1);

      ErrorHandler.clearWarnings();
      expect(ErrorHandler.getHardWarnings()).toHaveLength(0);
    });
  });

  describe('Warning separation', () => {
    beforeEach(() => {
      ErrorHandler.clearWarnings();
    });

    it('should keep soft and hard warnings separate', () => {
      ErrorHandler.logSoftWarning('ComfyUIParser', 'Soft warning', {});
      ErrorHandler.logHardWarning('ComfyUIParser', 'Hard warning', {});

      const softWarnings = ErrorHandler.getSoftWarnings();
      const hardWarnings = ErrorHandler.getHardWarnings();

      expect(softWarnings).toHaveLength(1);
      expect(hardWarnings).toHaveLength(1);
      expect(softWarnings[0].message).toBe('Soft warning');
      expect(hardWarnings[0].message).toBe('Hard warning');
    });

    it('should clear both warning types', () => {
      ErrorHandler.logSoftWarning('ComfyUIParser', 'Soft warning', {});
      ErrorHandler.logHardWarning('ComfyUIParser', 'Hard warning', {});

      ErrorHandler.clearWarnings();

      expect(ErrorHandler.getSoftWarnings()).toHaveLength(0);
      expect(ErrorHandler.getHardWarnings()).toHaveLength(0);
    });
  });

  describe('Warning context', () => {
    beforeEach(() => {
      ErrorHandler.clearWarnings();
    });

    it('should include context in soft warning', () => {
      const context = {
        excludedCount: 2,
        excludedNodes: ['7', '8'],
        reason: 'no_latent_input'
      };

      ErrorHandler.logSoftWarning('ComfyUIParser', 'Test warning', context);

      const warnings = ErrorHandler.getSoftWarnings();
      expect(warnings[0].context).toEqual(context);
    });

    it('should include context in hard warning', () => {
      const context = {
        excludedCount: 3,
        extractionFailed: true,
        samplerCount: 0
      };

      ErrorHandler.logHardWarning('ComfyUIParser', 'Test warning', context);

      const warnings = ErrorHandler.getHardWarnings();
      expect(warnings[0].context).toEqual(context);
    });
  });
