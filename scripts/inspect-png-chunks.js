// Script to inspect PNG chunks
const fs = require('fs');

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: node inspect-png-chunks.js <image-path>');
  process.exit(1);
}

const buffer = fs.readFileSync(imagePath);

// Check PNG signature
const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
if (!buffer.slice(0, 8).equals(pngSignature)) {
  console.error('Not a valid PNG file');
  process.exit(1);
}

console.log('Valid PNG file');
console.log('File size:', buffer.length, 'bytes');
console.log('\nChunks:');

let offset = 8; // Skip PNG signature
let chunkIndex = 0;

while (offset < buffer.length) {
  // Read chunk length (4 bytes, big-endian)
  const length = buffer.readUInt32BE(offset);
  offset += 4;
  
  // Read chunk type (4 bytes, ASCII)
  const type = buffer.slice(offset, offset + 4).toString('ascii');
  offset += 4;
  
  // Read chunk data
  const data = buffer.slice(offset, offset + length);
  offset += length;
  
  // Read CRC (4 bytes)
  const crc = buffer.readUInt32BE(offset);
  offset += 4;
  
  chunkIndex++;
  console.log(`\n[${chunkIndex}] ${type}`);
  console.log(`  Length: ${length} bytes`);
  console.log(`  CRC: 0x${crc.toString(16).padStart(8, '0')}`);
  
  // Show first 100 bytes of data for text chunks
  if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
    const preview = data.slice(0, 100).toString('utf8', 0, Math.min(100, data.length));
    console.log(`  Preview: ${preview.replace(/\n/g, '\\n').replace(/\r/g, '\\r')}`);
  }
  
  // Stop at IEND
  if (type === 'IEND') {
    break;
  }
}

console.log(`\nTotal chunks: ${chunkIndex}`);
