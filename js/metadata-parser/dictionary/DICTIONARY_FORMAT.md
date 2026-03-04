# Node Definition Dictionary Format

This document describes the JSON schema for the Node Definition Dictionary used by the ComfyUI metadata extraction system.

## Overview

The Node Definition Dictionary provides metadata about ComfyUI custom nodes to enable automatic metadata extraction without hardcoding node class names. The dictionary defines how to extract values from different node types.

## Schema

### Root Structure

```json
{
  "version": "1.0.0",
  "nodes": {
    "NodeClassName": { /* node definition */ }
  }
}
```

### Required Fields

- `version` (string): Dictionary version in semver format (e.g., "1.0.0")
- `nodes` (object): Map of node class names to their definitions

## Node Definition Types

### 1. Sampler Nodes

Sampler nodes generate images. They require a `port_mapping` that maps metadata fields to input port names.

```json
{
  "class_type": "SamplerCustomAdvanced",
  "type": "sampler",
  "port_mapping": {
    "seed": "noise.noise_seed",
    "steps": "sampler.steps",
    "cfg": "guider.cfg",
    "sampler": "sampler.sampler_name",
    "scheduler": "sampler.scheduler",
    "positive": "guider.positive",
    "negative": "guider.negative"
  }
}
```

**Fields:**
- `class_type` (string): The ComfyUI node class name
- `type` (string): Must be `"sampler"`
- `port_mapping` (object): Maps metadata field names to input port paths
  - Port paths use dot notation for nested connections (e.g., `"noise.noise_seed"`)
  - Supported metadata fields: `seed`, `steps`, `cfg`, `sampler`, `scheduler`, `positive`, `negative`

### 2. Router Nodes

Router nodes pass through values based on selection. They require `passthrough_rules` to define how values flow through.

```json
{
  "class_type": "AnySwitch",
  "type": "router",
  "passthrough_rules": [
    { "from": "input1", "to": "output" },
    { "from": "input2", "to": "output" },
    { "from": "input3", "to": "output" }
  ]
}
```

**Fields:**
- `class_type` (string): The ComfyUI node class name
- `type` (string): Must be `"router"`
- `passthrough_rules` (array): List of input-to-output mappings
  - Each rule has `from` (input port name) and `to` (output port name)
  - The extraction system will try each input in order

### 3. Provider Nodes

Provider nodes supply values (like seed, steps, etc.). They require a `value_path` to locate the value.

```json
{
  "class_type": "RandomNoise",
  "type": "provider",
  "value_path": "inputs.noise_seed"
}
```

**Fields:**
- `class_type` (string): The ComfyUI node class name
- `type` (string): Must be `"provider"`
- `value_path` (string): Path to the value within the node data
  - Uses dot notation (e.g., `"inputs.noise_seed"`)
  - Can also use `value_paths` (array) for multiple possible paths

## Port Path Notation

Port paths use dot notation to traverse connections:

- `"port_name"`: Direct input port on the sampler
- `"port_name.field"`: Field on the connected node
- `"port_name.nested.field"`: Nested field traversal

**Example:**
```json
"seed": "noise.noise_seed"
```
This means:
1. Look at the sampler's `noise` input port
2. Follow the connection to the connected node
3. Extract the `noise_seed` value from that node

## Validation Rules

The dictionary must pass these validation checks:

1. **Version Required**: Must have a `version` field
2. **Valid Node Types**: Each node's `type` must be `"sampler"`, `"router"`, or `"provider"`
3. **Type-Specific Fields**:
   - Sampler nodes must have `port_mapping`
   - Router nodes must have `passthrough_rules`
   - Provider nodes must have `value_path` or `value_paths`

## Complete Example

```json
{
  "version": "1.0.0",
  "nodes": {
    "SamplerCustomAdvanced": {
      "class_type": "SamplerCustomAdvanced",
      "type": "sampler",
      "port_mapping": {
        "seed": "noise.noise_seed",
        "steps": "sampler.steps",
        "cfg": "guider.cfg",
        "sampler": "sampler.sampler_name",
        "scheduler": "sampler.scheduler",
        "positive": "guider.positive",
        "negative": "guider.negative"
      }
    },
    "RandomNoise": {
      "class_type": "RandomNoise",
      "type": "provider",
      "value_path": "inputs.noise_seed"
    },
    "BasicScheduler": {
      "class_type": "BasicScheduler",
      "type": "provider",
      "value_path": "inputs.steps"
    },
    "AnySwitch": {
      "class_type": "AnySwitch",
      "type": "router",
      "passthrough_rules": [
        { "from": "input1", "to": "output" },
        { "from": "input2", "to": "output" },
        { "from": "input3", "to": "output" }
      ]
    }
  }
}
```

## Heuristic Fallback

If a node is not in the dictionary, the system falls back to heuristic pattern matching:

- Looks for input ports matching patterns like `seed`, `noise_seed`, `steps`, etc.
- Follows connections to find values
- Less reliable than dictionary definitions

## Best Practices

1. **Use Specific Paths**: Be as specific as possible in port paths
2. **Test Thoroughly**: Verify extraction works with real workflows
3. **Document Assumptions**: Add comments explaining non-obvious mappings
4. **Version Carefully**: Increment version when making breaking changes
5. **Validate Schema**: Use the `NodeDefinitionDictionary.validate()` method

## See Also

- [Adding Custom Nodes Guide](./ADDING_CUSTOM_NODES.md)
- [Default Dictionary](./default-dictionary.json)
- [NodeDefinitionDictionary API](./NodeDefinitionDictionary.js)
