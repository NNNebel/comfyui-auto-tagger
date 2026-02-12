/**
 * Profiling script for metadata parsing performance
 * Measures parsing time and memory usage for various samples
 */

const fs = require('fs');
const path = require('path');

// Import parsers
const A1111Parser = require('../js/metadata-parser/parsers/A1111Parser.js');
const ComfyUIParser = require('../js/metadata-parser/parsers/ComfyUIParser.js');
const ImageMetadataReader = require('../js/metadata-parser/binary-extraction/ImageMetadataReader.js');

/**
 * Measure execution time and memory usage
 */
function profile(name, fn, iterations = 100) {
  // Warm up
  for (let i = 0; i < 10; i++) {
    fn();
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const memBefore = process.memoryUsage();
  const startTime = process.hrtime.bigint();
  
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  
  const endTime = process.hrtime.bigint();
  const memAfter = process.memoryUsage();
  
  const durationMs = Number(endTime - startTime) / 1000000 / iterations;
  const memDelta = {
    heapUsed: (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024,
    external: (memAfter.external - memBefore.external) / 1024 / 1024
  };
  
  return {
    name,
    avgTimeMs: durationMs.toFixed(4),
    opsPerSec: (1000 / durationMs).toFixed(0),
    memDeltaMB: memDelta.heapUsed.toFixed(2),
    externalMB: memDelta.external.toFixed(2)
  };
}

/**
 * Profile A1111 parsing
 */
function profileA1111() {
  console.log('\n=== A1111 Parser Profiling ===\n');
  
  const parser = new A1111Parser();
  
  // Simple parameters
  const simpleParams = {
    parameters: 'masterpiece, best quality\nNegative prompt: bad quality\nSteps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123456, Size: 512x512, Model: model_v1'
  };
  
  // Complex parameters with extensions
  const complexParams = {
    parameters: 'masterpiece, best quality, detailed face, <lora:my_lora:0.8>\nNegative prompt: bad quality, ugly\nSteps: 30, Sampler: DPM++ 2M Karras, CFG scale: 7.5, Seed: 987654, Size: 768x768, Model: model_v2, Lora hashes: "my_lora: abc123", Hires upscale: 2, Hires steps: 15, Hires upscaler: Latent, ADetailer model: face_yolov8n.pt, ADetailer confidence: 0.3'
  };
  
  const results = [
    profile('A1111 Simple', () => parser.parse(simpleParams)),
    profile('A1111 Complex', () => parser.parse(complexParams))
  ];
  
  console.table(results);
}

/**
 * Profile ComfyUI parsing
 */
function profileComfyUI() {
  console.log('\n=== ComfyUI Parser Profiling ===\n');
  
  const parser = new ComfyUIParser();
  
  // Load sample workflows
  const samplesDir = path.join(__dirname, '../tests/fixtures');
  const samples = [
    'comfyui_simple.png',
    'comfyui_multi.png',
    'comfyui_flux.png'
  ];
  
  const results = [];
  
  for (const sample of samples) {
    const filePath = path.join(samplesDir, sample);
    if (!fs.existsSync(filePath)) {
      console.log(`Sample not found: ${sample}`);
      continue;
    }
    
    const buffer = fs.readFileSync(filePath);
    const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
    
    if (rawChunks.prompt) {
      try {
        const promptData = typeof rawChunks.prompt === 'string' 
          ? JSON.parse(rawChunks.prompt) 
          : rawChunks.prompt;
        const nodeCount = Object.keys(promptData).length;
        
        results.push(
          profile(`ComfyUI ${sample} (${nodeCount} nodes)`, () => {
            parser.parse({ prompt: rawChunks.prompt });
          })
        );
      } catch (e) {
        console.log(`Failed to parse ${sample}: ${e.message}`);
      }
    }
  }
  
  console.table(results);
}

/**
 * Profile tokenization
 */
function profileTokenization() {
  console.log('\n=== Tokenization Profiling ===\n');
  
  const PromptTokenizer = require('../js/metadata-parser/prompt/PromptTokenizer.js');
  const tokenizer = new PromptTokenizer();
  
  const prompts = {
    simple: 'masterpiece, best quality, detailed face',
    weighted: 'masterpiece, (best quality:1.2), (detailed face:1.5), beautiful eyes',
    complex: 'masterpiece, (best quality:1.2), <lora:my_lora:0.8>, detailed face, (beautiful eyes:1.3), <hypernet:my_hypernet:0.5>, perfect lighting',
    long: Array(100).fill('beautiful, detailed, masterpiece').join(', ')
  };
  
  const results = Object.entries(prompts).map(([name, prompt]) => 
    profile(`Tokenize ${name} (${prompt.length} chars)`, () => tokenizer.tokenize(prompt))
  );
  
  console.table(results);
}

/**
 * Profile parameter parsing
 */
function profileParameterParsing() {
  console.log('\n=== Parameter Parsing Profiling ===\n');
  
  const ParameterParser = require('../js/metadata-parser/parameters/ParameterParser.js');
  const StandardParameterHandler = require('../js/metadata-parser/parameters/StandardParameterHandler.js');
  const LoraHashHandler = require('../js/metadata-parser/parameters/LoraHashHandler.js');
  const ADetailerHandler = require('../js/metadata-parser/parameters/ADetailerHandler.js');
  
  const parser = new ParameterParser();
  parser.registerHandler(new StandardParameterHandler());
  parser.registerHandler(new LoraHashHandler());
  parser.registerHandler(new ADetailerHandler());
  
  const lines = {
    simple: 'Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123456',
    complex: 'Steps: 30, Sampler: DPM++ 2M Karras, CFG scale: 7.5, Seed: 987654, Size: 768x768, Model: model_v2, Lora hashes: "my_lora: abc123, another_lora: def456"',
    extensions: 'Steps: 25, Sampler: Euler a, CFG scale: 7, Seed: 111111, Hires upscale: 2, Hires steps: 15, Hires upscaler: Latent, ADetailer model: face_yolov8n.pt, ADetailer confidence: 0.3, ADetailer dilate erode: 4'
  };
  
  const results = Object.entries(lines).map(([name, line]) => 
    profile(`Parse ${name} (${line.length} chars)`, () => parser.parse(line))
  );
  
  console.table(results);
}

/**
 * Main profiling function
 */
function main() {
  console.log('='.repeat(60));
  console.log('Metadata Parser Performance Profiling');
  console.log('='.repeat(60));
  console.log('\nNote: Run with --expose-gc for accurate memory measurements');
  console.log('Example: node --expose-gc scripts/profile-parsing.js\n');
  
  profileA1111();
  profileComfyUI();
  profileTokenization();
  profileParameterParsing();
  
  console.log('\n' + '='.repeat(60));
  console.log('Profiling Complete');
  console.log('='.repeat(60));
}

// Run profiling
main();
