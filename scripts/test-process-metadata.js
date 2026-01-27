// Test processMetadata output
const { processMetadata } = require('../js/core.js');

const mockT = (key) => key;

const metadata = {
    format: 'comfyui',
    checkpoint: 'boleromixIllustrious_v700.safetensors',
    seed: 111111,
    steps: 30,
    cfg: 6,
    sampler: 'dpmpp_2m',
    scheduler: 'normal',
    positive: 'masterpiece, best quality, 1girl',
    negative: 'worst quality, low quality',
    extra_samplers: [
        { id: '3', seed: 111111, steps: 30, cfg: 6, sampler: 'dpmpp_2m', scheduler: 'normal', is_base: true },
        { id: '32', seed: 222222, steps: 20, cfg: 6, sampler: 'dpmpp_2m', scheduler: 'normal', is_base: false },
        { id: '325', seed: 333333, steps: 30, cfg: 7, sampler: 'dpmpp_2m', scheduler: 'normal', is_base: false },
        { id: '430', seed: 444444, steps: 2, cfg: 2, sampler: 'dpmpp_2m', scheduler: 'normal', is_base: false }
    ]
};

const settings = {
    checkpoint: true,
    lora: true,
    positive: true,
    negative: true,
    seed: true,
    sampler: true,
    steps: true,
    cfg: true,
    writeNotes: true
};

const result = processMetadata(metadata, settings, mockT);

console.log('=== Tags (Base Sampler Only) ===');
const paramTags = Array.from(result.tags).filter(t => 
    t.startsWith('seed:') || t.startsWith('sampler:') || t.startsWith('steps:') || t.startsWith('cfg:')
);
console.log(paramTags.join('\n'));

console.log('\n=== Annotation (All Samplers) ===');
console.log(result.annotation);
