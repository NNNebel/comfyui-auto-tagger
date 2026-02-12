const fs = require('fs');
const ImageMetadataReader = require('./js/metadata-parser/binary-extraction/ImageMetadataReader');
const ComfyUIGraph = require('./js/metadata-parser/graph/ComfyUIGraph');
const ComfyUISamplerAnalyzer = require('./js/metadata-parser/graph/ComfyUISamplerAnalyzer');

const imagePath = 'tests/fixtures/comfyui_multi.webp';
const buffer = new Uint8Array(fs.readFileSync(imagePath));
const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, 'image/webp');
const promptData = rawChunks.prompt;

const graph = new ComfyUIGraph(promptData);
const analyzer = new ComfyUISamplerAnalyzer(graph);

console.log('=== Sampler Analysis ===\n');
const result = analyzer.findBaseSampler();

console.log('Base Sampler:', result.baseSampler);
console.log('Is Fallback:', result.isFallback);
console.log('\nAll Samplers:');
result.allSamplers.forEach(s => {
  console.log(`  ID: ${s.id}, Distance: ${s.distance}, Execution Order: ${s.executionOrder}`);
});

console.log('\n=== Expected ===');
console.log('Order: 3 (dist=1, exec=12) -> 32 (dist=1, exec=30) -> 325 (dist=3, exec=42) -> 430 (dist=1, exec=49)');
console.log('Note: 325 should be BEFORE 430 because 325 has exec order 42 < 49');
