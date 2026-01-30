# Expected Test Outputs

> [!IMPORTANT]
> **Expected output files are NOT committed to the repository.**
> 
> Developers must generate their own expected output files from sample images for testing.

## Directory Structure

```
tests/expected/
├── README.md                      # This file
└── sample/                        # Sample expected outputs for documentation
    ├── README.md                  # Detailed explanation of sample files
    ├── comfyui_simple.json        # Basic ComfyUI example
    ├── comfyui_multi_sampler.json # Multi-sampler ComfyUI example
    ├── a1111_simple.json          # Basic A1111 example
    └── multi_format.json          # Multi-format example
```

## File Types

### Sample Files (`sample/` directory)
- **Purpose**: Documentation and examples for developers
- **Content**: Generic prompts and parameters for reference
- **Usage**: Understanding metadata structure and parser output format
- **Version Control**: ✅ Committed to repository

### Actual Test Files (root directory - NOT in repository)
- **Purpose**: Integration testing with real sample images
- **Content**: Actual metadata from test images in `tests/samples/`
- **Usage**: Automated tests compare parser output against these files
- **Version Control**: ❌ NOT committed (generated locally from sample images)
- **Location**: `tests/expected/*.json` (excluded by `.gitignore`)

## Why aren't expected files committed?

1. **Privacy**: May contain project-specific prompts or settings
2. **File Size**: Reduces repository bloat
3. **Flexibility**: Each developer can test with their own workflows
4. **Consistency**: Sample images aren't committed either

## Generating Expected Output Files

When you add sample images to `tests/samples/`, generate corresponding expected output files:

```bash
# Generate expected output for a PNG image
node scripts/analyze-image.js tests/samples/comfyui_simple.png tests/expected/comfyui_simple_png.json

# Generate expected output for a WebP image
node scripts/analyze-image.js tests/samples/comfyui_simple.webp tests/expected/comfyui_simple_webp.json
```

## Usage in Tests

Integration tests load sample images from `tests/samples/` and compare the parsed metadata against expected output files:

```javascript
// Load sample image
const buffer = readFileSync('tests/samples/comfyui_simple.png');

// Parse metadata
const metadata = metadataService.extractMetadata(buffer, 'image/png');

// Load expected output (if exists)
const expectedPath = 'tests/expected/comfyui_simple_png.json';
if (existsSync(expectedPath)) {
  const expected = JSON.parse(readFileSync(expectedPath));
  expect(metadata).toEqual(expected);
} else {
  console.log('Expected file not found, skipping test');
}
```

## File Naming Convention

Expected output files should match the sample image names:

- `tests/samples/comfyui_simple.png` → `tests/expected/comfyui_simple_png.json`
- `tests/samples/comfyui_simple.webp` → `tests/expected/comfyui_simple_webp.json`
- `tests/samples/comfyui_multi.png` → `tests/expected/comfyui_multi_png.json`

## Notes

- Expected files are automatically ignored by git (see `.gitignore`)
- Tests will skip if expected files don't exist
- Keep expected files in sync with parser output format changes
- Regenerate expected files after parser updates
