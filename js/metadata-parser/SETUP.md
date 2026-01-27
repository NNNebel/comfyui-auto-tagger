# Metadata Parser Setup

This document describes the project structure setup for the metadata parser refactoring.

## Directory Structure Created

### Source Code Structure

```
js/metadata-parser/
├── README.md                    # Overview of the metadata parser module
├── binary-extraction/           # Binary extraction layer
│   └── .gitkeep
├── parsers/                     # Parser layer
│   └── .gitkeep
└── integration/                 # Integration layer
    └── .gitkeep
```

### Test Structure

```
tests/
├── unit/                        # Unit tests for individual components
│   └── README.md
├── property/                    # Property-based tests using fast-check
│   └── README.md
├── integration/                 # Integration tests
│   └── README.md
├── samples/                     # Sample images for testing
│   └── README.md
└── expected/                    # Expected outputs for sample images
    └── README.md
```

## Dependencies Added

- **fast-check** (v3.23.2): Property-based testing library for JavaScript
  - Used to verify universal properties across randomized inputs
  - Minimum 100 iterations per property test

## NPM Scripts Added

- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:property` - Run only property-based tests
- `npm run test:unit` - Run only unit tests (excluding property tests)

## Next Steps

The following tasks will populate these directories:

1. **Binary Extraction Layer** (Task 2)
   - ImageMetadataReader.js
   - FormatDetector.js

2. **Parser Layer** (Tasks 3-5)
   - MetadataParser.js (base class)
   - ParserRegistry.js
   - ComfyUIParser.js
   - A1111Parser.js

3. **Integration Layer** (Task 7)
   - MetadataService.js

4. **Test Files** (Tasks 2-9)
   - Unit tests for each component
   - Property-based tests for universal properties
   - Sample images and expected outputs
   - Integration tests

## Architecture Overview

The refactored parser follows a three-layer architecture:

1. **Binary Extraction Layer**: Reads raw metadata from image files (PNG, WebP) without interpretation
2. **Parser Layer**: Interprets format-specific metadata structures (ComfyUI, A1111, etc.)
3. **Integration Layer**: Orchestrates the parsing pipeline and provides a clean API

This separation enables:
- Independent testing without Eagle dependencies
- Easy addition of new metadata formats
- Clear separation of concerns
- Better maintainability
