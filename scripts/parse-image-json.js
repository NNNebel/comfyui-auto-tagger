/**
 * parse-image-json.js
 *
 * Parses a single image and writes the first metadata result as JSON to stdout.
 * Designed for subprocess use (e.g. from Python tests).
 *
 * Usage: node scripts/parse-image-json.js <image-path>
 * Stdout: single JSON object (first parser result), or exits with code 1 on failure.
 * Stderr: diagnostic messages only.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ImageMetadataReader = require('../js/metadata-parser/binary-extraction/ImageMetadataReader');
const FormatDetector = require('../js/metadata-parser/binary-extraction/FormatDetector');
const ComfyUIParser = require('../js/metadata-parser/parsers/ComfyUIParser');
const A1111Parser = require('../js/metadata-parser/parsers/A1111Parser');
const ParserRegistry = require('../js/metadata-parser/parsers/ParserRegistry');

const imagePath = process.argv[2];
if (!imagePath) {
  process.stderr.write('Usage: node parse-image-json.js <image-path>\n');
  process.exit(1);
}

const ext = path.extname(imagePath).toLowerCase();
const mimeType = ext === '.png' ? 'image/png'
               : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg'
               : 'image/webp';

// Redirect console.log/warn to stderr so stdout contains only the JSON result
const _log = console.log;
const _warn = console.warn;
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
console.warn = (...args) => process.stderr.write(args.join(' ') + '\n');

const buffer = new Uint8Array(fs.readFileSync(imagePath));
const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, mimeType);
const formats = FormatDetector.detectFormats(rawChunks);

const registry = new ParserRegistry();
registry.register(new ComfyUIParser());
registry.register(new A1111Parser());

const results = registry.parseAll(formats, rawChunks);

if (!results || results.length === 0) {
  process.stderr.write('No metadata found\n');
  process.exit(1);
}

process.stdout.write(JSON.stringify(results[0]));
