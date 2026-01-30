# Expected Output Samples

This directory contains sample expected output JSON files for documentation and reference. These files demonstrate the expected structure and format of parsed metadata for different image generation formats.

> [!NOTE]
> The files in this directory contain **fictional/generic data** (e.g., "horse running") and do not match the actual metadata of the test images in `tests/samples/`.
> For integration testing, accurate JSON files matching the real images are generated in `tests/expected/` (parent directory).

## Purpose

These sample files serve as:
- **Documentation**: Show developers what the parsed metadata structure looks like
- **Format Examples**: Demonstrate different metadata formats (ComfyUI, A1111)
- **Safe Sharing**: Allow sharing expected JSON structures without exposing private metadata from test images

## Sample Files

### comfyui_simple_png.json
Basic ComfyUI metadata with a single sampler.

**Key features:**
- Single KSampler node
- Basic prompt (positive/negative)
- Standard generation parameters (seed, steps, cfg, sampler, scheduler)
- Checkpoint model name

### comfyui_multi_png.json
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

### civitai-generate1.json
A1111 format example with LoRA hashes.

**Key features:**
- Includes LoRA usage and hashes
- Complex prompt structure

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

- These are **example** files with generic prompts and parameters.
- Actual test execution uses files in `tests/expected/`.
- The `extra_samplers` array in ComfyUI format contains all detected samplers.
- The `is_base` flag indicates which sampler was identified as the base sampler.