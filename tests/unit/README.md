# Unit Tests

This directory contains unit tests for individual components of the metadata parser.

## Test Files

- `format-detector.test.js` - Tests for FormatDetector class
- `comfyui-parser.test.js` - Tests for ComfyUIParser class
- `a1111-parser.test.js` - Tests for A1111Parser class
- `parser-registry.test.js` - Tests for ParserRegistry class
- `metadata-service.test.js` - Tests for MetadataService class
- `image-metadata-reader.test.js` - Tests for ImageMetadataReader class

## Purpose

Unit tests focus on:
- Specific examples with known inputs and outputs
- Edge cases (empty metadata, malformed data, missing fields)
- Integration points (parser registration, format detection)
- Error conditions (file read failures, parse errors, invalid formats)

## Running Unit Tests

```bash
npm run test:unit
```
