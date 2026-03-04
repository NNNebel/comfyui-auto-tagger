# Adding Custom Nodes to the Dictionary

This guide explains how to add support for custom ComfyUI nodes to the Node Definition Dictionary.

## Overview

When the metadata extraction system encounters a custom node that's not in the dictionary, it falls back to heuristic pattern matching. While this works in many cases, adding explicit dictionary definitions provides more reliable extraction.

## When to Add a Node

Add a node to the dictionary when:

1. **Heuristic extraction fails**: The node uses non-standard port names
2. **Complex routing**: The node has multiple inputs/outputs with specific routing logic
3. **Nested values**: Values are deeply nested in the node's data structure
4. **High usage**: The node is commonly used in workflows

## Step-by-Step Guide

### 1. Identify the Node Type

Determine which type best describes your node:

- **Sampler**: Generates images (e.g., `KSampler`, `SamplerCustomAdvanced`)
- **Provider**: Supplies values like seed, steps, cfg (e.g., `RandomNoise`, `BasicScheduler`)
- **Router**: Routes values based on selection (e.g., `Switch`, `AnySwitch`)

### 2. Gather Node Information

You'll need:

1. **Class name**: The exact `class_type` from ComfyUI
2. **Input ports**: Names of all input ports
3. **Output ports**: Names of all output ports (for routers)
4. **Value locations**: Where values are stored in the node data

**How to find this information:**

Use the workflow JSON to inspect the node structure:

```json
{
  "5": {
    "class_type": "RandomNoise",
    "inputs": {
      "noise_seed": 12345
    }
  }
}
```

### 3. Create the Definition

#### For Sampler Nodes

```json
{
  "class_type": "YourSamplerNode",
  "type": "sampler",
  "port_mapping": {
    "seed": "noise_port.noise_seed",
    "steps": "scheduler_port.steps",
    "cfg": "cfg_port",
    "sampler": "sampler_port.sampler_name",
    "scheduler": "scheduler_port.scheduler",
    "positive": "positive_port",
    "negative": "negative_port"
  }
}
```

**Port mapping rules:**
- Keys are standard metadata field names: `seed`, `steps`, `cfg`, `sampler`, `scheduler`, `positive`, `negative`
- Values are port paths using dot notation
- `"port.field"` means: follow connection from `port`, then extract `field` from connected node
- `"port"` means: use the value directly from `port`

#### For Provider Nodes

```json
{
  "class_type": "YourProviderNode",
  "type": "provider",
  "value_path": "inputs.your_value_field"
}
```

**Value path rules:**
- Use dot notation to navigate the node data structure
- Common patterns:
  - `"inputs.field_name"` - value in inputs
  - `"widgets_values.0"` - first widget value
  - `"properties.field_name"` - value in properties

**Multiple paths:**
If the value can be in multiple locations, use `value_paths` (array):

```json
{
  "class_type": "YourProviderNode",
  "type": "provider",
  "value_paths": [
    "inputs.primary_field",
    "inputs.fallback_field",
    "widgets_values.0"
  ]
}
```

#### For Router Nodes

```json
{
  "class_type": "YourRouterNode",
  "type": "router",
  "passthrough_rules": [
    { "from": "input1", "to": "output" },
    { "from": "input2", "to": "output" },
    { "from": "input3", "to": "output" }
  ]
}
```

**Passthrough rules:**
- Each rule maps an input port to an output port
- The system tries each input in order
- Use this for switch/router nodes that select between multiple inputs

### 4. Add to Dictionary

#### Option A: Local Testing

1. Edit `js/metadata-parser/dictionary/default-dictionary.json`
2. Add your node definition under `"nodes"`
3. Test with a workflow containing your node

```json
{
  "version": "1.0.0",
  "nodes": {
    "ExistingNode": { /* ... */ },
    "YourNewNode": {
      "class_type": "YourNewNode",
      "type": "provider",
      "value_path": "inputs.value"
    }
  }
}
```

#### Option B: Contribute to Repository

1. Fork the repository
2. Edit `default-dictionary.json`
3. Add your node definition
4. Create a pull request with:
   - Node definition
   - Example workflow (if possible)
   - Description of the node's purpose

### 5. Test Your Definition

#### Manual Testing

1. Create a workflow using your custom node
2. Export the workflow as PNG
3. Open the image in Eagle with the plugin
4. Check if metadata is extracted correctly

#### Automated Testing

Add an integration test:

```javascript
describe('Custom Node: YourNodeName', () => {
  it('should extract metadata from YourNodeName', async () => {
    const imagePath = 'tests/fixtures/your-node-workflow.png';
    const result = await extractMetadata(imagePath);
    
    expect(result.seed).toBe(12345);
    expect(result.steps).toBe(20);
    // ... other assertions
  });
});
```

### 6. Validate the Dictionary

The system automatically validates the dictionary on load. Check for errors:

```javascript
const dictionary = new NodeDefinitionDictionary();
const isValid = dictionary.validate(yourDictionaryJson);
console.log(isValid); // Should be true
```

## Common Patterns

### Pattern 1: Direct Value Provider

Node stores value directly in inputs:

```json
{
  "class_type": "SimpleProvider",
  "type": "provider",
  "value_path": "inputs.value"
}
```

### Pattern 2: Nested Connection

Sampler connects to intermediate node:

```json
{
  "class_type": "AdvancedSampler",
  "type": "sampler",
  "port_mapping": {
    "seed": "noise_provider.noise_seed",
    "steps": "scheduler.steps"
  }
}
```

### Pattern 3: Multi-Input Router

Router with multiple inputs:

```json
{
  "class_type": "MultiSwitch",
  "type": "router",
  "passthrough_rules": [
    { "from": "option_a", "to": "selected" },
    { "from": "option_b", "to": "selected" },
    { "from": "option_c", "to": "selected" }
  ]
}
```

### Pattern 4: Fallback Paths

Provider with multiple possible locations:

```json
{
  "class_type": "FlexibleProvider",
  "type": "provider",
  "value_paths": [
    "inputs.primary_value",
    "inputs.secondary_value",
    "widgets_values.0"
  ]
}
```

## Troubleshooting

### Extraction Still Fails

1. **Check class_type**: Must match exactly (case-sensitive)
2. **Verify port names**: Use workflow JSON to confirm port names
3. **Test value_path**: Ensure the path exists in the node data
4. **Enable debug logging**: Check the extraction trace logs

### Values Are Incorrect

1. **Check port path depth**: May need more/fewer levels of nesting
2. **Verify connection direction**: Ensure you're following the right direction
3. **Check for widget values**: Some nodes use `widgets_values` instead of `inputs`

### Router Not Working

1. **Verify passthrough_rules**: Ensure input/output port names are correct
2. **Check rule order**: Rules are tried in order, first match wins
3. **Test with simple workflow**: Isolate the router node

## Best Practices

1. **Start Simple**: Begin with a minimal definition and expand as needed
2. **Use Specific Names**: Prefer specific port names over generic ones
3. **Document Assumptions**: Add comments explaining non-obvious choices
4. **Test Thoroughly**: Test with multiple workflows
5. **Follow Conventions**: Match existing dictionary style
6. **Version Carefully**: Increment version for breaking changes

## Getting Help

If you're stuck:

1. **Check existing definitions**: Look at similar nodes in `default-dictionary.json`
2. **Inspect workflow JSON**: Use `scripts/inspect-comfyui-structure.js`
3. **Enable trace logging**: Use `MetadataExtractionReporter` to see what's happening
4. **Open an issue**: Provide workflow JSON and expected output

## Example: Adding a Custom Noise Node

Let's walk through a complete example.

### Step 1: Identify the Node

```json
{
  "10": {
    "class_type": "CustomNoiseGenerator",
    "inputs": {
      "seed": 42,
      "variation": 0.5
    }
  }
}
```

This is a **provider** node (supplies seed value).

### Step 2: Create Definition

```json
{
  "class_type": "CustomNoiseGenerator",
  "type": "provider",
  "value_path": "inputs.seed"
}
```

### Step 3: Add to Dictionary

```json
{
  "version": "1.0.0",
  "nodes": {
    "CustomNoiseGenerator": {
      "class_type": "CustomNoiseGenerator",
      "type": "provider",
      "value_path": "inputs.seed"
    }
  }
}
```

### Step 4: Test

Create a workflow using `CustomNoiseGenerator`, export as PNG, and verify seed extraction.

## See Also

- [Dictionary Format Documentation](./DICTIONARY_FORMAT.md)
- [Default Dictionary](./default-dictionary.json)
- [Error Reporting Guide](./ERROR_REPORTING.md)
