// Debug VAEEncode tracing
const fsp = require('fs').promises;
const ImageMetadataReader = require('../js/metadata-parser/binary-extraction/ImageMetadataReader.js');

async function debugVAETrace() {
    const buffer = await fsp.readFile('tests/samples/comfyui_multi.png');
    const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
    const promptData = rawChunks.prompt;
    
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
    
    console.log('=== Tracing VAEEncode Image Chains ===\n');
    
    // Helper: Trace image chain to find originating sampler
    const traceImageChainToSampler = (nodeId, chainVisited = new Set(), depth = 0) => {
        const indent = '  '.repeat(depth);
        console.log(`${indent}traceImageChainToSampler(${nodeId})`);
        
        if (chainVisited.has(nodeId)) {
            console.log(`${indent}  -> Already visited, return Infinity`);
            return Infinity;
        }
        chainVisited.add(nodeId);
        
        const n = promptData[nodeId];
        if (!n || !n.inputs) {
            console.log(`${indent}  -> Node not found or no inputs, return Infinity`);
            return Infinity;
        }
        
        console.log(`${indent}  -> Node type: ${n.class_type}`);
        
        // Check if this node is a sampler
        const isSampler = samplers.some(s => s.id === nodeId);
        if (isSampler) {
            console.log(`${indent}  -> Is sampler! Call getDistToLatentSource(${nodeId})`);
            const dist = getDistToLatentSource(nodeId);
            console.log(`${indent}  -> Sampler distance: ${dist}`);
            return dist;
        }
        
        // If it's VAEDecode, trace its samples input to find sampler
        if (n.class_type === 'VAEDecode') {
            const samplesInput = n.inputs.samples;
            console.log(`${indent}  -> VAEDecode, samples input: ${JSON.stringify(samplesInput)}`);
            if (Array.isArray(samplesInput) && samplesInput.length === 2) {
                const samplerId = String(samplesInput[0]);
                console.log(`${indent}  -> Call getDistToLatentSource(${samplerId})`);
                const dist = getDistToLatentSource(samplerId);
                console.log(`${indent}  -> Sampler distance: ${dist}`);
                return dist;
            }
        }
        
        // Otherwise trace through image inputs
        const imgInput = n.inputs.image || n.inputs.images || n.inputs.pixels;
        console.log(`${indent}  -> Image input: ${JSON.stringify(imgInput)}`);
        if (Array.isArray(imgInput) && imgInput.length === 2) {
            const upstreamId = String(imgInput[0]);
            console.log(`${indent}  -> Trace upstream to ${upstreamId}`);
            return traceImageChainToSampler(upstreamId, new Set(chainVisited), depth + 1);
        }
        
        console.log(`${indent}  -> No valid image input, return Infinity`);
        return Infinity;
    };
    
    // Helper: Calculate distance from a sampler to nearest latent source
    const getDistToLatentSource = (samplerId, visited = new Set(), depth = 0) => {
        const indent = '  '.repeat(depth);
        console.log(`${indent}getDistToLatentSource(${samplerId})`);
        
        if (visited.has(samplerId)) {
            console.log(`${indent}  -> Already visited, return Infinity`);
            return Infinity;
        }
        visited.add(samplerId);
        
        const node = promptData[samplerId];
        if (!node) {
            console.log(`${indent}  -> Node not found, return Infinity`);
            return Infinity;
        }
        
        console.log(`${indent}  -> Node type: ${node.class_type}`);
        
        // Check if this node has latent_image input
        const latentInput = node.inputs.latent_image || node.inputs.samples;
        console.log(`${indent}  -> Latent input: ${JSON.stringify(latentInput)}`);
        
        // If no latent input, check what type of node this is
        if (latentInput === undefined) {
            // VAEEncode: trace its image input to find originating sampler
            if (node.class_type && node.class_type.includes('VAEEncode')) {
                console.log(`${indent}  -> VAEEncode detected!`);
                const imageInput = node.inputs.image || node.inputs.pixels;
                console.log(`${indent}  -> Image input: ${JSON.stringify(imageInput)}`);
                if (Array.isArray(imageInput) && imageInput.length === 2) {
                    const imageSourceId = String(imageInput[0]);
                    console.log(`${indent}  -> Trace image chain from ${imageSourceId}`);
                    
                    // Trace through image chain to find sampler
                    const chainDist = traceImageChainToSampler(imageSourceId, new Set(), depth + 1);
                    console.log(`${indent}  -> Chain distance: ${chainDist}`);
                    if (chainDist !== Infinity) {
                        const result = chainDist + 1;
                        console.log(`${indent}  -> Return ${chainDist} + 1 = ${result}`);
                        return result;
                    }
                }
                
                // If can't trace, treat as true img2img source (distance 0)
                console.log(`${indent}  -> Can't trace, return 0 (img2img source)`);
                return 0;
            }
            
            // Nodes with image input (not VAEEncode) are not latent sources
            if (node.inputs.image !== undefined || node.inputs.pixels !== undefined) {
                console.log(`${indent}  -> Has image input but not VAEEncode, return Infinity`);
                return Infinity;
            }
            
            // Nodes without latent/image input are true sources (EmptyLatentImage)
            console.log(`${indent}  -> No latent/image input, return 0 (true source)`);
            return 0;
        }
        
        // If latent input is not a link, it's a source
        if (!Array.isArray(latentInput)) {
            console.log(`${indent}  -> Latent input not array, return 0`);
            return 0;
        }
        if (latentInput.length !== 2) {
            console.log(`${indent}  -> Latent input array length != 2, return 0`);
            return 0;
        }
        
        // Trace back through latent_image input
        const parentId = String(latentInput[0]);
        console.log(`${indent}  -> Trace parent ${parentId}`);
        const parentDist = getDistToLatentSource(parentId, new Set(visited), depth + 1);
        if (parentDist !== Infinity) {
            const result = parentDist + 1;
            console.log(`${indent}  -> Return ${parentDist} + 1 = ${result}`);
            return result;
        }
        
        console.log(`${indent}  -> Parent distance Infinity, return Infinity`);
        return Infinity;
    };
    
    // Test ID 32
    console.log('\n=== Testing ID 32 (should be distance 2) ===\n');
    const dist32 = getDistToLatentSource('32');
    console.log(`\nFinal result: ${dist32}\n`);
}

debugVAETrace().catch(console.error);
