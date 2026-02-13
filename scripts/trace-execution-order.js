/**
 * Trace Execution Order Utility
 * 
 * This script analyzes ComfyUI workflow execution order and sampler dependencies.
 * Useful for debugging and understanding complex multi-sampler workflows.
 * 
 * Usage: node scripts/trace-execution-order.js
 */

const ComfyUIGraph = require('../js/metadata-parser/graph/ComfyUIGraph.js');
const fs = require('fs');
const BinaryUtils = require('../js/metadata-parser/utils/BinaryUtils.js');

const data = fs.readFileSync('tests/fixtures/comfyui_multi.webp');
const extracted = BinaryUtils.extractWebPMetadata(new Uint8Array(data));
const prompt = JSON.parse(extracted.prompt);
const graph = new ComfyUIGraph(prompt);

const outputNodes = graph.getOutputNodes();
console.log('Output nodes:', outputNodes);

outputNodes.forEach(id => {
  const samplers = graph.traceToType(id, 'sampler');
  console.log(`From output ${id}:`, samplers.map(s => `${s.id}(depth:${s.depth})`));
});

// Test topological order
const topoOrder = graph.getTopologicalOrder();
console.log('\nTopological order (all nodes):', topoOrder.slice(0, 20), '...');

// Get sampler nodes
const samplerIds = graph.getNodesByType('sampler');
console.log('\nSampler IDs:', samplerIds);

// Get execution order for each sampler
samplerIds.forEach(id => {
  const order = graph.getExecutionOrder(id);
  console.log(`Sampler ${id}: execution order = ${order}`);
});
