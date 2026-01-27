// Debug script to check sampler distances
const fsp = require('fs').promises;

async function debugDistance() {
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
                    if (keyword === 'prompt') {
                        raw[keyword] = JSON.parse(text);
                    }
                } catch (e) {}
            }
        }
        offset += length + 4;
    }
    
    const promptData = raw.prompt;
    
    // Find samplers
    const samplers = [];
    for (const id in promptData) {
        const node = promptData[id];
        if (!node || !node.class_type || !node.inputs) continue;
        
        const hasSeed = node.inputs.seed !== undefined;
        const hasSteps = node.inputs.steps !== undefined;
        const hasCfg = node.inputs.cfg !== undefined;
        const hasPositive = node.inputs.positive !== undefined;
        const hasNegative = node.inputs.negative !== undefined;
        
        const samplingParamCount = [hasSeed, hasSteps, hasCfg, hasPositive, hasNegative].filter(Boolean).length;
        
        if (samplingParamCount >= 3) {
            samplers.push({ id, node });
        }
    }
    
    console.log(`Found ${samplers.length} samplers:`);
    samplers.forEach(s => {
        const latentInput = s.node.inputs.latent_image || s.node.inputs.samples;
        console.log(`  ID ${s.id}: latent_image = ${JSON.stringify(latentInput)}`);
        
        if (Array.isArray(latentInput) && latentInput.length === 2) {
            const parentId = latentInput[0];
            const parentNode = promptData[parentId];
            console.log(`    -> Parent ID ${parentId}: ${parentNode?.class_type || 'unknown'}`);
        }
    });
    
    // Check isLatentSource for each parent
    const isLatentSource = (nodeId) => {
        const node = promptData[nodeId];
        if (!node || !node.inputs) return false;
        
        const latentInput = node.inputs.latent_image || node.inputs.samples;
        
        if (latentInput === undefined) {
            // Special case: VAEEncode is a latent source
            if (node.class_type && node.class_type.includes('VAEEncode')) {
                return true;
            }
            if (node.inputs.image !== undefined) {
                return false;
            }
            return true;
        }
        
        if (!Array.isArray(latentInput)) return true;
        if (latentInput.length !== 2) return true;
        
        return false;
    };
    
    console.log('\nLatent source check:');
    samplers.forEach(s => {
        const latentInput = s.node.inputs.latent_image || s.node.inputs.samples;
        if (Array.isArray(latentInput) && latentInput.length === 2) {
            const parentId = latentInput[0];
            const isSource = isLatentSource(parentId);
            console.log(`  Parent ${parentId} is latent source: ${isSource}`);
        }
    });
}

debugDistance().catch(console.error);
