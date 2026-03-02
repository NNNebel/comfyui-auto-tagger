/**
 * ErrorHandler - Centralized error handling and logging
 * 
 * This module provides consistent error handling across all parsers
 * with structured logging, severity levels, and error aggregation.
 */
(function(global) {
  'use strict';

  /**
   * Severity levels for logging
   * @enum {string}
   */
  const LogLevel = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
  };

  class ErrorHandler {
    constructor() {
      this.errors = [];
      this.softWarnings = [];
      this.hardWarnings = [];
      this.minLevel = LogLevel.INFO;
    }

    /**
     * Set minimum log level
     * @param {string} level - Minimum level to log (debug, info, warn, error)
     */
    static setMinLevel(level) {
      if (!ErrorHandler.instance) {
        ErrorHandler.instance = new ErrorHandler();
      }
      ErrorHandler.instance.minLevel = level;
    }

    /**
     * Get all collected errors
     * @returns {Array} Array of error objects
     */
    static getErrors() {
      if (!ErrorHandler.instance) {
        ErrorHandler.instance = new ErrorHandler();
      }
      return ErrorHandler.instance.errors;
    }

    /**
     * Clear all collected errors
     */
    static clearErrors() {
      if (!ErrorHandler.instance) {
        ErrorHandler.instance = new ErrorHandler();
      }
      ErrorHandler.instance.errors = [];
    }

    /**
     * Check if level should be logged
     * @private
     */
    static _shouldLog(level) {
      if (!ErrorHandler.instance) {
        ErrorHandler.instance = new ErrorHandler();
      }
      const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
      const minIndex = levels.indexOf(ErrorHandler.instance.minLevel);
      const currentIndex = levels.indexOf(level);
      return currentIndex >= minIndex;
    }

    /**
     * Log with specified level
     * @private
     */
    static _log(level, component, message, context = {}, error = null) {
      if (!this._shouldLog(level)) {
        return;
      }

      const logEntry = {
        level,
        component,
        message,
        timestamp: new Date().toISOString(),
        context
      };

      if (error) {
        logEntry.error = error.message || String(error);
        if (error.stack) {
          logEntry.stack = error.stack;
        }
      }

      // Store error for aggregation
      if (level === LogLevel.ERROR || level === LogLevel.WARN) {
        if (!ErrorHandler.instance) {
          ErrorHandler.instance = new ErrorHandler();
        }
        ErrorHandler.instance.errors.push(logEntry);
      }

      // Output to console
      const logString = JSON.stringify(logEntry);
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(logString);
          break;
        case LogLevel.INFO:
          console.log(logString);
          break;
        case LogLevel.WARN:
          console.warn(logString);
          break;
        case LogLevel.ERROR:
          console.error(logString);
          break;
      }
    }

    /**
     * Log debug message
     * @param {string} component - Component name
     * @param {string} message - Debug message
     * @param {Object} context - Additional context information
     */
    static logDebug(component, message, context = {}) {
      this._log(LogLevel.DEBUG, component, message, context);
    }

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
      // Extract suggestions from ParseError instances
      const enhancedContext = { ...context };
      
      if (error && typeof error === 'object') {
        // Check if error has ParseError properties
        if (error.context) {
          enhancedContext.errorContext = error.context;
        }
        if (error.suggestions && Array.isArray(error.suggestions) && error.suggestions.length > 0) {
          enhancedContext.suggestions = error.suggestions;
        }
        if (error.cause) {
          enhancedContext.cause = {
            name: error.cause.name,
            message: error.cause.message
          };
        }
      }
      
      this._log(LogLevel.ERROR, component, 'Parsing failed', enhancedContext, error);
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
      this._log(LogLevel.WARN, component, message, context);
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
      this._log(LogLevel.INFO, component, message, context);
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

    /**
     * Log a soft warning (nodes skipped but extraction succeeded)
     * @param {string} component - Component name
     * @param {string} message - Warning message
     * @param {Object} context - Additional context information
     */
    static logSoftWarning(component, message, context = {}) {
      if (!ErrorHandler.instance) {
        ErrorHandler.instance = new ErrorHandler();
      }
      
      const warning = {
        type: 'soft',
        component,
        message,
        timestamp: new Date().toISOString(),
        context
      };
      
      ErrorHandler.instance.softWarnings.push(warning);
      this._log(LogLevel.WARN, component, `[Soft Warning] ${message}`, context);
    }

    /**
     * Log a hard warning (nodes skipped and extraction failed)
     * @param {string} component - Component name
     * @param {string} message - Warning message
     * @param {Object} context - Additional context information
     */
    static logHardWarning(component, message, context = {}) {
      if (!ErrorHandler.instance) {
        ErrorHandler.instance = new ErrorHandler();
      }
      
      const warning = {
        type: 'hard',
        component,
        message,
        timestamp: new Date().toISOString(),
        context
      };
      
      ErrorHandler.instance.hardWarnings.push(warning);
      this._log(LogLevel.ERROR, component, `[Hard Warning] ${message}`, context);
    }

    /**
     * Get all soft warnings
     * @returns {Array} Array of soft warning objects
     */
    static getSoftWarnings() {
      if (!ErrorHandler.instance) {
        ErrorHandler.instance = new ErrorHandler();
      }
      return ErrorHandler.instance.softWarnings;
    }

    /**
     * Get all hard warnings
     * @returns {Array} Array of hard warning objects
     */
    static getHardWarnings() {
      if (!ErrorHandler.instance) {
        ErrorHandler.instance = new ErrorHandler();
      }
      return ErrorHandler.instance.hardWarnings;
    }

    /**
     * Clear all warnings
     */
    static clearWarnings() {
      if (!ErrorHandler.instance) {
        ErrorHandler.instance = new ErrorHandler();
      }
      ErrorHandler.instance.softWarnings = [];
      ErrorHandler.instance.hardWarnings = [];
    }
  }

  // Export LogLevel and ErrorHandler
  if (typeof window !== 'undefined') {
    window.LogLevel = LogLevel;
    window.ErrorHandler = ErrorHandler;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LogLevel, ErrorHandler };
  }
})(typeof window !== 'undefined' ? window : global);
