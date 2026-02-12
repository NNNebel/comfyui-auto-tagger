# ImageMetadataReader Test Coverage

## Overview
This document summarizes the test coverage for the ImageMetadataReader class, which is responsible for extracting raw metadata from PNG and WebP image files.

## Requirements Coverage

### Requirement 1.5: PNG Format Support ✓
**Tests:**
- `extractRawMetadata` - delegates to extractPngChunks for PNG images
- `extractPngChunks` - returns empty object for invalid PNG signature
- `extractPngChunks` - extracts tEXt chunks with text data
- `extractPngChunks` - parses JSON for workflow and prompt keywords
- Integration test - extracts same PNG data as getGenInfo
- Integration test - handles multiple PNG tEXt chunks like getGenInfo
- Integration test - handles invalid PNG like getGenInfo
- Integration test - handles corrupted PNG gracefully
- Integration test - handles malformed JSON in PNG tEXt chunk
- Real sample file test - extracts metadata from actual PNG file

### Requirement 1.6: WebP Format Support ✓
**Tests:**
- `extractRawMetadata` - delegates to extractWebpChunks for WebP images
- `extractWebpChunks` - returns empty object for invalid WebP signature
- `extractWebpChunks` - handles WebP with no EXIF/XMP chunks
- Integration test - extracts same WebP data as getGenInfo
- Integration test - handles corrupted WebP gracefully

## Test Categories

### Unit Tests (18 tests)

#### 1. extractRawMetadata (4 tests)
- ✓ Returns empty object for unsupported MIME type
- ✓ Handles errors gracefully and returns empty object
- ✓ Delegates to extractPngChunks for PNG images
- ✓ Delegates to extractWebpChunks for WebP images

#### 2. extractPngChunks (3 tests)
- ✓ Returns empty object for invalid PNG signature
- ✓ Extracts tEXt chunks with text data
- ✓ Parses JSON for workflow and prompt keywords

#### 3. extractWebpChunks (2 tests)
- ✓ Returns empty object for invalid WebP signature
- ✓ Handles WebP with no EXIF/XMP chunks

#### 4. _decodePngText (2 tests)
- ✓ Decodes PNG tEXt chunk correctly
- ✓ Handles missing null separator

#### 5. _getFourCC (1 test)
- ✓ Extracts four-character code correctly

#### 6. _parseJsonFromPos (5 tests)
- ✓ Parses JSON from buffer position
- ✓ Handles nested JSON objects
- ✓ Handles JSON with escaped characters
- ✓ Returns null for malformed JSON
- ✓ Returns null if closing brace not found

#### 7. Real sample file tests (1 test)
- ✓ Extracts metadata from real PNG sample if available

### Integration Tests (8 tests)

#### 1. Compatibility with existing getGenInfo (5 tests)
- ✓ Extracts same PNG data as getGenInfo
- ✓ Extracts same WebP data as getGenInfo
- ✓ Handles multiple PNG tEXt chunks like getGenInfo
- ✓ Handles invalid PNG like getGenInfo
- ✓ Handles unsupported format like getGenInfo

#### 2. Error handling (3 tests)
- ✓ Handles corrupted PNG gracefully
- ✓ Handles corrupted WebP gracefully
- ✓ Handles malformed JSON in PNG tEXt chunk

## Test Data

### Synthetic Test Data
Tests use programmatically generated PNG and WebP buffers with:
- Valid PNG signatures and tEXt chunks
- Valid WebP RIFF/WEBP signatures
- Various metadata formats (workflow JSON, prompt JSON, parameters text)
- Corrupted/truncated data for error handling
- Malformed JSON for edge case testing

### Real Sample Data
- `tests/fixtures/00151-76682904.png` - Real PNG file with A1111 parameters metadata

## Coverage Summary

| Component | Unit Tests | Integration Tests | Total |
|-----------|-----------|-------------------|-------|
| extractRawMetadata | 4 | 3 | 7 |
| extractPngChunks | 3 | 4 | 7 |
| extractWebpChunks | 2 | 2 | 4 |
| _decodePngText | 2 | 0 | 2 |
| _getFourCC | 1 | 0 | 1 |
| _parseJsonFromPos | 5 | 0 | 5 |
| Real file tests | 1 | 0 | 1 |
| **Total** | **18** | **8** | **26** |

## Test Execution

All tests pass successfully:
```
✓ tests/unit/ImageMetadataReader.test.js (18 tests)
✓ tests/unit/ImageMetadataReader.integration.test.js (8 tests)

Test Files  2 passed (2)
Tests  26 passed (26)
```

## Edge Cases Covered

1. **Invalid signatures** - Non-PNG/WebP data
2. **Corrupted files** - Truncated chunks, invalid lengths
3. **Malformed JSON** - Invalid JSON in metadata fields
4. **Missing data** - No metadata chunks present
5. **Multiple chunks** - Multiple tEXt chunks in single PNG
6. **Unsupported formats** - JPEG and other formats
7. **Empty buffers** - Minimal valid images with no metadata
8. **Real-world data** - Actual PNG file from samples directory

## Backward Compatibility

Integration tests verify that ImageMetadataReader produces identical output to the existing `getGenInfo` function from `core.js`, ensuring backward compatibility with the current implementation.
