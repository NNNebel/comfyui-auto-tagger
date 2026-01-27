// Test script to verify annotation output
const { extractComfyMetadata, processMetadata } = require('../js/core.js');
const fsp = require('fs').promises;

const mockT = (key) => key;

async function testAnnotation() {
    const buffer = await fsp.readFile('tests/samples/comfyui_multi.png');
    
    // Parse PNG
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let offset = 8;
    const raw = {};
    
    while (offset < view.byteLength) {
        if (offset + 4 > view.byteLength) break;
        const length = view.getUint32(offset);
        offset += 4;
        if (offset + 4 > view.byteLength) break;
        const type = String.fromCharCode(
            view.getUint8(offset),
            view.getUint8(offset + 1),
            view.getUint8(offset + 2),
            view.getUint8(offset + 3)
        );
        offset += 4;
        
        if (type === 'tEXt') {
            const chunkData = buffer.slice(offset, offset + length);
            const nullIndex = chunkData.indexOf(0x00);
            if (nullIndex !== -1) {
                const decoder = new TextDecoder('utf-8');
                const keyword = decoder.decode(chunkData.slice(0, nullIndex));
                const text = decoder.decode(chunkData.slice(nullIndex + 1));
                
                try {
                    if (keyword === 'workflow' || keyword === 'prompt') {
                        raw[keyword] = JSON.parse(text);
                    } else {
                        raw[keyword] = text;
                    }
                } catch (e) {}
            }
        }
        offset += length + 4;
    }
    
    const metadata = extractComfyMetadata(raw);
    
    console.log('=== Metadata ===');
    console.log('Base Sampler:');
    console.log(`  Seed: ${metadata.seed}`);
    console.log(`  Steps: ${metadata.steps}`);
    console.log(`  CFG: ${metadata.cfg}`);
    console.log(`  Sampler: ${metadata.sampler}`);
    console.log(`  Scheduler: ${metadata.scheduler}`);
    console.log('');
    console.log('All Samplers:');
    metadata.extra_samplers.forEach(s => {
        console.log(`  [${s.is_base ? 'BASE' : '    '}] ID ${s.id}: seed=${s.seed}, steps=${s.steps}, cfg=${s.cfg}, sampler=${s.sampler}`);
    });
    
    console.log('\n=== Annotation Output ===');
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
    console.log(result.annotation);
    
    console.log('\n=== Tags (Base Sampler Only) ===');
    const tags = Array.from(result.tags).filter(t => t.startsWith('seed:') || t.startsWith('sampler:') || t.startsWith('steps:') || t.startsWith('cfg:'));
    console.log(tags.join(', '));
}

testAnnotation().catch(console.error);
