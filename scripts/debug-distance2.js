// Debug script using actual ComfyUIParser
const fsp = require('fs').promises;
const ImageMetadataReader = require('../js/metadata-parser/binary-extraction/ImageMetadataReader.js');
const ComfyUIParser = require('../js/metadata-parser/parsers/ComfyUIParser.js');

async function debugDistance() {
    const buffer = await fsp.readFile('tests/samples/comfyui_multi.png');
    const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
    
    const promptData = rawChunks.prompt;
    
    console.log('=== Analyzing Samplers ===\n');
    
    // Find all samplers (using same logic as ComfyUIParser)
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
    
    console.log(`Found ${samplers.length} samplers:\n`);
    
    // Check each sampler's latent input
    samplers.forEach(s => {
        const latentInput = s.node.inputs.latent_image || s.node.inputs.samples;
        console.log(`Sampler ID ${s.id}:`);
        console.log(`  latent_image: ${JSON.stringify(latentInput)}`);
        
        if (Array.isArray(latentInput) && latentInput.length === 2) {
            const parentId = String(latentInput[0]);
            const parentNode = promptData[parentId];
            console.log(`  -> Parent ID ${parentId}: ${parentNode?.class_type || 'unknown'}`);
            
            // Check if parent is latent source
            const isLatentSource = (nodeId) => {
                const node = promptData[nodeId];
                if (!node || !node.inputs) return false;
                
                const latentInput = node.inputs.latent_image || node.inputs.samples;
                
                if (latentInput === undefined) {
                    // Special case: VAEEncode is a latent source
                    if (node.class_type && node.class_type.includes('VAEEncode')) {
                        console.log(`     VAEEncode detected! Is latent source.`);
                        return true;
                    }
                    if (node.inputs.image !== undefined) {
                        console.log(`     Has image input (not VAEEncode). Not latent source.`);
                        return false;
                    }
                    console.log(`     No latent/image input. Is latent source.`);
                    return true;
                }
                
                if (!Array.isArray(latentInput)) {
                    console.log(`     Latent input is not array. Is latent source.`);
                    return true;
                }
                if (latentInput.length !== 2) {
                    console.log(`     Latent input array length != 2. Is latent source.`);
                    return true;
                }
                
                console.log(`     Has connected latent input. Not latent source.`);
                return false;
            };
            
            const isSource = isLatentSource(parentId);
            console.log(`  -> Is latent source: ${isSource}`);
            console.log(`  -> Distance: ${isSource ? 1 : '>1'}\n`);
        }
    });
    
    // Now run actual parser
    console.log('\n=== Running ComfyUIParser ===\n');
    const parser = new ComfyUIParser();
    const metadata = parser.parse(rawChunks);
    
    console.log('Base sampler:', metadata.seed);
    console.log('Sampler fallback:', metadata.sampler_fallback);
    console.log('\nAll samplers:');
    metadata.extra_samplers.forEach(s => {
        console.log(`  ID ${s.id}: seed=${s.seed}, is_base=${s.is_base}`);
    });
}

debugDistance().catch(console.error);
