const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Images that need expected output files
const imagesToProcess = [
  { image: 'tests/fixtures/comfyui_i2i.webp', output: 'tests/expected/comfyui_i2i_webp.json' },
  { image: 'tests/fixtures/comfyui_multi.png', output: 'tests/expected/comfyui_multi_png.json' },
  { image: 'tests/fixtures/comfyui_simple.png', output: 'tests/expected/comfyui_simple_png.json' },
  { image: 'tests/fixtures/comfyui_simple.webp', output: 'tests/expected/comfyui_simple_webp.json' }
];

console.log('Generating expected output files...\n');

imagesToProcess.forEach(({ image, output }) => {
  // Check if output already exists
  if (fs.existsSync(output)) {
    console.log(`✓ ${output} already exists, skipping`);
    return;
  }

  console.log(`Processing ${image}...`);
  
  try {
    // Run analyze-image script
    const result = execSync(`node scripts/analyze-image.js ${image}`, { encoding: 'utf8' });
    
    // Find JSON array in output
    const lines = result.split('\n');
    const jsonStart = lines.findIndex(l => l.trim().startsWith('['));
    
    if (jsonStart >= 0) {
      const jsonStr = lines.slice(jsonStart).join('\n');
      const parsed = JSON.parse(jsonStr);
      
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Write first result to expected output file
        fs.writeFileSync(output, JSON.stringify(parsed[0], null, 2));
        console.log(`✓ Created ${output}\n`);
      } else {
        console.log(`✗ No metadata found in ${image}\n`);
      }
    } else {
      console.log(`✗ Could not find JSON output for ${image}\n`);
    }
  } catch (error) {
    console.error(`✗ Error processing ${image}:`, error.message, '\n');
  }
});

console.log('Done!');
