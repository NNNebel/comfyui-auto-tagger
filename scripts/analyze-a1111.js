// Script to analyze A1111 image metadata
const fs = require('fs');
const path = require('path');

// Import the metadata parser components
const ImageMetadataReader = require('../js/metadata-parser/binary-extraction/ImageMetadataReader');
const A1111Parser = require('../js/metadata-parser/parsers/A1111Parser');

// Get image path from command line argument
const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: node analyze-a1111.js <image-path>');
  process.exit(1);
}

// Read the image file
const buffer = new Uint8Array(fs.readFileSync(imagePath));

// Determine MIME type from extension
const ext = path.extname(imagePath).toLowerCase();
const mimeType = ext === '.png' ? 'image/png' : 'image/webp';

console.log(`Analyzing A1111 image: ${imagePath}`);
console.log(`MIME type: ${mimeType}`);
console.log('---');

// Step 1: Extract raw metadata
const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, mimeType);
console.log('Raw chunks keys:', Object.keys(rawChunks));

// Display raw parameters if available
if (rawChunks.parameters) {
  console.log('\nRaw parameters:');
  console.log(rawChunks.parameters);
}
console.log('---');

// Step 2: Parse with A1111Parser
const parser = new A1111Parser();
const metadata = parser.parse(rawChunks);

if (metadata) {
  console.log('Parsed A1111 metadata:');
  console.log(JSON.stringify(metadata, null, 2));
  
  // Display in human-readable format
  console.log('\n--- Human-readable format ---');
  console.log(`Format: ${metadata.format}`);
  console.log(`\nPositive prompt:\n${metadata.positive}`);
  if (metadata.negative) {
    console.log(`\nNegative prompt:\n${metadata.negative}`);
  }
  console.log(`\nParameters:`);
  if (metadata.steps) console.log(`  Steps: ${metadata.steps}`);
  if (metadata.sampler) console.log(`  Sampler: ${metadata.sampler}`);
  if (metadata.cfg) console.log(`  CFG scale: ${metadata.cfg}`);
  if (metadata.seed) console.log(`  Seed: ${metadata.seed}`);
  if (metadata.checkpoint) console.log(`  Model: ${metadata.checkpoint}`);
} else {
  console.log('No A1111 metadata found or parsing failed');
}

// If output path is provided, save to file
const outputPath = process.argv[3];
if (outputPath && metadata) {
  fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2));
  console.log(`\nSaved to: ${outputPath}`);
}
