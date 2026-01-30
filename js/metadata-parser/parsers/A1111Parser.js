// A1111Parser.js - Universal module (Browser + Node.js)
(function(global) {
  'use strict';

  // Get MetadataParser reference for both environments
  var MetadataParserBase;
  if (typeof window !== 'undefined' && window.MetadataParser) {
    MetadataParserBase = window.MetadataParser;
  } else if (typeof require !== 'undefined') {
    MetadataParserBase = require('./MetadataParser');
  } else {
    throw new Error('MetadataParser not found');
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
    const parameters = rawChunks.parameters;
    if (!parameters || typeof parameters !== 'string') {
      return null;
    }

    const metadata = {
      format: 'a1111'
    };

    try {
      const lines = parameters.split('\n');
      
      // Extract positive prompt (lines before "Negative prompt:" or "Steps:")
      const positiveLines = [];
      let i = 0;
      while (i < lines.length && !lines[i].startsWith('Negative prompt:') && !lines[i].includes('Steps:')) {
        positiveLines.push(lines[i]);
        i++;
      }
      metadata.positive = positiveLines.join('\n').trim();

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
        metadata.negative = negativeLines.join('\n').trim();
      }

      // Parse parameters line (contains Steps, Sampler, CFG, Seed, Model, etc.)
      const paramLine = lines.find(line => line.includes('Steps:'));
      if (paramLine) {
        const params = this.parseParameterLine(paramLine);
        Object.assign(metadata, params);
      }
    } catch (e) {
      console.error("A1111 parsing failed:", e);
    }

    return metadata;
  }

  /**
   * Parse the parameter line containing key-value pairs.
   * Extracts Steps, Sampler, CFG scale, Seed, Model, and other parameters.
   * Also handles A1111 extensions like ADetailer, Lora hashes, TI, NGMS.
   * @param {string} line - Parameter line string (e.g., "Steps: 20, Sampler: Euler a, CFG scale: 7, ...")
   * @returns {Object} Object containing parsed parameters
   */
  parseParameterLine(line) {
    const params = {};
    const adetailer = {};
    const loraHashes = {};
    
    // Split by comma, but be careful with quoted values
    const pairs = this.splitParameters(line);
    
    for (const pair of pairs) {
      const colonIndex = pair.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = pair.substring(0, colonIndex).trim();
      let value = pair.substring(colonIndex + 1).trim();
      
      // Remove quotes from values
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Handle ADetailer parameters
      if (key.startsWith('ADetailer ')) {
        const adetailerKey = key.substring(10); // Remove "ADetailer " prefix
        adetailer[adetailerKey] = this.parseValue(value);
        continue;
      }
      
      // Handle Lora hashes
      if (key === 'Lora hashes') {
        // Parse "name1: hash1, name2: hash2" format
        const loraMatches = value.matchAll(/([^:,]+):\s*([^,]+)/g);
        for (const match of loraMatches) {
          loraHashes[match[1].trim()] = match[2].trim();
        }
        continue;
      }
      
      // Handle standard and extension parameters
      switch (key) {
        case 'Steps':
          params.steps = parseInt(value, 10);
          break;
        case 'Sampler':
          params.sampler = value;
          break;
        case 'Schedule type':
          params.schedule_type = value;
          break;
        case 'CFG scale':
          params.cfg = parseFloat(value);
          break;
        case 'Seed':
          params.seed = parseInt(value, 10);
          break;
        case 'Size':
          params.size = value;
          break;
        case 'Model':
          // Only use 'Model' (actual model name), ignore 'Model hash'
          params.checkpoint = value;
          break;
        case 'Model hash':
          params.model_hash = value;
          break;
        case 'VAE':
          params.vae = value;
          break;
        case 'Denoising strength':
          params.denoising_strength = parseFloat(value);
          break;
        case 'Clip skip':
          params.clip_skip = parseInt(value, 10);
          break;
        case 'Hires upscale':
          params.hires_upscale = parseFloat(value);
          break;
        case 'Hires steps':
          params.hires_steps = parseInt(value, 10);
          break;
        case 'Hires upscaler':
          params.hires_upscaler = value;
          break;
        case 'Version':
          params.version = value;
          break;
        case 'TI':
          params.textual_inversion = value;
          break;
        case 'NGMS':
          params.ngms = parseFloat(value);
          break;
        case 'NGMS all steps':
          params.ngms_all_steps = value === 'True';
          break;
      }
    }
    
    // Add ADetailer and Lora hashes if present
    if (Object.keys(adetailer).length > 0) {
      params.adetailer = adetailer;
    }
    if (Object.keys(loraHashes).length > 0) {
      params.lora_hashes = loraHashes;
    }
    
    return params;
  }

  /**
   * Split parameter string by commas, respecting quoted values.
   * @param {string} line - Parameter line
   * @returns {string[]} Array of parameter pairs
   */
  splitParameters(line) {
    const pairs = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = null;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = null;
        }
        current += char;
      } else if (char === ',' && !inQuotes) {
        if (current.trim()) {
          pairs.push(current.trim());
        }
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      pairs.push(current.trim());
    }
    
    return pairs;
  }

  /**
   * Parse a value to its appropriate type.
   * @param {string} value - String value to parse
   * @returns {*} Parsed value (number, boolean, or string)
   */
  parseValue(value) {
    // Try to parse as number
    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^-?\d+\.\d+$/.test(value)) {
      return parseFloat(value);
    }
    
    // Parse boolean
    if (value === 'True' || value === 'true') {
      return true;
    }
    if (value === 'False' || value === 'false') {
      return false;
    }
    
    // Return as string
    return value;
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
