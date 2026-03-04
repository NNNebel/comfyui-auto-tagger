import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// Import using require for IIFE modules
const ComfyUIGraph = require('../../js/metadata-parser/graph/ComfyUIGraph.js');

/**
 * Property-Based Tests for Graph Traversal
 * 
 * These tests verify universal properties of graph traversal and connection handling.
 * Using fast-check to generate randomized test cases.
 */

describe('Graph Traversal - Property Tests', () => {
  /**
   * Property 31: Multiple Output Connection Validation
   * 
   * A node can have multiple outputs, and each output can be connected to different nodes.
   * 
   * **Validates: Requirements 11.2**
   */
  describe('Property 31: Multiple Output Connection Validation', () => {
    it('should handle nodes with multiple output connections', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }), // number of output connections
          (numOutputs) => {
            const promptData = {
              "1": {
                "class_type": "CheckpointLoader",
                "inputs": {
                  "ckpt_name": "model.safetensors"
                }
              }
            };

            // Add nodes that connect to different outputs of node 1
            for (let i = 0; i < numOutputs; i++) {
              promptData[`output_${i}`] = {
                "class_type": "CLIPTextEncode",
                "inputs": {
                  "clip": ["1", i], // Different output index
                  "text": `prompt ${i}`
                }
              };
            }

            const graph = new ComfyUIGraph(promptData);

            // Property: All output connections should be valid
            for (let i = 0; i < numOutputs; i++) {
              const node = graph.getNode(`output_${i}`);
              expect(node).toBeDefined();
              expect(node.inputs.clip).toEqual(["1", i]);
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 32: Multiple Input Connection Validation
   * 
   * A node can have multiple inputs, each connected to different nodes.
   * 
   * **Validates: Requirements 11.3**
   */
  describe('Property 32: Multiple Input Connection Validation', () => {
    it('should handle nodes with multiple input connections', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }), // number of input connections
          (numInputs) => {
            const promptData = {};

            // Add source nodes
            for (let i = 0; i < numInputs; i++) {
              promptData[`source_${i}`] = {
                "class_type": "CLIPTextEncode",
                "inputs": {
                  "text": `prompt ${i}`
                }
              };
            }

            // Add target node with multiple inputs
            const inputs = {};
            for (let i = 0; i < numInputs; i++) {
              inputs[`input_${i}`] = [`source_${i}`, 0];
            }
            promptData["target"] = {
              "class_type": "CustomNode",
              "inputs": inputs
            };

            const graph = new ComfyUIGraph(promptData);
            const targetNode = graph.getNode("target");

            // Property: All input connections should be valid
            expect(targetNode).toBeDefined();
            for (let i = 0; i < numInputs; i++) {
              expect(targetNode.inputs[`input_${i}`]).toEqual([`source_${i}`, 0]);
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 33: Connection Information Usage
   * 
   * getConnectedNodeId should correctly extract node ID from connection arrays.
   * 
   * **Validates: Requirements 11.5**
   */
  describe('Property 33: Connection Information Usage', () => {
    it('should extract node ID from connection array', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 10 }), // source node ID
          fc.integer({ min: 0, max: 10 }), // output index
          (sourceId, outputIndex) => {
            const promptData = {
              [sourceId]: {
                "class_type": "SourceNode",
                "inputs": {}
              },
              "target": {
                "class_type": "TargetNode",
                "inputs": {
                  "connection": [sourceId, outputIndex]
                }
              }
            };

            const graph = new ComfyUIGraph(promptData);
            const connectedId = graph.getConnectedNodeId("target", "connection");

            // Property: Should extract correct node ID
            return connectedId === sourceId;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should return null for non-array connections', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.constant(null),
            fc.constant(undefined)
          ), // non-array value
          (value) => {
            const promptData = {
              "target": {
                "class_type": "TargetNode",
                "inputs": {
                  "connection": value
                }
              }
            };

            const graph = new ComfyUIGraph(promptData);
            const connectedId = graph.getConnectedNodeId("target", "connection");

            // Property: Should return null for non-array connections
            return connectedId === null;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 34: Router Node Exploration Continuation
   * 
   * When encountering a router node, exploration should continue through it.
   * 
   * **Validates: Requirements 12.1**
   */
  describe('Property 34: Router Node Exploration Continuation', () => {
    it('should traverse through router nodes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999999999 }), // final value
          (finalValue) => {
            const promptData = {
              "provider": {
                "class_type": "RandomNoise",
                "inputs": {
                  "noise_seed": finalValue
                }
              },
              "router": {
                "class_type": "AnySwitch",
                "inputs": {
                  "input1": ["provider", 0],
                  "input2": ["provider", 0],
                  "select": 1
                }
              },
              "sampler": {
                "class_type": "SamplerCustomAdvanced",
                "inputs": {
                  "noise": ["router", 0],
                  "latent_image": ["latent", 0]
                }
              },
              "latent": {
                "class_type": "EmptyLatentImage",
                "inputs": {
                  "width": 512,
                  "height": 512
                }
              }
            };

            const graph = new ComfyUIGraph(promptData);

            // Property: Should be able to traverse from sampler through router to provider
            const samplerNode = graph.getNode("sampler");
            expect(samplerNode).toBeDefined();
            
            const noiseConnection = graph.getConnectedNodeId("sampler", "noise");
            expect(noiseConnection).toBe("router");
            
            const routerNode = graph.getNode("router");
            expect(routerNode).toBeDefined();

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 35: Multiple Matching Input Exploration
   * 
   * When multiple inputs match a pattern, all should be explorable.
   * 
   * **Validates: Requirements 12.3**
   */
  describe('Property 35: Multiple Matching Input Exploration', () => {
    it('should handle multiple inputs with similar names', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }), // number of similar inputs
          (numInputs) => {
            const promptData = {
              "target": {
                "class_type": "CustomNode",
                "inputs": {}
              }
            };

            // Add multiple inputs with similar names
            for (let i = 0; i < numInputs; i++) {
              promptData[`source_${i}`] = {
                "class_type": "SourceNode",
                "inputs": {}
              };
              promptData.target.inputs[`input_${i}`] = [`source_${i}`, 0];
            }

            const graph = new ComfyUIGraph(promptData);

            // Property: All inputs should be accessible
            for (let i = 0; i < numInputs; i++) {
              const connectedId = graph.getConnectedNodeId("target", `input_${i}`);
              expect(connectedId).toBe(`source_${i}`);
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property: Graph Construction Consistency
   * 
   * Constructing a graph multiple times with the same data should produce identical results.
   * 
   * **Validates: General correctness**
   */
  describe('Property: Graph Construction Consistency', () => {
    it('should produce identical graphs for the same input', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // number of nodes
          (numNodes) => {
            const promptData = {};

            for (let i = 0; i < numNodes; i++) {
              promptData[`node_${i}`] = {
                "class_type": "TestNode",
                "inputs": {
                  "value": i
                }
              };
            }

            const graph1 = new ComfyUIGraph(promptData);
            const graph2 = new ComfyUIGraph(promptData);

            // Property: Both graphs should have the same nodes
            for (let i = 0; i < numNodes; i++) {
              const node1 = graph1.getNode(`node_${i}`);
              const node2 = graph2.getNode(`node_${i}`);
              
              expect(node1).toBeDefined();
              expect(node2).toBeDefined();
              expect(node1.class_type).toBe(node2.class_type);
              expect(node1.inputs.value).toBe(node2.inputs.value);
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property: Input Port Existence Check
   * 
   * hasInputPort should correctly identify existing and non-existing ports.
   * 
   * **Validates: General correctness**
   */
  describe('Property: Input Port Existence Check', () => {
    it('should correctly identify existing input ports', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 5 }), // port names
          (portNames) => {
            const inputs = {};
            portNames.forEach((name, i) => {
              inputs[name] = i;
            });

            const promptData = {
              "node": {
                "class_type": "TestNode",
                "inputs": inputs
              }
            };

            const graph = new ComfyUIGraph(promptData);

            // Property: All defined ports should exist
            for (const portName of portNames) {
              expect(graph.hasInputPort("node", portName)).toBe(true);
            }

            // Property: Non-existent port should not exist
            expect(graph.hasInputPort("node", "non_existent_port_xyz")).toBe(false);

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should return false for non-existent nodes', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // port name
          (portName) => {
            const promptData = {
              "existing_node": {
                "class_type": "TestNode",
                "inputs": {}
              }
            };

            const graph = new ComfyUIGraph(promptData);

            // Property: Non-existent node should return false
            return graph.hasInputPort("non_existent_node", portName) === false;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property: Get Input Port Value
   * 
   * getInputPort should return the correct value for existing ports.
   * 
   * **Validates: General correctness**
   */
  describe('Property: Get Input Port Value', () => {
    it('should return correct values for input ports', () => {
      fc.assert(
        fc.property(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 10 }),
            fc.oneof(
              fc.integer(),
              fc.string(),
              fc.array(fc.anything(), { maxLength: 2 })
            ),
            { minKeys: 1, maxKeys: 5 }
          ), // input values
          (inputs) => {
            const promptData = {
              "node": {
                "class_type": "TestNode",
                "inputs": inputs
              }
            };

            const graph = new ComfyUIGraph(promptData);

            // Property: All input values should be retrievable
            for (const [portName, expectedValue] of Object.entries(inputs)) {
              const actualValue = graph.getInputPort("node", portName);
              
              if (Array.isArray(expectedValue)) {
                expect(actualValue).toEqual(expectedValue);
              } else {
                expect(actualValue).toBe(expectedValue);
              }
            }

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should return undefined for non-existent ports', () => {
      const promptData = {
        "node": {
          "class_type": "TestNode",
          "inputs": {
            "existing_port": 123
          }
        }
      };

      const graph = new ComfyUIGraph(promptData);

      // Property: Non-existent port should return undefined
      expect(graph.getInputPort("node", "non_existent_port")).toBe(undefined);
    });
  });
});
