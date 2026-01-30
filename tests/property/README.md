# Property-Based Tests

This directory contains property-based tests using fast-check to verify universal properties across randomized inputs.

## Test Files

- `format-detection.property.test.js` - Property tests for format detection
- `parser-error-handling.property.test.js` - Property tests for error isolation
- `field-extraction.property.test.js` - Property tests for field extraction
- `backward-compatibility.property.test.js` - Property tests for backward compatibility

## Properties Tested

1. **Format Detection Accuracy** - ComfyUI and A1111 formats are correctly detected
2. **Multiple Format Detection** - Multiple formats in one image are all detected
3. **Cross-Format Support** - Metadata extraction works across PNG and WebP formats
4. **Parser Delegation** - Registry correctly delegates to registered parsers
5. **Error Isolation** - Parser errors don't crash the system
6. **ComfyUI Field Extraction** - All ComfyUI fields are correctly extracted
7. **Base Sampler Selection** - Base sampler is correctly identified
8. **Prompt Merging** - Multiple prompts are correctly merged
9. **A1111 Field Extraction** - All A1111 fields are correctly extracted
10. **Backward Compatibility** - New implementation matches old implementation
11. **Settings Preservation** - User settings are correctly applied
12. **Multi-Format Fallback** - System falls back when one parser fails

## Running Property Tests

```bash
npm run test:property
```

## Configuration

- Minimum 100 iterations per property test
- Tests tagged with feature name and property number
