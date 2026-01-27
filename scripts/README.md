# Scripts

This directory contains utility scripts for development and testing of the ComfyUI Auto Tagger plugin.

## Available Scripts

### analyze-image.js

Analyzes an image file and extracts metadata using the metadata parser.

**Usage:**
```bash
node scripts/analyze-image.js <image-path> [output-json-path]
```

**Arguments:**
- `image-path` (required): Path to the image file (PNG or WebP)
- `output-json-path` (optional): Path to save the parsed metadata as JSON

**Example:**
```bash
# Analyze and display metadata
node scripts/analyze-image.js tests/samples/comfyui_sample.png

# Analyze and save to file
node scripts/analyze-image.js tests/samples/comfyui_sample.png output.json
```

**Output:**
- Displays MIME type, detected formats, and parsed metadata
- Optionally saves the parsed metadata to a JSON file

---

### inspect-metadata.js

Inspects raw metadata chunks from an image file without parsing.

**Usage:**
```bash
node scripts/inspect-metadata.js <image-path>
```

**Arguments:**
- `image-path` (required): Path to the image file (PNG or WebP)

**Example:**
```bash
node scripts/inspect-metadata.js tests/samples/comfyui_sample.png
```

**Output:**
- Displays raw metadata chunk keys and their content
- Useful for debugging metadata extraction issues

---

### inspect-comfyui-structure.js

Provides detailed inspection of ComfyUI workflow structure.

**Usage:**
```bash
node scripts/inspect-comfyui-structure.js <image-path>
```

**Arguments:**
- `image-path` (required): Path to the ComfyUI image file (PNG or WebP)

**Example:**
```bash
node scripts/inspect-comfyui-structure.js tests/samples/comfyui_sample.png
```

**Output:**
- Total node count and nodes grouped by type
- Detailed information about KSampler nodes
- Text encode nodes (prompts)
- Checkpoint and LoRA loaders
- Source nodes for distance calculation
- Workflow data summary

---

### inspect-node-detail.js

Displays detailed information about a specific node in a ComfyUI workflow.

**Usage:**
```bash
node scripts/inspect-node-detail.js <image-path> <node-id>
```

**Arguments:**
- `image-path` (required): Path to the ComfyUI image file (PNG or WebP)
- `node-id` (required): The ID of the node to inspect

**Example:**
```bash
node scripts/inspect-node-detail.js tests/samples/comfyui_sample.png 325
```

**Output:**
- Node class type and title
- All input parameters and their values
- Full node data structure

---

### inspect-png-chunks.js

Lists all chunks in a PNG file with their types and sizes.

**Usage:**
```bash
node scripts/inspect-png-chunks.js <image-path>
```

**Arguments:**
- `image-path` (required): Path to the PNG image file

**Example:**
```bash
node scripts/inspect-png-chunks.js tests/samples/comfyui_sample.png
```

**Output:**
- PNG file validation
- List of all chunks with length and CRC
- Preview of text chunk content (tEXt, iTXt, zTXt)

---

### inspect-comf-chunk.js

Inspects ComfyUI-specific `comf` chunks in PNG files.

**Usage:**
```bash
node scripts/inspect-comf-chunk.js <image-path>
```

**Arguments:**
- `image-path` (required): Path to the PNG image file

**Example:**
```bash
node scripts/inspect-comf-chunk.js tests/samples/comfyui_sample.png
```

**Output:**
- Details of each `comf` chunk found
- First 500 characters of chunk data
- JSON parsing status

---

## Development Workflow

These scripts are primarily used for:

1. **Testing metadata extraction**: Use `analyze-image.js` to verify that metadata is correctly extracted from images
2. **Debugging parser issues**: Use `inspect-metadata.js` and `inspect-comfyui-structure.js` to examine raw data
3. **Understanding workflow structure**: Use `inspect-node-detail.js` to examine specific nodes
4. **Investigating file format issues**: Use `inspect-png-chunks.js` and `inspect-comf-chunk.js` to examine low-level file structure

## Notes

- All scripts require Node.js to be installed
- Scripts should be run from the project root directory
- These scripts are for development purposes only and are not included in the Eagle plugin package
