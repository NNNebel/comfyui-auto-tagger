// A1111Parser.js - Universal module (Browser + Node.js)
(function(global) {
  'use strict';

  // Get dependencies for both environments
  var MetadataParserBase, ParsingUtils, ErrorHandler, Validators, ParameterParser, StandardParameterHandler, LoraHashHandler, ADetailerHandler;
  
  if (typeof window !== 'undefined') {
    // Browser environment
    MetadataParserBase = window.MetadataParser;
    ParsingUtils = window.ParsingUtils;
    ErrorHandler = window.ErrorHandler;
    Validators = window.Validators;
    ParameterParser = window.ParameterParser;
    StandardParameterHandler = window.StandardParameterHandler;
    LoraHashHandler = window.LoraHashHandler;
    ADetailerHandler = window.ADetailerHandler;
  } else if (typeof require !== 'undefined') {
    // Node.js environment (testing)
    MetadataParserBase = require('./MetadataParser');
    ParsingUtils = require('../utils/ParsingUtils');
    ErrorHandler = require('../utils/ErrorHandler');
    Validators = require('../utils/Validators');
    ParameterParser = require('../parameters/ParameterParser');
    StandardParameterHandler = require('../parameters/StandardParameterHandler');
    LoraHashHandler = require('../parameters/LoraHashHandler');
    ADetailerHandler = require('../parameters/ADetailerHandler');
  } else {
    throw new Error('Required dependencies not found');
  }

/**
 * Parser for Automatic1111 (A1111) metadata format.
 * Extracts metadata from A1111's "parameters" text field.
 * 
 * A1111 format example:
 * "positive prompt text
 * Negative prompt: negative prompt text
 * Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123456, Size: 512x512, Model: model_name"
 */
class A1111Parser extends MetadataParserBase {
  constructor() {
    super();
    
    // Initialize parameter parser with handlers
    this.parameterParser = new ParameterParser();
    this.parameterParser.registerHandler(new StandardParameterHandler());
    this.parameterParser.registerHandler(new LoraHashHandler());
    this.parameterParser.registerHandler(new ADetailerHandler());
  }
  
  /**
   * Get the format name this parser handles.
   * @returns {string} Format identifier 'a1111'
   */
  getFormatName() {
    return 'a1111';
  }

  /**
   * Parse raw metadata chunks into structured A1111 metadata.
   * @param {Object} rawChunks - Raw metadata chunks containing 'parameters' field
   * @returns {ParsedMetadata} Structured metadata object
   */
  parse(rawChunks) {
    return ErrorHandler.safeExecute(
      () => this._parseInternal(rawChunks),
      null,
      'A1111Parser',
      { hasParameters: !!rawChunks?.parameters }
    );
  }

  /**
   * Internal parse implementation with error handling
   * @private
   */
  _parseInternal(rawChunks) {
    const parameters = rawChunks.parameters;
    if (!parameters || typeof parameters !== 'string') {
      return null;
    }

    const metadata = {
      format: 'a1111'
    };

    const lines = ParsingUtils.splitLines(parameters);
    
    // Extract positive prompt (lines before "Negative prompt:" or "Steps:")
    const positiveLines = [];
    let i = 0;
    while (i < lines.length && !lines[i].startsWith('Negative prompt:') && !lines[i].includes('Steps:')) {
      positiveLines.push(lines[i]);
      i++;
    }
    // Join lines, preserving structure but trimming each line
    metadata.positive = positiveLines
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    // Extract negative prompt (lines after "Negative prompt:")
    if (i < lines.length && lines[i].startsWith('Negative prompt:')) {
      const negStart = i;
      i++;
      const negativeLines = [lines[negStart].replace('Negative prompt:', '').trim()];
      
      // Continue collecting negative prompt lines until we hit the parameters line
      while (i < lines.length && !lines[i].includes('Steps:')) {
        negativeLines.push(lines[i]);
        i++;
      }
      // Join lines, preserving structure but trimming each line
      metadata.negative = negativeLines
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
    }

    // Store metadata temporarily for LoRA extraction from prompts
    this.currentMetadata = metadata;

    // Parse parameters line (contains Steps, Sampler, CFG, Seed, Model, etc.)
    const paramLine = lines.find(line => line.includes('Steps:'));
    if (paramLine) {
      const params = this.parseParameterLine(paramLine);
      Object.assign(metadata, params);
    }

    // Clean up temporary reference
    this.currentMetadata = null;

    return metadata;
  }

  /**
   * Parse the parameter line containing key-value pairs.
   * Uses ParameterParser with registered handlers for extensibility.
   * @param {string} line - Parameter line string (e.g., "Steps: 20, Sampler: Euler a, CFG scale: 7, ...")
   * @returns {Object} Object containing parsed parameters
   */
  parseParameterLine(line) {
    // Create context with current metadata for LoRA extraction from prompts
    const context = {
      prompts: {
        positive: this.currentMetadata?.positive || '',
        negative: this.currentMetadata?.negative || ''
      }
    };
    
    // Parse using parameter parser
    const params = this.parameterParser.parse(line, context);
    
    // Extract LoRA names from prompts if available
    // Handles <lora:name:weight> format in positive/negative prompts
    if (context.prompts.positive || context.prompts.negative) {
      const loras = params.loras || [];
      const promptTexts = [context.prompts.positive, context.prompts.negative].filter(Boolean);
      
      for (const promptText of promptTexts) {
        const promptLoras = promptText.matchAll(/<lora:([^:]+):[^>]+>/g);
        for (const match of promptLoras) {
          const name = match[1].trim();
          if (!loras.includes(name)) {
            loras.push(name);
          }
        }
      }
      
      if (loras.length > 0) {
        params.loras = loras;
      }
    }
    
    return params;
  }

  /**
   * @deprecated Use ParameterParser instead
   * Kept for backward compatibility
   */
  splitParameters(line) {
    return this.parameterParser._tokenize(line);
  }

  /**
   * @deprecated Use ParsingUtils.parseValue instead
   * Kept for backward compatibility
   */
  parseValue(value) {
    return ParsingUtils.parseValue(value);
  }
}

  // Export for both browser and Node.js environments
  if (typeof window !== 'undefined') {
    window.A1111Parser = A1111Parser;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = A1111Parser;
  }

})(typeof window !== 'undefined' ? window : global);
