// tests/helpers/generateSamples.mjs
// Generate sample PNG and WebP images with metadata for testing

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Calculate CRC32 checksum for PNG chunks
 */
function calculateCRC32(data) {
  let crc = 0xffffffff;
  
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Create a PNG chunk with proper structure
 */
function createPngChunk(type, data) {
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  const view = new DataView(chunk.buffer);

  // Length
  view.setUint32(0, data.length);

  // Type
  for (let i = 0; i < 4; i++) {
    chunk[4 + i] = type.charCodeAt(i);
  }

  // Data
  chunk.set(data, 8);

  // CRC
  const crc = calculateCRC32(chunk.slice(4, 8 + data.length));
  view.setUint32(8 + data.length, crc);

  return chunk;
}

/**
 * Create a minimal valid PNG image with tEXt chunks
 */
function createPngWithMetadata(textChunks) {
  const pngSignature = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
  ]);

  // IHDR chunk (minimal 1x1 image)
  const ihdrData = new Uint8Array([
    0x00, 0x00, 0x00, 0x01, // Width: 1
    0x00, 0x00, 0x00, 0x01, // Height: 1
    0x08,                   // Bit depth: 8
    0x02,                   // Color type: RGB
    0x00,                   // Compression: deflate
    0x00,                   // Filter: adaptive
    0x00                    // Interlace: none
  ]);
  const ihdrChunk = createPngChunk('IHDR', ihdrData);

  // Create tEXt chunks
  const textChunkBuffers = textChunks.map(({ keyword, text }) => {
    const chunkData = new TextEncoder().encode(keyword + '\0' + text);
    return createPngChunk('tEXt', chunkData);
  });

  // IDAT chunk (minimal compressed image data)
  const idatData = new Uint8Array([
    0x08, 0x1d, 0x01, 0x02, 0x00, 0xfd, 0xff, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01
  ]);
  const idatChunk = createPngChunk('IDAT', idatData);

  // IEND chunk
  const iendChunk = createPngChunk('IEND', new Uint8Array(0));

  // Combine all chunks
  const totalLength = pngSignature.length + ihdrChunk.length + 
    textChunkBuffers.reduce((sum, buf) => sum + buf.length, 0) +
    idatChunk.length + iendChunk.length;

  const buffer = new Uint8Array(totalLength);
  let offset = 0;

  buffer.set(pngSignature, offset);
  offset += pngSignature.length;

  buffer.set(ihdrChunk, offset);
  offset += ihdrChunk.length;

  for (const textChunk of textChunkBuffers) {
    buffer.set(textChunk, offset);
    offset += textChunk.length;
  }

  buffer.set(idatChunk, offset);
  offset += idatChunk.length;

  buffer.set(iendChunk, offset);

  return buffer;
}

/**
 * Create a WebP chunk
 */
function createWebpChunk(type, data) {
  const paddedSize = data.length + (data.length % 2);
  const chunk = new Uint8Array(8 + paddedSize);
  const view = new DataView(chunk.buffer);

  // Type
  for (let i = 0; i < 4; i++) {
    chunk[i] = type.charCodeAt(i);
  }

  // Size (little-endian)
  view.setUint32(4, data.length, true);

  // Data
  chunk.set(data, 8);

  // Padding byte if needed
  if (data.length % 2 === 1) {
    chunk[8 + data.length] = 0;
  }

  return chunk;
}

/**
 * Create a minimal valid WebP image with EXIF chunk
 */
function createWebpWithMetadata(exifData) {
  // Minimal VP8 bitstream for 1x1 white image
  const vp8Data = new Uint8Array([
    0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00,
    0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);

  const vp8Chunk = createWebpChunk('VP8 ', vp8Data);
  
  // Create EXIF chunk if data provided
  const exifChunk = exifData ? createWebpChunk('EXIF', new TextEncoder().encode(exifData)) : null;

  // Calculate total file size
  const chunksSize = vp8Chunk.length + (exifChunk ? exifChunk.length : 0);
  const fileSize = 4 + chunksSize; // 'WEBP' + chunks

  // Create RIFF header
  const header = new Uint8Array(12);
  const headerView = new DataView(header.buffer);
  
  // 'RIFF'
  header[0] = 0x52; header[1] = 0x49; header[2] = 0x46; header[3] = 0x46;
  // File size (little-endian)
  headerView.setUint32(4, fileSize, true);
  // 'WEBP'
  header[8] = 0x57; header[9] = 0x45; header[10] = 0x42; header[11] = 0x50;

  // Combine all parts
  const totalLength = header.length + chunksSize;
  const buffer = new Uint8Array(totalLength);
  let offset = 0;

  buffer.set(header, offset);
  offset += header.length;

  buffer.set(vp8Chunk, offset);
  offset += vp8Chunk.length;

  if (exifChunk) {
    buffer.set(exifChunk, offset);
  }

  return buffer;
}

// Generate sample images
const samplesDir = join(__dirname, '..', 'samples');

console.log('Generating sample images...');

// 1. ComfyUI PNG sample
const comfyuiWorkflow = {
  nodes: [
    { id: 1, type: 'CheckpointLoaderSimple', outputs: { MODEL: 'model1' } },
    { id: 2, type: 'CLIPTextEncode', inputs: { text: 'cat, detailed' } },
    { id: 3, type: 'KSampler', inputs: { seed: 123456, steps: 20, cfg: 7.0, sampler_name: 'euler' } }
  ]
};

const comfyuiPrompt = {
  "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "model.safetensors" } },
  "2": { class_type: "CLIPTextEncode", inputs: { text: "cat, detailed, masterpiece" } },
  "3": { class_type: "CLIPTextEncode", inputs: { text: "ugly, blurry" } },
  "4": { class_type: "KSampler", inputs: { seed: 123456, steps: 20, cfg: 7.0, sampler_name: "euler", model: ["1", 0], positive: ["2", 0], negative: ["3", 0] } }
};

const comfyuiPng = createPngWithMetadata([
  { keyword: 'workflow', text: JSON.stringify(comfyuiWorkflow) },
  { keyword: 'prompt', text: JSON.stringify(comfyuiPrompt) }
]);

writeFileSync(join(samplesDir, 'comfyui_sample.png'), comfyuiPng);
console.log('✓ Created: comfyui_sample.png');

// 2. A1111 PNG sample
const a1111Parameters = `cat, detailed, masterpiece
Negative prompt: ugly, blurry, low quality
Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123456, Size: 512x512, Model: sd_model_v1.5`;

const a1111Png = createPngWithMetadata([
  { keyword: 'parameters', text: a1111Parameters }
]);

writeFileSync(join(samplesDir, 'a1111_sample.png'), a1111Png);
console.log('✓ Created: a1111_sample.png');

// 3. Multi-format PNG sample (both ComfyUI and A1111)
const multiFormatPng = createPngWithMetadata([
  { keyword: 'workflow', text: JSON.stringify(comfyuiWorkflow) },
  { keyword: 'prompt', text: JSON.stringify(comfyuiPrompt) },
  { keyword: 'parameters', text: a1111Parameters }
]);

writeFileSync(join(samplesDir, 'multi_format.png'), multiFormatPng);
console.log('✓ Created: multi_format.png');

// 4. ComfyUI WebP sample
const webpExifData = `workflow:${JSON.stringify(comfyuiWorkflow)}\nprompt:${JSON.stringify(comfyuiPrompt)}`;
const comfyuiWebp = createWebpWithMetadata(webpExifData);

writeFileSync(join(samplesDir, 'comfyui_sample.webp'), comfyuiWebp);
console.log('✓ Created: comfyui_sample.webp');

console.log('\n✅ All sample images created successfully!');
