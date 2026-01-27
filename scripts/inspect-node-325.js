const fs = require('fs');
const ImageMetadataReader = require('../js/metadata-parser/binary-extraction/ImageMetadataReader');

const buffer = new Uint8Array(fs.readFileSync('tests/samples/comfyui_multi.webp'));
const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, 'image/webp');

if (rawChunks.prompt) {
  const node325 = rawChunks.prompt['325'];
  console.log('Node 325 (DetailerForEachDebug):');
  console.log(JSON.stringify(node325, null, 2));
  
  console.log('\n\nNode 3 (KSampler):');
  const node3 = rawChunks.prompt['3'];
  console.log(JSON.stringify(node3, null, 2));
  
  console.log('\n\nNode 122 (EmptyLatentImagePresets):');
  const node122 = rawChunks.prompt['122'];
  console.log(JSON.stringify(node122, null, 2));
}
