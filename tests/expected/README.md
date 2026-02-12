# Expected Test Outputs

> [!IMPORTANT]
> **Expected output files are NOT committed to the repository.**
> 
> Developers must generate their own expected output files from sample images for testing.

## Directory Structure

```
tests/expected/
├── README.md                      # This file
├── sample/                        # Sample expected outputs for documentation (committed)
│   ├── README.md                  # Detailed explanation of sample files
│   ├── comfyui_simple_png.json    # Basic ComfyUI example
│   ├── comfyui_multi_png.json     # Multi-sampler ComfyUI example
│   ├── a1111_simple.json          # Basic A1111 example
│   └── ...
├── comfyui_simple_png.json        # Actual test data (NOT committed)
├── comfyui_multi_png.json         # Actual test data (NOT committed)
└── ...
```

## File Types

### Sample Files (`sample/` directory)
- **Purpose**: Documentation and examples for developers.
- **Content**: **Fictional/Generic** prompts and parameters. Do not contain real paths or sensitive info.
- **Usage**: Understanding metadata structure and parser output format.
- **Version Control**: ✅ Committed to repository.

### Actual Test Files (root `tests/expected/` directory)
- **Purpose**: Integration testing with real sample images.
- **Content**: **Actual** metadata extracted from test images in `tests/fixtures/`.
- **Usage**: Automated tests compare parser output against these files.
- **Version Control**: ❌ NOT committed (generated locally from fixture images).
- **Location**: `tests/expected/*.json` (excluded by `.gitignore`).

## Why aren't expected files committed?

1. **Privacy**: May contain project-specific prompts, paths, or settings from developers' environments.
2. **File Size**: Reduces repository bloat.
3. **Flexibility**: Each developer can test with their own workflows and images.
4. **Consistency**: Fixture images (`tests/fixtures/`) are not committed either.

## Generating Expected Output Files

When you add fixture images to `tests/fixtures/`, you need to generate corresponding expected output files.

> [!WARNING]
> Do NOT use `analyze-image.js` to generate expected files, as it uses the parser code itself (circular logic).
> Use the independent Python script instead.

1. **Extract Raw Metadata (Ground Truth)**
   Run the Python script to extract raw metadata chunks without using the project's parser code:
   ```bash
   python scripts/extract_metadata_standard.py
   ```
   This generates raw JSON files in `tests/expected/raw-metadata/`.

2. **Create Expected JSON**
   Based on the raw metadata, manually create the expected JSON file in `tests/expected/`.
   Use `tests/expected/sample/*.json` as templates for the structure.

## Usage in Tests

Integration tests load fixture images from `tests/fixtures/` and compare the parsed metadata against expected output files in `tests/expected/`:

```javascript
// Load fixture image
const buffer = readFileSync('tests/fixtures/comfyui_simple.png');

// Parse metadata
const metadata = metadataService.extractMetadata(buffer, 'image/png');

// Load expected output (from tests/expected/)
const expectedPath = 'tests/expected/comfyui_simple_png.json';
if (existsSync(expectedPath)) {
  const expected = JSON.parse(readFileSync(expectedPath));
  expect(metadata).toEqual(expected);
} else {
  console.log('Expected file not found, skipping test');
}
```

## File Naming Convention

Expected output files should match the fixture image names with extension:

- `tests/fixtures/comfyui_simple.png` → `tests/expected/comfyui_simple_png.json`
- `tests/fixtures/comfyui_simple.webp` → `tests/expected/comfyui_simple_webp.json`
- `tests/fixtures/comfyui_multi.png` → `tests/expected/comfyui_multi_png.json`