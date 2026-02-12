# Metadata Parser Architecture

This document describes the architecture of the metadata parser system after the code quality refactoring.

## Overview

The metadata parser system is organized into four main layers:

1. **Binary Extraction Layer** - Low-level binary parsing of image formats
2. **Parsing Layer** - Format-specific metadata interpretation
3. **Integration Layer** - High-level service coordination
4. **Processing Layer** - Tag and annotation generation

## Layer Details

### 1. Binary Extraction Layer

**Location**: `js/metadata-parser/binary-extraction/`

**Purpose**: Extract raw metadata chunks from image files without interpretation.

**Components**:
- `ImageMetadataReader.js` - Extracts raw chunks from PNG and WebP images
- `FormatDetector.js` - Detects which metadata formats are present

**Key Features**:
- Format-agnostic binary parsing
- Supports PNG tEXt chunks and WebP EXIF/XMP
- Returns raw data for higher layers to interpret

**Example**:
```javascript
const rawChunks = ImageMetadataReader.extractRawMetadata(buffer, 'image/png');
// Returns: { workflow: {...}, prompt: {...}, parameters: "..." }
```

### 2. Parsing Layer

**Location**: `js/metadata-parser/parsers/`

**Purpose**: Interpret format-specific metadata and convert to standardized structure.

**Components**:
- `MetadataParser.js` - Base class for all parsers
- `ComfyUIParser.js` - Parses ComfyUI workflow and prompt data using graph-based analysis
- `A1111Parser.js` - Parses Automatic1111 parameters using extensible handler system
- `ParserRegistry.js` - Manages parser registration and delegation

**Key Features**:
- Extensible parser system
- Each parser handles one format
- Standardized output structure
- Automatic parser selection based on detected formats

**ComfyUI Parser Architecture**:
- Uses `ComfyUIGraph` class for explicit graph data structure
- Employs `ComfyUISamplerAnalyzer` for intelligent base sampler selection
- Supports complex workflows with multiple samplers and refinement stages
- Handles advanced samplers (SamplerCustomAdvanced) and Flux models (UNETLoader)

**A1111 Parser Architecture**:
- Uses `ParameterParser` with extensible handler system
- Handlers: `StandardParameterHandler`, `LoraHashHandler`, `ADetailerHandler`
- Supports extensions: Hires, TI, NGMS parameters
- Eliminates ad-hoc string parsing with structured approach

**Example**:
```javascript
const parser = new ComfyUIParser();
const metadata = parser.parse(rawChunks);
// Returns: { format: 'comfyui', checkpoint: '...', loras: [...], generationSteps: [...] }
```

### 3. Integration Layer

**Location**: `js/metadata-parser/integration/`

**Purpose**: Orchestrate the complete parsing pipeline.

**Components**:
- `MetadataService.js` - Main service that coordinates all layers

**Key Features**:
- Single entry point for metadata extraction
- Handles multiple formats in one image
- Supports format preference (e.g., prefer ComfyUI over A1111)

**Example**:
```javascript
const service = new MetadataService();
const results = service.extractMetadata(buffer, 'image/png');
// Returns: [{ format: 'comfyui', ... }, { format: 'a1111', ... }]
```

### 4. Processing Layer

**Location**: `js/metadata-processor/`

**Purpose**: Convert parsed metadata to Eagle-specific formats (tags and annotations).

**Components**:
- `TagGenerator.js` - Generates Eagle tags from metadata
- `AnnotationBuilder.js` - Builds annotation text from metadata
- `MetadataProcessor.js` - Orchestrates tag and annotation generation

**Key Features**:
- Settings-based filtering
- Handles both new (generationSteps) and old (extra_samplers) formats
- Maintains backward compatibility

**Example**:
```javascript
const result = MetadataProcessor.process(metadata, settings, t);
// Returns: { tags: Set, cats: Object, annotation: string, ... }
```

## Utility Modules

**Location**: `js/metadata-parser/utils/`

**Purpose**: Provide reusable functionality across all layers.

**Components**:
- `ParsingUtils.js` - JSON parsing, string manipulation, filename extraction
- `BinaryUtils.js` - Binary operations (FourCC, uint32, CRC32, slicing)
- `ErrorHandler.js` - Centralized error handling with severity levels and error aggregation
- `Validators.js` - Input validation for all data types

**Key Features**:
- Eliminate code duplication
- Standardize error handling with structured logging
- Provide consistent validation
- Browser-compatible (IIFE pattern)

**Error Handling**:
- Severity levels: DEBUG, INFO, WARN, ERROR
- Structured logging with context and timestamps
- Error aggregation for batch operations
- Specific error types: `ParseError`, `GraphConstructionError`, `SamplerNotFoundError`, `ParameterParseError`, `TokenizationError`

## Supporting Modules

**Location**: `js/metadata-parser/graph/`, `js/metadata-parser/parameters/`, `js/metadata-parser/prompt/`, `js/metadata-parser/errors/`

**Graph Analysis** (`graph/`):
- `ComfyUIGraph.js` - Explicit graph data structure with traversal algorithms
- `ComfyUISamplerAnalyzer.js` - Intelligent base sampler selection and metadata extraction

**Parameter Handling** (`parameters/`):
- `ParameterHandler.js` - Base class for parameter handlers
- `StandardParameterHandler.js` - Standard A1111 parameters
- `LoraHashHandler.js` - LoRA hash parsing
- `ADetailerHandler.js` - ADetailer extension parameters
- `ParameterParser.js` - Orchestrates handler-based parsing

**Prompt Tokenization** (`prompt/`):
- `PromptToken.js` - Token data structure (text, weighted, lora, hypernet, embedding)
- `PromptTokenizer.js` - Structured prompt parsing with reconstruction capability

**Error Types** (`errors/`):
- `ParseError.js` - Base error class with context and suggestions
- Specific error types for different failure scenarios

## Data Flow

```
Image Buffer (PNG/WebP)
    ↓
[Binary Extraction Layer]
ImageMetadataReader → Raw Chunks { workflow, prompt, parameters }
    ↓
FormatDetector → Detected Formats ['comfyui', 'a1111']
    ↓
[Parsing Layer]
ParserRegistry → Select Parsers
    ↓
ComfyUIParser / A1111Parser → Parsed Metadata
    ↓
[Integration Layer]
MetadataService → Unified Results
    ↓
[Processing Layer]
TagGenerator → Tags
AnnotationBuilder → Annotation
    ↓
MetadataProcessor → Final Output { tags, annotation, ... }
```

## Adding a New Parser

To add support for a new metadata format:

1. **Create Parser Class** in `js/metadata-parser/parsers/`
   ```javascript
   class MyFormatParser extends MetadataParser {
     getFormatName() {
       return 'myformat';
     }
     
     canParse(rawChunks) {
       return rawChunks.myFormatKey !== undefined;
     }
     
     parse(rawChunks) {
       // Parse and return standardized metadata
       return {
         format: 'myformat',
         checkpoint: '...',
         // ... other fields
       };
     }
   }
   ```

2. **Register Parser** in `MetadataService.initializeParsers()`
   ```javascript
   this.registry.register(new MyFormatParser());
   ```

3. **Add Unit Tests** in `tests/unit/MyFormatParser.test.js`

4. **Update FormatDetector** if needed to detect the new format

## Error Handling Strategy

All layers use `ErrorHandler.safeExecute()` to:
- Catch and log errors without crashing
- Return safe fallback values
- Provide context for debugging
- Maintain system stability

Example:
```javascript
return ErrorHandler.safeExecute(
  () => {
    // Risky operation
    return parseComplexData(input);
  },
  {}, // Fallback value
  'ComponentName',
  { context: 'additional info' }
);
```

## Validation Strategy

All inputs are validated using `Validators`:
- `validateBuffer()` - Ensure valid Uint8Array
- `validateMimeType()` - Check supported image types
- `validateRawChunks()` - Verify chunk structure
- `validateParsedMetadata()` - Check metadata format
- `validateSettings()` - Validate user settings

## Browser Compatibility

All modules in `js/metadata-parser/` use IIFE pattern for browser compatibility:

```javascript
(function(global) {
  'use strict';
  
  // Module code
  class MyModule {
    // ...
  }
  
  // Export for browser
  if (typeof window !== 'undefined') {
    window.MyModule = MyModule;
  }
  
  // Export for Node.js (testing)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MyModule;
  }
})(typeof window !== 'undefined' ? window : global);
```

## Testing Strategy

- **Unit Tests**: Test individual components in isolation (730 tests)
- **Integration Tests**: Test layer interactions
- **Property Tests**: Test invariants and edge cases with random data
- **Sample Tests**: Test with real image files
- **Performance Tests**: Benchmark parsing speed and memory usage

**Test Coverage**: 80.93% overall
- All new classes have comprehensive unit tests
- Property-based tests for graph algorithms and parameter parsing
- Performance benchmarks show all operations < 1ms

**Key Test Files**:
- `tests/unit/ComfyUIGraph.test.js` - Graph construction and traversal (44 tests)
- `tests/unit/ComfyUISamplerAnalyzer.test.js` - Sampler selection algorithm (19 tests)
- `tests/unit/ParameterParser.test.js` - Parameter parsing (25 tests)
- `tests/unit/PromptTokenizer.test.js` - Prompt tokenization (33 tests)
- `tests/unit/ParseError.test.js` - Error types (16 tests)
- `tests/unit/ErrorHandler.test.js` - Error handling (34 tests)

## Performance Considerations

- Binary operations use `DataView` for efficient buffer access
- Parsers process data in single pass where possible
- Graph-based ComfyUI parsing: < 0.25ms for workflows up to 55 nodes
- A1111 parameter parsing: < 0.032ms for typical parameters
- Prompt tokenization: < 0.057ms for complex prompts
- Memory usage is stable across all operations
- Error handling has minimal overhead

**Profiling Results**:
- A1111 parsing: 0.022-0.032ms
- ComfyUI parsing: 0.048-0.219ms (55 nodes)
- All operations well under 100ms requirement with significant margin

## Backward Compatibility

The refactoring maintains 100% backward compatibility:
- `core.js` exports unchanged function signatures
- Existing tests pass without modification
- Plugin behavior remains identical
- No breaking changes to public APIs

## Future Enhancements

Potential areas for improvement:
- Add support for more metadata formats (Invoke AI, NovelAI, etc.)
- Implement caching for repeated parsing
- Add metadata validation against schemas
- Support for video file metadata
- Streaming parser for large files
