/**
 * ADetailerHandler.js - Handles ADetailer extension parameters
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
 * ADetailerHandler - Handles ADetailer extension parameters
 * 
 * ADetailer parameters have format: "ADetailer <param_name>: <value>"
 * This handler extracts them into a nested adetailer object.
 * 
 * @example
 * Input: "ADetailer model: face_yolov8n.pt, ADetailer confidence: 0.3"
 * Output: {
 *   adetailer: {
 *     model: "face_yolov8n.pt",
 *     confidence: 0.3
 *   }
 * }
 */
class ADetailerHandler extends ParameterHandler {
  /**
   * Check if this handler can process the given parameter key
   * @param {string} key - Parameter key
   * @returns {boolean} True if key starts with "ADetailer "
   */
  canHandle(key) {
    return key.startsWith('ADetailer ');
  }
  
  /**
   * Handle ADetailer parameter
   * @param {string} key - Parameter key (e.g., "ADetailer model")
   * @param {string} value - Parameter value
   * @param {Object} context - Parsing context
   * @returns {Object} Structured metadata with adetailer nested object
   */
  handle(key, value, context) {
    // Extract parameter name by removing "ADetailer " prefix
    const paramName = key.substring(10); // "ADetailer ".length === 10
    
    // Auto-detect value type
    const parsedValue = this._autoDetectType(value);
    
    return {
      adetailer: {
        [paramName]: parsedValue
      }
    };
  }
  
  /**
   * Auto-detect and convert value type
   * @private
   * @param {string} value - String value
   * @returns {*} Converted value (number, boolean, or string)
   */
  _autoDetectType(value) {
    // Check for boolean
    if (value === 'True' || value === 'true') return true;
    if (value === 'False' || value === 'false') return false;
    
    // Check for number
    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^-?\d+\.\d+$/.test(value)) {
      return parseFloat(value);
    }
    
    // Default to string
    return value;
  }
  
  /**
   * Get handler priority
   * @returns {number} Priority value (30 = medium priority)
   */
  getPriority() {
    return 30;
  }
}

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.ADetailerHandler = ADetailerHandler;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ADetailerHandler;
  }

})(typeof window !== 'undefined' ? window : global);
