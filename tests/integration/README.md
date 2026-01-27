# Integration Tests

This directory contains integration tests that validate the complete metadata parsing pipeline.

## Test Files

- `sample-based.test.js` - Tests using sample images and expected outputs

## Purpose

Integration tests validate:
- Complete end-to-end metadata extraction
- Parsing of real image files with actual metadata
- Comparison against known expected outputs
- Cross-format support (PNG, WebP)
- Multi-format detection and parsing

## Running Integration Tests

```bash
npm test
```

## Sample-Based Testing

The sample-based tests:
1. Load sample images from `tests/samples/`
2. Load expected outputs from `tests/expected/`
3. Parse the sample images using MetadataService
4. Compare actual output against expected output
5. Report any differences

This approach enables independent testing without Eagle dependencies.
