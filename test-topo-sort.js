const fs = require('fs');
const ImageMetadataReader = require('./js/metadata-parser/binary-extraction/ImageMetadataReader');
const ComfyUIGraph = require('./js/metadata-parser/graph/ComfyUIGraph');

const imagePath = 'tests/fixtures/comfyui_multi.webp';
const buffer = new Uint8Array(fs.readFileSync(imagePath));
const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, 'image/webp');
const promptData = rawChunks.prompt;

const graph = new ComfyUIGraph(promptData);

console.log('=== Topological Sort ===\n');
const topoOrder = graph.getTopologicalOrder();
console.log('Full order:', topoOrder.join(', '));

console.log('\n=== Sampler Execution Order ===\n');
const samplers = ['3', '32', '325', '430'];
samplers.forEach(id => {
  const order = graph.getExecutionOrder(id);
  console.log(`Sampler ${id}: execution order = ${order}`);
});

console.log('\n=== Expected Order ===');
console.log('3 (order: lowest) -> 32 -> 325 -> 430 (order: highest)');
