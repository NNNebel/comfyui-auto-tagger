// Script to inspect comf chunks in PNG
const fs = require('fs');

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: node inspect-comf-chunk.js <image-path>');
  process.exit(1);
}

const buffer = fs.readFileSync(imagePath);

// Check PNG signature
const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
if (!buffer.slice(0, 8).equals(pngSignature)) {
  console.error('Not a valid PNG file');
  process.exit(1);
}

let offset = 8; // Skip PNG signature
let comfIndex = 0;

while (offset < buffer.length) {
  const length = buffer.readUInt32BE(offset);
  offset += 4;
  
  const type = buffer.slice(offset, offset + 4).toString('ascii');
  offset += 4;
  
  if (type === 'comf') {
    comfIndex++;
    console.log(`\n=== comf chunk ${comfIndex} ===`);
    console.log(`Length: ${length} bytes`);
    
    const data = buffer.slice(offset, offset + length);
    
    // Try to decode as UTF-8
    const text = data.toString('utf8');
    console.log('\nFirst 500 characters:');
    console.log(text.substring(0, 500));
    
    // Try to parse as JSON
    try {
      const json = JSON.parse(text);
      console.log('\nSuccessfully parsed as JSON');
      console.log('Keys:', Object.keys(json));
    } catch (e) {
      console.log('\nNot valid JSON');
    }
  }
  
  offset += length + 4; // Skip data and CRC
  
  if (type === 'IEND') break;
}
