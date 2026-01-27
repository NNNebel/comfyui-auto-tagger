// Check which nodes were actually executed
const fsp = require('fs').promises;
const ImageMetadataReader = require('../js/metadata-parser/binary-extraction/ImageMetadataReader.js');

async function checkExecution() {
    const buffer = await fsp.readFile('tests/samples/comfyui_multi.png');
    const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
    
    const promptData = rawChunks.prompt;
    const workflowData = rawChunks.workflow;
    
    console.log('=== PROMPT DATA (Executed Nodes) ===');
    console.log(`Total nodes: ${Object.keys(promptData).length}`);
    
    const promptSamplers = [];
    for (const id in promptData) {
        const node = promptData[id];
        if (node.class_type && node.class_type === 'KSampler') {
            promptSamplers.push(id);
        }
    }
    console.log(`KSampler nodes: ${promptSamplers.join(', ')}`);
    
    console.log('\n=== WORKFLOW DATA (All Nodes) ===');
    console.log(`Total nodes: ${workflowData.nodes.length}`);
    
    const workflowSamplers = workflowData.nodes
        .filter(n => n.type === 'KSampler')
        .map(n => n.id);
    console.log(`KSampler nodes: ${workflowSamplers.join(', ')}`);
    
    console.log('\n=== Checking Node 32 ===');
    const node32prompt = promptData['32'];
    const node32workflow = workflowData.nodes.find(n => n.id === 32);
    
    console.log('In prompt data:', !!node32prompt);
    console.log('In workflow data:', !!node32workflow);
    
    if (node32workflow) {
        console.log('Workflow node 32 mode:', node32workflow.mode);
        console.log('Workflow node 32 properties:', JSON.stringify(node32workflow.properties || {}, null, 2));
    }
    
    console.log('\n=== Checking Node 430 ===');
    const node430prompt = promptData['430'];
    const node430workflow = workflowData.nodes.find(n => n.id === 430);
    
    console.log('In prompt data:', !!node430prompt);
    console.log('In workflow data:', !!node430workflow);
    
    if (node430workflow) {
        console.log('Workflow node 430 mode:', node430workflow.mode);
        console.log('Workflow node 430 properties:', JSON.stringify(node430workflow.properties || {}, null, 2));
    }
    
    console.log('\n=== Checking SaveImage/Output Nodes ===');
    const outputNodes = [];
    for (const id in promptData) {
        const node = promptData[id];
        if (node.class_type && (
            node.class_type.includes('Save') || 
            node.class_type.includes('Preview') ||
            node.class_type.includes('Output')
        )) {
            outputNodes.push({ id, type: node.class_type });
        }
    }
    console.log('Output nodes in prompt data:');
    outputNodes.forEach(n => console.log(`  ID ${n.id}: ${n.type}`));
}

checkExecution().catch(console.error);
