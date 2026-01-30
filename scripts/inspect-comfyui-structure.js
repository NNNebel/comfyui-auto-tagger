// Script to inspect ComfyUI metadata structure in detail
const fs = require('fs');
const path = require('path');
const ImageMetadataReader = require('../js/metadata-parser/binary-extraction/ImageMetadataReader');

const imagePath = process.argv[2];
if (!imagePath) {
  console.error('Usage: node scripts/inspect-comfyui-structure.js <image-path>');
  console.error('Example: node scripts/inspect-comfyui-structure.js tests/samples/comfyui_multi.webp');
  process.exit(1);
}

const buffer = new Uint8Array(fs.readFileSync(imagePath));
const ext = path.extname(imagePath).toLowerCase();
const mimeType = ext === '.png' ? 'image/png' : 'image/webp';

const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, mimeType);

console.log('═══════════════════════════════════════════════════════════════');
console.log('  ComfyUI Metadata Structure Inspector');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`Image: ${imagePath}`);
console.log(`Format: ${mimeType}`);
console.log('');

// ===== PROMPT DATA =====
if (rawChunks.prompt) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  PROMPT DATA (Execution Graph)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const prompt = rawChunks.prompt;
  const nodeIds = Object.keys(prompt).sort((a, b) => parseInt(a) - parseInt(b));
  
  console.log(`Total nodes: ${nodeIds.length}\n`);
  
  // Group nodes by type
  const nodesByType = {};
  nodeIds.forEach(id => {
    const node = prompt[id];
    const type = node.class_type || 'Unknown';
    if (!nodesByType[type]) {
      nodesByType[type] = [];
    }
    nodesByType[type].push(id);
  });
  
  console.log('Nodes by type:');
  Object.keys(nodesByType).sort().forEach(type => {
    console.log(`  ${type}: ${nodesByType[type].length} node(s) [IDs: ${nodesByType[type].join(', ')}]`);
  });
  
  console.log('\n');
  
  // Find and display KSamplers in detail
  const ksamplers = [];
  nodeIds.forEach(id => {
    const node = prompt[id];
    if (node.class_type && node.class_type.includes('KSampler')) {
      ksamplers.push({ id, node });
    }
  });
  
  if (ksamplers.length > 0) {
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`  KSampler Nodes (${ksamplers.length} found)`);
    console.log('─────────────────────────────────────────────────────────────');
    
    ksamplers.forEach((k, index) => {
      console.log(`\n[${index + 1}] KSampler ID: ${k.id}`);
      console.log(`    Class Type: ${k.node.class_type}`);
      console.log(`    Title: ${k.node._meta?.title || 'N/A'}`);
      console.log(`    Inputs:`);
      
      const inputs = k.node.inputs;
      Object.keys(inputs).forEach(key => {
        const val = inputs[key];
        if (Array.isArray(val)) {
          console.log(`      ${key}: [Link to Node ${val[0]}, Slot ${val[1]}]`);
        } else {
          console.log(`      ${key}: ${val}`);
        }
      });
    });
  }
  
  // Find and display text encode nodes (prompts)
  console.log('\n');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('  Text Encode Nodes (Prompts)');
  console.log('─────────────────────────────────────────────────────────────');
  
  const textNodes = [];
  nodeIds.forEach(id => {
    const node = prompt[id];
    if (node.class_type && node.class_type.includes('CLIPTextEncode')) {
      textNodes.push({ id, node });
    }
  });
  
  if (textNodes.length > 0) {
    textNodes.forEach((t, index) => {
      console.log(`\n[${index + 1}] Text Node ID: ${t.id}`);
      console.log(`    Title: ${t.node._meta?.title || 'N/A'}`);
      console.log(`    Text: "${t.node.inputs.text}"`);
    });
  } else {
    console.log('  No CLIPTextEncode nodes found');
  }
  
  // Find checkpoint loaders
  console.log('\n');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('  Checkpoint Loaders');
  console.log('─────────────────────────────────────────────────────────────');
  
  const checkpoints = [];
  nodeIds.forEach(id => {
    const node = prompt[id];
    if (node.class_type && node.class_type.includes('CheckpointLoader')) {
      checkpoints.push({ id, node });
    }
  });
  
  if (checkpoints.length > 0) {
    checkpoints.forEach((c, index) => {
      console.log(`\n[${index + 1}] Checkpoint Loader ID: ${c.id}`);
      console.log(`    Class Type: ${c.node.class_type}`);
      console.log(`    Checkpoint: ${c.node.inputs.ckpt_name || 'N/A'}`);
    });
  } else {
    console.log('  No CheckpointLoader nodes found');
  }
  
  // Find LoRA loaders
  console.log('\n');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('  LoRA Loaders');
  console.log('─────────────────────────────────────────────────────────────');
  
  const loras = [];
  nodeIds.forEach(id => {
    const node = prompt[id];
    if (node.class_type && node.class_type.includes('Lora')) {
      loras.push({ id, node });
    }
  });
  
  if (loras.length > 0) {
    loras.forEach((l, index) => {
      console.log(`\n[${index + 1}] LoRA Loader ID: ${l.id}`);
      console.log(`    Class Type: ${l.node.class_type}`);
      console.log(`    Inputs:`);
      Object.keys(l.node.inputs).forEach(key => {
        const val = l.node.inputs[key];
        if (!Array.isArray(val) && key.includes('lora')) {
          console.log(`      ${key}: ${val}`);
        }
      });
    });
  } else {
    console.log('  No LoRA loader nodes found');
  }
  
  // Find source nodes (EmptyLatentImage, VAEEncode, etc.)
  console.log('\n');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('  Source Nodes (for distance calculation)');
  console.log('─────────────────────────────────────────────────────────────');
  
  const sources = [];
  nodeIds.forEach(id => {
    const node = prompt[id];
    if (node.class_type === 'EmptyLatentImage' || 
        node.class_type.includes('VAEEncode') ||
        node.class_type === 'LoadImage') {
      sources.push({ id, node });
    }
  });
  
  if (sources.length > 0) {
    sources.forEach((s, index) => {
      console.log(`\n[${index + 1}] Source Node ID: ${s.id}`);
      console.log(`    Class Type: ${s.node.class_type}`);
      console.log(`    Title: ${s.node._meta?.title || 'N/A'}`);
    });
  } else {
    console.log('  No source nodes found');
  }
  
} else {
  console.log('No prompt data found in image');
}

// ===== WORKFLOW DATA =====
console.log('\n\n');
if (rawChunks.workflow) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  WORKFLOW DATA (UI State)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const workflow = rawChunks.workflow;
  
  if (workflow.nodes) {
    console.log(`Total nodes in workflow: ${workflow.nodes.length}\n`);
    
    // Count KSamplers in workflow
    const workflowKSamplers = workflow.nodes.filter(n => 
      n.type && n.type.includes('KSampler')
    );
    
    console.log(`KSampler nodes in workflow: ${workflowKSamplers.length}`);
    
    if (workflowKSamplers.length > 0) {
      console.log('\nWorkflow KSampler IDs:');
      workflowKSamplers.forEach((k, index) => {
        console.log(`  [${index + 1}] ID: ${k.id}, Type: ${k.type}, Title: ${k.title || 'N/A'}`);
      });
    }
    
    // Show checkpoint loaders in workflow
    const workflowCheckpoints = workflow.nodes.filter(n =>
      n.type && n.type.includes('CheckpointLoader')
    );
    
    if (workflowCheckpoints.length > 0) {
      console.log('\n\nCheckpoint Loaders in workflow:');
      workflowCheckpoints.forEach((c, index) => {
        console.log(`  [${index + 1}] ID: ${c.id}, Type: ${c.type}`);
        if (c.widgets_values && c.widgets_values[0]) {
          console.log(`      Checkpoint: ${c.widgets_values[0]}`);
        }
      });
    }
  }
} else {
  console.log('No workflow data found in image');
}

console.log('\n');
console.log('═══════════════════════════════════════════════════════════════');
console.log('  End of Report');
console.log('═══════════════════════════════════════════════════════════════');
