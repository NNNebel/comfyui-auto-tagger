# Metadata Parser Architecture Refactoring

## Problem Statement

Currently, `ImageMetadataReader` mixes two responsibilities:
1. **Binary extraction**: Reading PNG/WebP/JPEG chunks/segments
2. **JSON parsing**: Attempting to parse all tEXt/comf/EXIF chunks as JSON

This causes:
- A1111 "parameters" field (text format) triggers JSON parse errors
- `FormatDetector` depends on upstream JSON parsing (checking `typeof rawChunks.workflow === 'object'`)
- Adding new metadata formats (video, SaaS APIs) requires modifying `ImageMetadataReader` internals
- Responsibility boundaries are unclear

## Solution: Phased Responsibility Separation

### Architecture Goal

```
Layer 1: ContainerReader (extract only raw strings)
  - No JSON parsing
  - Output: { keyword: rawString }

Layer 2: FormatParser (each parser is self-contained)
  - canParse(rawChunks): boolean
  - Handles own JSON parsing needs
  - ComfyUIParser: JSON.parse workflow/prompt
  - A1111Parser: text-only parameters

Layer 3: ParserRegistry / FormatDetector (aggregation)
  - Ask each parser "is this your format?"
  - No direct format detection logic
```

### Implementation Plan

#### Phase 1: Immediate Fix (eliminate A1111 noise) ✅ TARGET
- **Goal**: Restore test pass rate to original ~10 failures
- **Changes**:
  - Remove `console.error` from `ParsingUtils.parseJsonSafely()`
  - Keep all functionality identical to current code
- **Impact**: A1111 JSON parse errors become silent (correct fallback behavior)
- **Effort**: Minimal (1 file)
- **PR Size**: Trivial

#### Phase 2: Responsibility Separation (decouple layers)
- **Goal**: Make each parser self-contained, enable future format additions without touching `ImageMetadataReader`
- **Changes**:
  1. `ImageMetadataReader` → return raw strings only (no JSON.parse)
  2. `ComfyUIParser.parse()` → add JSON.parse logic for workflow/prompt
  3. `A1111Parser.parse()` → handle text parameters as-is
  4. `FormatDetector` → implement `_isComfyUIMetadata()` by checking string content ('{' prefix)
- **Impact**: 
  - Full decoupling of binary extraction and format parsing
  - New formats (VideoParser, MidjourneyParser, etc.) add without modifying readers
  - A1111 and ComfyUI handled independently
- **Effort**: Medium (affects multiple parsers)
- **Tests affected**: Will need updates to match new behavior
- **PR Size**: ~200-300 lines changes

#### Phase 3: Container Abstraction (future, after Phase 2 stable)
- **Goal**: Support video metadata, API responses, etc.
- **Changes**:
  - Define `ContainerReader` interface
  - Implement `PngContainerReader`, `WebpContainerReader`, etc.
  - Create `Mp4ContainerReader`, `JsonContainerReader` for future formats
- **Impact**: Single parser interface works across all media types
- **Effort**: Large (architecture change)
- **Prerequisite**: Phase 2 must be complete and stable

## Success Criteria

- **Phase 1**: All tests pass, A1111 error messages gone
- **Phase 2**: 
  - All tests pass
  - A1111Parser and ComfyUIParser are independent
  - Adding new format requires no changes to ImageMetadataReader
- **Phase 3**: 
  - Video metadata extraction works
  - Single parser implementation reusable across formats

## Test Status Tracking

### Before Changes
- Test Files: 7 failed | 155 passed
- Tests: 10 failed | 3573 passed
- Issue: A1111 JSON parse errors in console

### Phase 1 Completion Target
- Test Files: 7 failed | 155 passed (same as before, but no A1111 errors)
- Tests: 10 failed | 3573 passed

### Phase 2 Completion Target
- Test Files: 0 failed | 162 passed
- Tests: 0 failed | 3629 passed (all tests, no skips to failures)

## Notes

- Each phase delivers independently: Phase 1 is complete and useful on its own
- Phase 2 requires coordination across multiple parsers but improves long-term maintainability
- Phase 3 only needed when video/new formats actually required
