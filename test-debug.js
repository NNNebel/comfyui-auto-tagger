const ComfyUIParser = require('./js/metadata-parser/parsers/ComfyUIParser.js');

const parser = new ComfyUIParser();
const prompt = {};

// すべてのフラグがfalseの場合のテストケース
const ksamplerInputs = {
  seed: 12345,
  steps: 20,
  cfg: 7,
  latent_image: ['20', 0]
};

prompt['1'] = {
  class_type: 'KSampler',
  inputs: ksamplerInputs
};

prompt['20'] = {
  class_type: 'EmptyLatentImage',
  inputs: {}
};

const rawChunks = { prompt };
const result = parser.parse(rawChunks);

console.log('Result:', JSON.stringify(result, null, 2));
console.log('\nChecking fields:');
console.log('checkpoint:', result.checkpoint, '(expected: undefined)');
console.log('loras:', result.loras, '(expected: undefined)');
console.log('positive:', result.positive, '(expected: undefined)');
console.log('negative:', result.negative, '(expected: undefined)');
console.log('seed:', result.seed, '(expected: 12345)');
console.log('sampler:', result.sampler, '(expected: undefined)');
console.log('steps:', result.steps, '(expected: 20)');
console.log('cfg:', result.cfg, '(expected: 7)');
