# Expected Output Samples

This directory contains sample expected output JSON files for testing metadata parsers. These files demonstrate the expected structure and format of parsed metadata for different image generation formats.

## Purpose

These sample files serve as:
- **Documentation**: Show developers what the parsed metadata structure looks like
- **Test References**: Provide examples for writing tests
- **Format Examples**: Demonstrate different metadata formats (ComfyUI, A1111, multi-format)

## Sample Files

### comfyui_simple.json
Basic ComfyUI metadata with a single sampler.

**Key features:**
- Single KSampler node
- Basic prompt (positive/negative)
- Standard generation parameters (seed, steps, cfg, sampler, scheduler)
- Checkpoint model name

### comfyui_multi_sampler.json
ComfyUI metadata with multiple samplers demonstrating the base sampler selection algorithm.

**Key features:**
- Multiple KSampler nodes with different parameters
- Base sampler identification (is_base: true)
- Merged prompts from multiple samplers
- Extra samplers array with all sampler information

### a1111_simple.json
Automatic1111 (A1111) metadata format.

**Key features:**
- Parsed from "parameters" text field
- Standard A1111 parameter format
- Model/checkpoint name
- Generation parameters

### multi_format.json
Image containing both ComfyUI and A1111 metadata formats.

**Key features:**
- Array of parsed metadata (one per format)
- Demonstrates multi-format detection
- Shows how different parsers extract similar information

## JSON Structure

### ComfyUI Format

```json
{
  "format": "comfyui",
  "seed": 123456,
  "steps": 20,
  "cfg": 7,
  "sampler": "euler",
  "scheduler": "normal",
  "positive": "positive prompt text",
  "negative": "negative prompt text",
  "checkpoint": "model_name.safetensors",
  "extra_samplers": [
    {
      "id": "node_id",
      "seed": 123456,
      "steps": 20,
      "cfg": 7,
      "sampler": "euler",
      "scheduler": "normal",
      "is_base": true
    }
  ],
  "sampler_fallback": false
}
```

### A1111 Format

```json
{
  "format": "a1111",
  "seed": 123456,
  "steps": 20,
  "cfg": 7.5,
  "sampler": "DPM++ 2M Karras",
  "positive": "positive prompt text",
  "negative": "negative prompt text",
  "checkpoint": "model_name.safetensors"
}
```

## Notes

- These are **example** files with generic prompts and parameters
- Actual test images and their expected outputs are stored in `tests/expected/` (parent directory)
- The `extra_samplers` array in ComfyUI format contains all detected samplers
- The `is_base` flag indicates which sampler was identified as the base sampler
- Multi-line prompts are represented with `\n` characters in JSON strings
