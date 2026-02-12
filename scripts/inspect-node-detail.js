// Script to inspect a specific node in detail
const fs = require('fs');
const path = require('path');
const ImageMetadataReader = require('../js/metadata-parser/binary-extraction/ImageMetadataReader');

const imagePath = process.argv[2];
const nodeId = process.argv[3];

if (!imagePath || !nodeId) {
  console.error('Usage: node scripts/inspect-node-detail.js <image-path> <node-id>');
  console.error('Example: node scripts/inspect-node-detail.js tests/fixtures/comfyui_multi.webp 325');
  process.exit(1);
}

const buffer = new Uint8Array(fs.readFileSync(imagePath));
const ext = path.extname(imagePath).toLowerCase();
const mimeType = ext === '.png' ? 'image/png' : 'image/webp';

const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, mimeType);

if (!rawChunks.prompt) {
  console.error('No prompt data found in image');
  process.exit(1);
}

const node = rawChunks.prompt[nodeId];

if (!node) {
  console.error(`Node ${nodeId} not found in prompt data`);
  console.log('\nAvailable node IDs:');
  console.log(Object.keys(rawChunks.prompt).sort((a, b) => parseInt(a) - parseInt(b)).join(', '));
  process.exit(1);
}

console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Node ${nodeId} Detail`);
console.log('═══════════════════════════════════════════════════════════════');
console.log(`Class Type: ${node.class_type}`);
console.log(`Title: ${node._meta?.title || 'N/A'}`);
console.log('\n');
console.log('Inputs:');
console.log(JSON.stringify(node.inputs, null, 2));
console.log('\n');
console.log('Full Node Data:');
console.log(JSON.stringify(node, null, 2));
