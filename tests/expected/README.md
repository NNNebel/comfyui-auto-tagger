# Expected Test Outputs

This directory contains expected output JSON files for integration testing of metadata parsers.

## Directory Structure

```
tests/expected/
├── README.md                      # This file
├── sample/                        # Sample expected outputs for documentation
│   ├── README.md                 # Detailed explanation of sample files
│   ├── comfyui_simple.json       # Basic ComfyUI example
│   ├── comfyui_multi_sampler.json # Multi-sampler ComfyUI example
│   ├── a1111_simple.json         # Basic A1111 example
│   └── multi_format.json         # Multi-format example
├── comfyui_simple_png.json       # Expected output for tests/samples/comfyui_simple.png
├── comfyui_simple_webp.json      # Expected output for tests/samples/comfyui_simple.webp
├── comfyui_multi_png.json        # Expected output for tests/samples/comfyui_multi.png
└── comfyui_multi_webp.json       # Expected output for tests/samples/comfyui_multi.webp
```

## File Types

### Sample Files (`sample/` directory)
- **Purpose**: Documentation and examples for developers
- **Content**: Generic prompts and parameters for reference
- **Usage**: Understanding metadata structure and parser output format
- **Version Control**: ✅ Committed to repository

### Actual Test Files (root directory)
- **Purpose**: Integration testing with real sample images
- **Content**: Actual metadata from test images in `tests/samples/`
- **Usage**: Automated tests compare parser output against these files
- **Version Control**: ❌ NOT committed (generated locally from sample images)
- **Note**: Developers generate these files from their own test images

## Usage in Tests

Integration tests load sample images from `tests/samples/` and compare the parsed metadata against the corresponding expected output files in this directory.

Example:
```javascript
// Load sample image
const buffer = readFileSync('tests/samples/comfyui_simple.png');

// Parse metadata
const metadata = metadataService.extractMetadata(buffer, 'image/png');

// Load expected output
const expected = JSON.parse(readFileSync('tests/expected/comfyui_simple_png.json'));

// Compare
expect(metadata).toEqual(expected);
```

## Adding New Test Cases

1. Add sample image to `tests/samples/`
2. Extract metadata using: `node scripts/analyze-image.js tests/samples/your_image.png`
3. Save the output to a new JSON file in this directory
4. Update integration tests to include the new test case

## Notes

- File names should match the corresponding sample image names
- PNG and WebP versions of the same image should have separate expected files
- Keep expected files in sync with parser output format changes
