# Test Sample Images

This directory contains sample images with known metadata for testing the metadata parser.

## Sample Files

- `comfyui_sample.png` - PNG image with ComfyUI metadata
- `comfyui_sample.webp` - WebP image with ComfyUI metadata
- `a1111_sample.png` - PNG image with Automatic1111 metadata
- `multi_format.png` - PNG image with both ComfyUI and A1111 metadata

## Purpose

These sample images enable:
- Independent testing without Eagle dependencies
- Validation of metadata extraction across different formats
- Regression testing to ensure backward compatibility
- Property-based testing with known inputs

## Adding New Samples

When adding new sample images:
1. Place the image file in this directory
2. Create a corresponding expected output JSON file in `tests/expected/`
3. Document the sample in this README
4. Add a test case in `tests/integration/sample-based.test.js`
