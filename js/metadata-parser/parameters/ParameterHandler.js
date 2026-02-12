/**
 * ParameterHandler.js - Base class for A1111 parameter handlers
 * Universal module (Browser + Node.js)
 */
(function(global) {
  'use strict';

/**
 * ParameterHandler - Base class for handling specific parameter types
 * 
 * Handlers are responsible for:
 * 1. Determining if they can handle a parameter key
 * 2. Parsing the parameter value
 * 3. Returning structured metadata
 * 
 * @example
 * class MyHandler extends ParameterHandler {
 *   canHandle(key) {
 *     return key === 'MyParam';
 *   }
 *   
 *   handle(key, value, context) {
 *     return { my_param: parseInt(value) };
 *   }
 * }
 */
class ParameterHandler {
  /**
   * Check if this handler can process the given parameter key
   * @param {string} key - Parameter key (e.g., "Steps", "Sampler")
   * @returns {boolean} True if this handler can process the key
   */
  canHandle(key) {
    throw new Error('ParameterHandler.canHandle() must be implemented by subclass');
  }
  
  /**
   * Handle the parameter and return structured metadata
   * @param {string} key - Parameter key
   * @param {string} value - Parameter value
   * @param {Object} context - Parsing context (e.g., current metadata, prompts)
   * @returns {Object} Structured metadata object
   */
  handle(key, value, context) {
    throw new Error('ParameterHandler.handle() must be implemented by subclass');
  }
  
  /**
   * Get handler priority (lower = higher priority)
   * Used to determine handler order when multiple handlers can handle a key
   * @returns {number} Priority value (default: 100)
   */
  getPriority() {
    return 100;
  }
}

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.ParameterHandler = ParameterHandler;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ParameterHandler;
  }

})(typeof window !== 'undefined' ? window : global);
