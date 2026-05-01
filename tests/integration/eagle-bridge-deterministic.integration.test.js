/**
 * eagle-bridge-integration.test.js
 *
 * Tests for the eagle_bridge deterministic tracing path.
 *
 * eagle-metadata-bridge (ComfyUI custom node) embeds a PNG tEXt chunk:
 *   eagle_bridge: { "version": 1, "final_node_id": "<unique_id>" }
 *
 * comfyui-auto-tagger reads this chunk and passes the node ID as
 * `forcedOutputNodeIds` to ComfyUIGraph, bypassing heuristic graph analysis.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import ComfyUIGraph from '../../js/metadata-parser/graph/ComfyUIGraph.js';
import ComfyUIParser from '../../js/metadata-parser/parsers/ComfyUIParser.js';

// ---------------------------------------------------------------------------
// Shared workflow fixture
//
// Topology:
//   1 (CheckpointLoaderSimple)
//   ├─ 2 (CLIPTextEncode  – positive prompt)
//   ├─ 3 (CLIPTextEncode  – negative prompt)
//   └─ 4 (KSampler)
//        └─ 5 (VAEDecode)
//             ├─ 6 (SaveImage  – the "real" output)
//             └─ 7 (PreviewImage – a second output)
// ---------------------------------------------------------------------------
const WORKFLOW = {
  '1': {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: 'v1-5-pruned-emaonly.safetensors' }
  },
  '2': {
    class_type: 'CLIPTextEncode',
    inputs: { clip: ['1', 1], text: 'a beautiful landscape' }
  },
  '3': {
    class_type: 'CLIPTextEncode',
    inputs: { clip: ['1', 1], text: 'blurry, bad quality' }
  },
  '4': {
    class_type: 'KSampler',
    inputs: {
      model: ['1', 0],
      positive: ['2', 0],
      negative: ['3', 0],
      latent_image: ['1', 3],
      seed: 42,
      steps: 20,
      cfg: 7.5,
      sampler_name: 'euler',
      scheduler: 'normal'
    }
  },
  '5': {
    class_type: 'VAEDecode',
    inputs: { samples: ['4', 0], vae: ['1', 2] }
  },
  '6': {
    class_type: 'SaveImage',
    inputs: { images: ['5', 0], filename_prefix: 'ComfyUI' }
  },
  '7': {
    class_type: 'PreviewImage',
    inputs: { images: ['5', 0] }
  }
};

// ---------------------------------------------------------------------------
// ComfyUIGraph – forcedOutputNodeIds
// ---------------------------------------------------------------------------
describe('ComfyUIGraph – forcedOutputNodeIds', () => {
  it('classifies the forced node as "output" regardless of class_type', () => {
    // Node '4' (KSampler) would normally be classified as 'sampler',
    // but when forced it must become 'output'.
    const graph = new ComfyUIGraph(WORKFLOW, { forcedOutputNodeIds: ['4'] });
    expect(graph.getNodeType('4')).toBe('output');
  });

  it('does not change classification of other nodes', () => {
    const graph = new ComfyUIGraph(WORKFLOW, { forcedOutputNodeIds: ['6'] });
    // '4' is still a sampler
    expect(graph.getNodeType('4')).toBe('sampler');
    // '1' is still a checkpoint_loader
    expect(graph.getNodeType('1')).toBe('checkpoint_loader');
    // '6' itself becomes output (it already was)
    expect(graph.getNodeType('6')).toBe('output');
  });

  it('can force a non-output node to be treated as output', () => {
    // Force the VAEDecode node (normally classified as 'vae') to be output
    const graph = new ComfyUIGraph(WORKFLOW, { forcedOutputNodeIds: ['5'] });
    expect(graph.getNodeType('5')).toBe('output');
  });

  it('getOutputNodes() returns the forced node', () => {
    const graph = new ComfyUIGraph(WORKFLOW, { forcedOutputNodeIds: ['6'] });
    const outputs = graph.getOutputNodes();
    expect(outputs).toContain('6');
    // '7' (PreviewImage) is also an output node – both should appear
    expect(outputs).toContain('7');
  });

  it('getOutputNodes() with forced non-output node returns that node as output', () => {
    // Force node '5' (VAEDecode) only – real SaveImage/PreviewImage are NOT forced
    // but they are still classified as 'output' by class_type heuristic
    const graph = new ComfyUIGraph(WORKFLOW, { forcedOutputNodeIds: ['5'] });
    const outputs = graph.getOutputNodes();
    expect(outputs).toContain('5');
  });

  it('handles multiple forcedOutputNodeIds', () => {
    const graph = new ComfyUIGraph(WORKFLOW, { forcedOutputNodeIds: ['4', '5'] });
    expect(graph.getNodeType('4')).toBe('output');
    expect(graph.getNodeType('5')).toBe('output');
  });

  it('handles string vs numeric node IDs consistently', () => {
    // ComfyUI node IDs are strings but may come in as numbers
    const graph = new ComfyUIGraph(WORKFLOW, { forcedOutputNodeIds: [6] }); // numeric 6
    expect(graph.getNodeType('6')).toBe('output'); // looked up as string
  });
});

// ---------------------------------------------------------------------------
// ComfyUIParser – eagle_bridge chunk
// ---------------------------------------------------------------------------
describe('ComfyUIParser – eagle_bridge chunk', () => {
  let parser;
  beforeEach(() => {
    parser = new ComfyUIParser();
  });

  it('parses normally when eagle_bridge is absent', () => {
    const rawChunks = { prompt: WORKFLOW };
    const result = parser.parse(rawChunks);
    expect(result.format).toBe('comfyui');
    expect(result.checkpoint).toBe('v1-5-pruned-emaonly.safetensors');
  });

  it('accepts eagle_bridge chunk and extracts metadata without error', () => {
    const rawChunks = {
      prompt: WORKFLOW,
      eagle_bridge: { version: 1, final_node_id: '6' }
    };
    const result = parser.parse(rawChunks);
    expect(result.format).toBe('comfyui');
    expect(result.checkpoint).toBe('v1-5-pruned-emaonly.safetensors');
  });

  it('extracts sampler parameters with eagle_bridge pointing to SaveImage node', () => {
    const rawChunks = {
      prompt: WORKFLOW,
      eagle_bridge: { version: 1, final_node_id: '6' }
    };
    const result = parser.parse(rawChunks);
    expect(result.seed).toBe(42);
    expect(result.steps).toBe(20);
    expect(result.cfg).toBe(7.5);
    expect(result.sampler).toBe('euler');
    expect(result.scheduler).toBe('normal');
  });

  it('eagle_bridge final_node_id as string and as number both work', () => {
    const asString = parser.parse({
      prompt: WORKFLOW,
      eagle_bridge: { version: 1, final_node_id: '6' }
    });
    const asNumber = parser.parse({
      prompt: WORKFLOW,
      eagle_bridge: { version: 1, final_node_id: 6 }
    });
    // Both should produce the same checkpoint
    expect(asString.checkpoint).toBe(asNumber.checkpoint);
    expect(asString.seed).toBe(asNumber.seed);
  });

  it('works when eagle_bridge points to a non-standard output node (VAEDecode)', () => {
    // Simulates a workflow where the user's eagle-metadata-bridge node IS the VAEDecode
    // or some other intermediate node that is the actual final output
    const rawChunks = {
      prompt: WORKFLOW,
      eagle_bridge: { version: 1, final_node_id: '5' }
    };
    const result = parser.parse(rawChunks);
    // Should still extract what it can
    expect(result.format).toBe('comfyui');
    expect(result.checkpoint).toBeDefined();
  });

  it('ignores malformed eagle_bridge (no final_node_id) gracefully', () => {
    const rawChunks = {
      prompt: WORKFLOW,
      eagle_bridge: { version: 1 } // missing final_node_id
    };
    expect(() => parser.parse(rawChunks)).not.toThrow();
    const result = parser.parse(rawChunks);
    expect(result.format).toBe('comfyui');
  });

  it('ignores eagle_bridge with null final_node_id gracefully', () => {
    const rawChunks = {
      prompt: WORKFLOW,
      eagle_bridge: { version: 1, final_node_id: null }
    };
    expect(() => parser.parse(rawChunks)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Deterministic vs heuristic: eagle_bridge selects the correct branch
//
// Topology: two independent generation pipelines that both save output.
// Without eagle_bridge, the heuristic picks based on distance/execution order.
// With eagle_bridge, we deterministically pick the correct pipeline.
// ---------------------------------------------------------------------------
describe('eagle_bridge – deterministic branch selection', () => {
  // Two independent pipelines:
  //   Pipeline A: 10 (Checkpoint) → 11 (CLIP+) → 12 (CLIP-) → 13 (KSampler) → 14 (VAEDecode) → 15 (SaveImage, eagle_bridge target)
  //   Pipeline B: 20 (Checkpoint) → 21 (CLIP+) → 22 (CLIP-) → 23 (KSampler) → 24 (VAEDecode) → 25 (SaveImage)
  const DUAL_PIPELINE = {
    // Pipeline A
    '10': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'modelA.safetensors' } },
    '11': { class_type: 'CLIPTextEncode', inputs: { clip: ['10', 1], text: 'pipeline A positive' } },
    '12': { class_type: 'CLIPTextEncode', inputs: { clip: ['10', 1], text: 'pipeline A negative' } },
    '13': {
      class_type: 'KSampler',
      inputs: {
        model: ['10', 0], positive: ['11', 0], negative: ['12', 0],
        latent_image: ['10', 3], seed: 111, steps: 10, cfg: 6, sampler_name: 'dpm_2', scheduler: 'karras'
      }
    },
    '14': { class_type: 'VAEDecode', inputs: { samples: ['13', 0], vae: ['10', 2] } },
    '15': { class_type: 'SaveImage', inputs: { images: ['14', 0] } },

    // Pipeline B
    '20': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'modelB.safetensors' } },
    '21': { class_type: 'CLIPTextEncode', inputs: { clip: ['20', 1], text: 'pipeline B positive' } },
    '22': { class_type: 'CLIPTextEncode', inputs: { clip: ['20', 1], text: 'pipeline B negative' } },
    '23': {
      class_type: 'KSampler',
      inputs: {
        model: ['20', 0], positive: ['21', 0], negative: ['22', 0],
        latent_image: ['20', 3], seed: 222, steps: 30, cfg: 9, sampler_name: 'euler_a', scheduler: 'normal'
      }
    },
    '24': { class_type: 'VAEDecode', inputs: { samples: ['23', 0], vae: ['20', 2] } },
    '25': { class_type: 'SaveImage', inputs: { images: ['24', 0] } }
  };

  let parser;
  beforeEach(() => {
    parser = new ComfyUIParser();
  });

  it('eagle_bridge pointing to pipeline A SaveImage extracts pipeline A sampler params', () => {
    const rawChunks = {
      prompt: DUAL_PIPELINE,
      eagle_bridge: { version: 1, final_node_id: '15' }
    };
    const result = parser.parse(rawChunks);
    expect(result.seed).toBe(111);
    expect(result.steps).toBe(10);
    expect(result.cfg).toBe(6);
    expect(result.sampler).toBe('dpm_2');
    expect(result.checkpoint).toBe('modelA.safetensors');
  });

  it('eagle_bridge pointing to pipeline B SaveImage extracts pipeline B sampler params', () => {
    const rawChunks = {
      prompt: DUAL_PIPELINE,
      eagle_bridge: { version: 1, final_node_id: '25' }
    };
    const result = parser.parse(rawChunks);
    expect(result.seed).toBe(222);
    expect(result.steps).toBe(30);
    expect(result.cfg).toBe(9);
    expect(result.sampler).toBe('euler_a');
    expect(result.checkpoint).toBe('modelB.safetensors');
  });

  it('without eagle_bridge, both pipelines produce some result (heuristic path)', () => {
    const rawChunks = { prompt: DUAL_PIPELINE };
    // Should not throw and should return some metadata
    expect(() => parser.parse(rawChunks)).not.toThrow();
    const result = parser.parse(rawChunks);
    expect(result.format).toBe('comfyui');
    // Heuristic picks one of the two – we don't assert which one
    expect([111, 222]).toContain(result.seed);
  });
});
