// Script to analyze an image and output its metadata as JSON
const fs = require('fs');
const path = require('path');

// Import the metadata parser components
const ImageMetadataReader = require('../js/metadata-parser/binary-extraction/ImageMetadataReader');
const FormatDetector = require('../js/metadata-parser/binary-extraction/FormatDetector');
const ComfyUIParser = require('../js/metadata-parser/parsers/ComfyUIParser');
const A1111Parser = require('../js/metadata-parser/parsers/A1111Parser');
const ParserRegistry = require('../js/metadata-parser/parsers/ParserRegistry');

// Get image path from command line argument
const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: node analyze-image.js <image-path>');
  process.exit(1);
}

// Read the image file
const buffer = new Uint8Array(fs.readFileSync(imagePath));

// Determine MIME type from extension
const ext = path.extname(imagePath).toLowerCase();
const mimeType = ext === '.png' ? 'image/png' : 'image/webp';

console.log(`Analyzing: ${imagePath}`);
console.log(`MIME type: ${mimeType}`);
console.log('---');

// Step 1: Extract raw metadata
const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, mimeType);
console.log('Raw chunks keys:', Object.keys(rawChunks));
console.log('---');

// Step 2: Detect formats
const formats = FormatDetector.detectFormats(rawChunks);
console.log('Detected formats:', formats);
console.log('---');

// Step 3: Parse with appropriate parsers
const registry = new ParserRegistry();
registry.register(new ComfyUIParser());
registry.register(new A1111Parser());

const results = registry.parseAll(formats, rawChunks);

// Output results as formatted JSON
console.log('Parsed metadata:');
console.log(JSON.stringify(results, null, 2));

// If output path is provided, save to file
const outputPath = process.argv[3];
if (outputPath) {
  // If only one result, save as object; if multiple, save as array
  const output = results.length === 1 ? results[0] : results;
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved to: ${outputPath}`);
}
