# Metadata Parser Module

This directory contains the refactored metadata parser implementation with a layered architecture:

## Structure

- **binary-extraction/**: Binary extraction layer for reading raw metadata from image files
  - `ImageMetadataReader.js`: Extracts raw metadata chunks from PNG and WebP files
  - `FormatDetector.js`: Identifies which metadata formats are present

- **parsers/**: Parser layer for format-specific metadata interpretation
  - `MetadataParser.js`: Base class defining the parser interface
  - `ParserRegistry.js`: Manages parser registration and delegation
  - `ComfyUIParser.js`: ComfyUI-specific metadata parser
  - `A1111Parser.js`: Automatic1111-specific metadata parser

- **integration/**: Integration layer for orchestrating the parsing pipeline
  - `MetadataService.js`: Main service that orchestrates parsing and provides API

## Architecture

The refactored parser follows a three-layer architecture:

1. **Binary Extraction Layer**: Reads raw metadata without interpretation
2. **Parser Layer**: Interprets format-specific metadata structures
3. **Integration Layer**: Orchestrates parsing and provides clean API

This separation enables:
- Independent testing without Eagle dependencies
- Easy addition of new metadata formats
- Clear separation of concerns
- Better maintainability
