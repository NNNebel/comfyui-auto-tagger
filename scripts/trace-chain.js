// Trace the execution chain
const fsp = require('fs').promises;
const ImageMetadataReader = require('../js/metadata-parser/binary-extraction/ImageMetadataReader.js');

async function traceChain() {
    const buffer = await fsp.readFile('tests/samples/comfyui_multi.png');
    const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
    const promptData = rawChunks.prompt;
    
    console.log('=== Tracing Sampler Chain ===\n');
    
    // Find all samplers
    const samplers = [3, 32, 325, 430];
    
    // Helper to trace back through any input
    const traceBack = (nodeId, inputKey, depth = 0, visited = new Set()) => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        
        const indent = '  '.repeat(depth);
        const node = promptData[nodeId];
        if (!node) return;
        
        console.log(`${indent}Node ${nodeId} (${node.class_type})`);
        
        const inputValue = node.inputs[inputKey];
        if (Array.isArray(inputValue) && inputValue.length === 2) {
            const parentId = String(inputValue[0]);
            console.log(`${indent}  <- ${inputKey} from Node ${parentId}`);
            
            // Continue tracing
            const parentNode = promptData[parentId];
            if (parentNode) {
                // For VAEDecode, trace latent_image
                if (parentNode.class_type === 'VAEDecode') {
                    traceBack(parentId, 'samples', depth + 1, new Set(visited));
                }
                // For VAEEncode, trace image
                else if (parentNode.class_type === 'VAEEncode') {
                    traceBack(parentId, 'image', depth + 1, new Set(visited));
                }
                // For KSampler, trace latent_image
                else if (parentNode.class_type === 'KSampler') {
                    traceBack(parentId, 'latent_image', depth + 1, new Set(visited));
                }
            }
        }
    };
    
    samplers.forEach(id => {
        console.log(`\n=== Sampler ${id} ===`);
        const node = promptData[id];
        if (!node) {
            console.log('Not found in prompt data');
            return;
        }
        
        const latentInput = node.inputs.latent_image || node.inputs.samples;
        if (latentInput) {
            traceBack(id, 'latent_image', 0);
        } else {
            console.log('No latent_image input');
        }
    });
    
    // Check VAEEncode nodes specifically
    console.log('\n\n=== VAEEncode Nodes ===');
    for (const id in promptData) {
        const node = promptData[id];
        if (node.class_type === 'VAEEncode') {
            console.log(`\nNode ${id} (VAEEncode):`);
            console.log(`  Inputs:`, JSON.stringify(node.inputs, null, 2));
            
            const imageInput = node.inputs.image;
            if (Array.isArray(imageInput) && imageInput.length === 2) {
                const sourceId = String(imageInput[0]);
                const sourceNode = promptData[sourceId];
                console.log(`  -> image from Node ${sourceId} (${sourceNode?.class_type || 'unknown'})`);
                
                // If source is VAEDecode, trace its sampler
                if (sourceNode?.class_type === 'VAEDecode') {
                    const samplesInput = sourceNode.inputs.samples;
                    if (Array.isArray(samplesInput) && samplesInput.length === 2) {
                        const samplerId = String(samplesInput[0]);
                        const samplerNode = promptData[samplerId];
                        console.log(`     -> VAEDecode from Node ${samplerId} (${samplerNode?.class_type || 'unknown'})`);
                    }
                }
            }
        }
    }
}

traceChain().catch(console.error);
