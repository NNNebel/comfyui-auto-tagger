/**
 * StandardParameterHandler.js - Handles standard A1111 parameters
 * Universal module (Browser + Node.js)
 */
(function(global) {
  'use strict';

  // Get dependencies for both environments
  var ParameterHandler;
  
  if (typeof window !== 'undefined') {
    // Browser environment
    ParameterHandler = window.ParameterHandler;
  } else if (typeof require !== 'undefined') {
    // Node.js environment (testing)
    ParameterHandler = require('./ParameterHandler');
  } else {
    throw new Error('Required dependencies not found');
  }

/**
 * StandardParameterHandler - Handles standard A1111 parameters
 * 
 * Handles common parameters like Steps, Sampler, CFG scale, Seed, Model, etc.
 * Uses a mapping table for parameter names to output keys and type conversion.
 */
class StandardParameterHandler extends ParameterHandler {
  constructor() {
    super();
    
    /**
     * Mapping of parameter keys to output configuration
     * Format: { key: { outputKey: string, type: 'int'|'float'|'string'|'bool' } }
     */
    this.parameterMap = {
      'Steps': { outputKey: 'steps', type: 'int' },
      'Sampler': { outputKey: 'sampler', type: 'string' },
      'Schedule type': { outputKey: 'schedule_type', type: 'string' },
      'CFG scale': { outputKey: 'cfg', type: 'float' },
      'Seed': { outputKey: 'seed', type: 'int' },
      'Size': { outputKey: 'size', type: 'string' },
      'Model': { outputKey: 'checkpoint', type: 'string' },
      'Model hash': { outputKey: 'model_hash', type: 'string' },
      'VAE': { outputKey: 'vae', type: 'string' },
      'VAE hash': { outputKey: 'vae_hash', type: 'string' },
      'Denoising strength': { outputKey: 'denoising_strength', type: 'float' },
      'Clip skip': { outputKey: 'clip_skip', type: 'int' },
      'ENSD': { outputKey: 'ensd', type: 'int' },
      'Version': { outputKey: 'version', type: 'string' },
      // Hires fix parameters
      'Hires upscale': { outputKey: 'hires_upscale', type: 'float' },
      'Hires steps': { outputKey: 'hires_steps', type: 'int' },
      'Hires upscaler': { outputKey: 'hires_upscaler', type: 'string' },
      // Extension parameters
      'TI': { outputKey: 'textual_inversion', type: 'string' },
      'NGMS': { outputKey: 'ngms', type: 'float' },
      'NGMS all steps': { outputKey: 'ngms_all_steps', type: 'bool' }
    };
  }
  
  /**
   * Check if this handler can process the given parameter key
   * @param {string} key - Parameter key
   * @returns {boolean} True if key is in parameter map
   */
  canHandle(key) {
    return this.parameterMap.hasOwnProperty(key);
  }
  
  /**
   * Handle standard parameter
   * @param {string} key - Parameter key
   * @param {string} value - Parameter value
   * @param {Object} context - Parsing context (unused for standard parameters)
   * @returns {Object} Structured metadata object
   */
  handle(key, value, context) {
    const config = this.parameterMap[key];
    if (!config) return {};
    
    const parsedValue = this._convertType(value, config.type);
    return { [config.outputKey]: parsedValue };
  }
  
  /**
   * Convert value to specified type
   * @private
   * @param {string} value - String value to convert
   * @param {string} type - Target type ('int', 'float', 'string', 'bool')
   * @returns {*} Converted value
   */
  _convertType(value, type) {
    switch (type) {
      case 'int':
        return parseInt(value, 10);
      case 'float':
        return parseFloat(value);
      case 'bool':
        return value === 'True' || value === 'true' || value === '1';
      case 'string':
      default:
        return value;
    }
  }
  
  /**
   * Get handler priority (standard parameters have high priority)
   * @returns {number} Priority value (10 = high priority)
   */
  getPriority() {
    return 10;
  }
}

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.StandardParameterHandler = StandardParameterHandler;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StandardParameterHandler;
  }

})(typeof window !== 'undefined' ? window : global);
