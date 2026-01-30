# Utility Scripts

This directory contains utility scripts for analyzing and debugging image metadata.

## Available Scripts

### analyze-image.js

Analyze an image and output its metadata as JSON. This is the primary tool for extracting and inspecting metadata from ComfyUI and A1111 images.

**Usage:**
```bash
node scripts/analyze-image.js <image-path> [output-path]
```

**Examples:**
```bash
# Display metadata in console
node scripts/analyze-image.js tests/samples/comfyui_simple.png

# Save metadata to JSON file
node scripts/analyze-image.js tests/samples/comfyui_simple.png output.json

# Analyze WebP image
node scripts/analyze-image.js tests/samples/comfyui_simple.webp
```

**Output:**
- Detected formats (ComfyUI, A1111, or both)
- Parsed metadata including:
  - Checkpoint and LoRA names
  - Positive and negative prompts
  - Generation parameters (seed, steps, CFG, sampler)
  - All samplers information (for multi-sampler workflows)

---

### extract_metadata_standard.py (Python)

Standard library based metadata extractor. Extracts raw metadata (chunks) from PNG and WebP files without external dependencies. This is useful for creating ground-truth data for tests or verifying raw file content.

**Usage:**
```bash
python scripts/extract_metadata_standard.py
```

**Behavior:**
- Scans `tests/samples/` directory for `.png` and `.webp` files.
- Extracts standard text chunks (`tEXt`, `iTXt`) and private chunks (`comf`) from PNGs.
- Extracts `EXIF` and `XMP` metadata from WebPs.
- Saves raw metadata as JSON files in `tests/expected/raw-metadata/`.

**Output:**
- JSON files named like `<filename>_raw.json` in `tests/expected/raw-metadata/`.

---

### inspect-png-chunks.js

Low-level PNG chunk inspector. Displays all chunks in a PNG file with their types, lengths, and preview of text chunks.

**Usage:**
```bash
node scripts/inspect-png-chunks.js <image-path>
```

**Example:**
```bash
node scripts/inspect-png-chunks.js tests/samples/comfyui_simple.png
```

**Output:**
- PNG signature validation
- List of all chunks (IHDR, tEXt, IDAT, IEND, etc.)
- Chunk lengths and CRC values
- Preview of text chunk contents

**Use cases:**
- Verify PNG file structure
- Check if metadata chunks exist
- Debug PNG parsing issues

---

### inspect-comfyui-structure.js

Detailed ComfyUI metadata structure inspector. Provides a comprehensive view of ComfyUI workflow structure, including nodes, connections, and parameters.

**Usage:**
```bash
node scripts/inspect-comfyui-structure.js <image-path>
```

**Example:**
```bash
node scripts/inspect-comfyui-structure.js tests/samples/comfyui_multi.png
```

**Output:**
- Total node count and grouping by type
- KSampler nodes with all parameters
- Text encode nodes (prompts)
- Checkpoint and LoRA loaders
- Source nodes (EmptyLatentImage, VAEEncode, LoadImage)
- Workflow UI state information

**Use cases:**
- Understand complex multi-sampler workflows
- Debug sampler distance calculation
- Identify node connections and data flow
- Verify prompt and parameter extraction

---

### inspect-metadata.js

Quick raw metadata inspector. Displays raw metadata chunks without parsing or interpretation.

**Usage:**
```bash
node scripts/inspect-metadata.js <image-path>
```

**Example:**
```bash
node scripts/inspect-metadata.js tests/samples/comfyui_simple.png
```

**Output:**
- Raw prompt data (JSON)
- Raw workflow data (JSON)
- KSampler node count and basic info

**Use cases:**
- Quick metadata check
- Verify metadata presence
- Debug metadata extraction issues

---

### inspect-node-detail.js

Inspect a specific node in detail. Useful for debugging specific nodes in complex workflows.

**Usage:**
```bash
node scripts/inspect-node-detail.js <image-path> <node-id>
```

**Examples:**
```bash
# Inspect node 325 in a workflow
node scripts/inspect-node-detail.js tests/samples/comfyui_multi.webp 325

# Inspect a KSampler node
node scripts/inspect-node-detail.js tests/samples/comfyui_multi.png 3
```

**Output:**
- Node class type
- Node title (if available)
- All inputs with values and connections
- Full node data as JSON

**Use cases:**
- Debug specific node behavior
- Verify node connections
- Check node parameters

---

## Common Workflows

### Creating Test Expected Outputs

1. **Generate raw metadata (Ground Truth):**
   ```bash
   python scripts/extract_metadata_standard.py
   ```
   This creates raw JSON files in `tests/expected/raw-metadata/`.

2. **Create expected output JSON:**
   Manually create or update files in `tests/expected/sample/` based on the content of raw metadata files.

### Debugging Parser Issues

1. **Check if metadata exists:**
   ```bash
   node scripts/inspect-metadata.js <image-path>
   ```

2. **Verify PNG structure:**
   ```bash
   node scripts/inspect-png-chunks.js <image-path>
   ```

3. **Analyze ComfyUI workflow:**
   ```bash
   node scripts/inspect-comfyui-structure.js <image-path>
   ```

4. **Inspect specific nodes:**
   ```bash
   node scripts/inspect-node-detail.js <image-path> <node-id>
   ```

5. **Compare parsed output:**
   ```bash
   node scripts/analyze-image.js <image-path>
   ```

### Investigating Multi-Sampler Workflows

For complex workflows with multiple samplers (HiresFix, FaceDetailer, etc.):

```bash
# Get overview of all samplers and their connections
node scripts/inspect-comfyui-structure.js tests/samples/comfyui_multi.png

# Check parsed metadata to verify base sampler selection
node scripts/analyze-image.js tests/samples/comfyui_multi.png
```

---

## Notes

- All scripts support both PNG and WebP formats
- Scripts automatically detect MIME type from file extension
- Use these scripts for development and debugging only
- For production use, use the `MetadataService` API directly

## Adding New Scripts

When adding new utility scripts:
1. Keep them focused on a single purpose
2. Provide clear usage instructions
3. Add examples to this README
4. Use consistent error handling and output formatting
5. Support both PNG and WebP formats when applicable