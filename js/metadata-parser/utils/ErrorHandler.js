/**
 * ErrorHandler - Centralized error handling and logging
 * 
 * This module provides consistent error handling across all parsers
 * with structured logging and context information.
 */
(function(global) {
  'use strict';

  class ErrorHandler {
    /**
     * Log parsing error with structured context
     * @param {string} component - Component name (e.g., 'A1111Parser', 'ComfyUIParser')
     * @param {Error} error - Error object
     * @param {Object} context - Additional context information
     * 
     * @example
     * ErrorHandler.logParsingError('A1111Parser', error, { 
     *   parametersLength: 1024,
     *   format: 'png'
     * });
     */
    static logParsingError(component, error, context = {}) {
      const errorLog = {
        level: 'error',
        component,
        action: 'parse',
        error: error.message || String(error),
        timestamp: new Date().toISOString(),
        context
      };
      
      console.error(JSON.stringify(errorLog));
    }

    /**
     * Log warning with structured context
     * @param {string} component - Component name
     * @param {string} message - Warning message
     * @param {Object} context - Additional context information
     * 
     * @example
     * ErrorHandler.logWarning('MetadataService', 'No parser found for format', {
     *   format: 'unknown'
     * });
     */
    static logWarning(component, message, context = {}) {
      const warningLog = {
        level: 'warn',
        component,
        message,
        timestamp: new Date().toISOString(),
        context
      };
      
      console.warn(JSON.stringify(warningLog));
    }

    /**
     * Log info message with structured context
     * @param {string} component - Component name
     * @param {string} message - Info message
     * @param {Object} context - Additional context information
     * 
     * @example
     * ErrorHandler.logInfo('MetadataService', 'Successfully parsed metadata', {
     *   format: 'comfyui',
     *   fieldsExtracted: 8
     * });
     */
    static logInfo(component, message, context = {}) {
      const infoLog = {
        level: 'info',
        component,
        message,
        timestamp: new Date().toISOString(),
        context
      };
      
      console.log(JSON.stringify(infoLog));
    }

    /**
     * Execute function with error handling
     * @param {Function} fn - Function to execute
     * @param {*} fallback - Value to return on error (default: null)
     * @param {string} component - Component name for logging (default: 'Unknown')
     * @param {Object} context - Additional context for error logging
     * @returns {*} Function result or fallback value
     * 
     * @example
     * const result = ErrorHandler.safeExecute(
     *   () => JSON.parse(text),
     *   {},
     *   'A1111Parser',
     *   { textLength: text.length }
     * );
     */
    static safeExecute(fn, fallback = null, component = 'Unknown', context = {}) {
      try {
        return fn();
      } catch (e) {
        this.logParsingError(component, e, context);
        return fallback;
      }
    }

    /**
     * Execute async function with error handling
     * @param {Function} fn - Async function to execute
     * @param {*} fallback - Value to return on error (default: null)
     * @param {string} component - Component name for logging (default: 'Unknown')
     * @param {Object} context - Additional context for error logging
     * @returns {Promise<*>} Function result or fallback value
     * 
     * @example
     * const result = await ErrorHandler.safeExecuteAsync(
     *   async () => await fetchMetadata(url),
     *   null,
     *   'MetadataFetcher',
     *   { url }
     * );
     */
    static async safeExecuteAsync(fn, fallback = null, component = 'Unknown', context = {}) {
      try {
        return await fn();
      } catch (e) {
        this.logParsingError(component, e, context);
        return fallback;
      }
    }

    /**
     * Create a safe wrapper for a function
     * @param {Function} fn - Function to wrap
     * @param {*} fallback - Value to return on error
     * @param {string} component - Component name for logging
     * @returns {Function} Wrapped function
     * 
     * @example
     * const safeParser = ErrorHandler.wrap(
     *   (data) => JSON.parse(data),
     *   null,
     *   'JSONParser'
     * );
     * const result = safeParser('{"key": "value"}');
     */
    static wrap(fn, fallback = null, component = 'Unknown') {
      return (...args) => {
        return this.safeExecute(
          () => fn(...args),
          fallback,
          component,
          { args: args.length }
        );
      };
    }
  }

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.ErrorHandler = ErrorHandler;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
  }
})(typeof window !== 'undefined' ? window : global);
