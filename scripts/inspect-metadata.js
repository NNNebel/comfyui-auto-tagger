// Script to inspect raw metadata from an image
const fs = require('fs');
const path = require('path');
const ImageMetadataReader = require('../js/metadata-parser/binary-extraction/ImageMetadataReader');

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: node inspect-metadata.js <image-path>');
  process.exit(1);
}

const buffer = new Uint8Array(fs.readFileSync(imagePath));
const ext = path.extname(imagePath).toLowerCase();
const mimeType = ext === '.png' ? 'image/png' : 'image/webp';

const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, mimeType);

console.log('=== RAW METADATA ===\n');

if (rawChunks.prompt) {
  console.log('PROMPT DATA:');
  console.log(JSON.stringify(rawChunks.prompt, null, 2));
  console.log('\n');
  
  // Count KSamplers
  let ksamplerCount = 0;
  const ksamplers = [];
  for (const id in rawChunks.prompt) {
    const node = rawChunks.prompt[id];
    if (node.class_type && node.class_type.includes('KSampler')) {
      ksamplerCount++;
      ksamplers.push({ id, class_type: node.class_type, inputs: node.inputs });
    }
  }
  
  console.log(`\nFound ${ksamplerCount} KSampler nodes:`);
  ksamplers.forEach(k => {
    console.log(`  - ID ${k.id}: ${k.class_type}`);
    console.log(`    Seed: ${k.inputs.seed || 'N/A'}`);
    console.log(`    Steps: ${k.inputs.steps || 'N/A'}`);
  });
}

if (rawChunks.workflow) {
  console.log('\n\nWORKFLOW DATA (nodes only):');
  if (rawChunks.workflow.nodes) {
    const ksamplerNodes = rawChunks.workflow.nodes.filter(n => 
      n.type && n.type.includes('KSampler')
    );
    console.log(`Found ${ksamplerNodes.length} KSampler nodes in workflow`);
  }
}
