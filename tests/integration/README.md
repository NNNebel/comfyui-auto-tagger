# Integration Tests

Integration tests verify that multiple components work together correctly. These tests catch issues that unit tests might miss, such as incorrect API usage or integration bugs.

## Test Files

### core-metadata-service.integration.test.js

**Purpose**: Prevents regression of the bug where `processMetadata` was called incorrectly, causing infinite loops or processing hangs.

**Bug History**: 
- In v1.3.2-pre development, `plugin.js` was calling `processMetadata(null, settings, t, buffer, mimeType)` after already extracting metadata with `MetadataService`
- This caused double parsing and processing hangs in Eagle
- The correct pattern is: `MetadataService.extractPreferredMetadata()` → `processMetadata(metadata, settings, t)`

**What it tests**:
1. **Correct usage pattern**: MetadataService → processMetadata with parsed metadata
2. **Performance**: Ensures processMetadata completes quickly (no infinite loops)
3. **Both modes**: Tests both direct metadata object and buffer+mimeType modes
4. **Regression prevention**: Documents the incorrect usage pattern to prevent future bugs

**When to run**:
- Before any release
- After modifying `core.js` or `plugin.js`
- After changes to MetadataService integration

### sample-images.integration.test.js

**Purpose**: Validates end-to-end metadata extraction from real sample images.

**What it tests**:
- Complete parsing pipeline: Binary extraction → Format detection → Parsing
- Real-world image formats (PNG, WebP)
- Multiple metadata formats (ComfyUI, A1111, Civitai)

### browser-compatibility.integration.test.js

**Purpose**: Prevents Node.js-specific code from being used in browser-compatible modules.

**Bug History**:
- In v1.3.2-pre development, metadata-parser modules used bare `require()` which doesn't work in browser (Eagle/Electron)
- Caused "MetadataParser has already been declared" and "MetadataService is not a constructor" errors
- Fixed by wrapping all modules in IIFE and exporting to window object

**What it tests**:
1. **No bare require()**: Detects `require()` calls without environment checks in metadata-parser modules
2. **No bare module.exports**: Detects `module.exports` without environment checks
3. **IIFE pattern validation**: Warns if modules don't follow IIFE + window export pattern
4. **Browser compatibility**: Ensures all metadata-parser code can run in browser

**Critical rules enforced**:
- Files in `js/metadata-parser/` MUST NOT use bare `require()` or `module.exports`
- Must use IIFE pattern with `window` exports for browser compatibility
- Can use conditional `require()` ONLY with environment checks: `if (typeof require !== 'undefined')`

**When to run**:
- Before any release
- After adding new files to `js/metadata-parser/`
- After modifying existing metadata-parser modules

## Adding New Integration Tests

When adding new integration tests, consider:

1. **What integration point are you testing?**
   - Component A → Component B interaction
   - End-to-end workflows
   - External API usage

2. **What bug are you preventing?**
   - Document the bug history in comments
   - Include both correct and incorrect usage examples

3. **Performance considerations**
   - Add timeout checks for operations that might hang
   - Test that operations complete in reasonable time

4. **Sample data**
   - Use real sample images when possible
   - Handle missing sample files gracefully (skip test with warning)

## Running Integration Tests

```bash
# Run all integration tests
npm test tests/integration/

# Run specific integration test
npm test tests/integration/core-metadata-service.integration.test.js

# Run with coverage
npm run test:coverage
```

## Best Practices

1. **Test real usage patterns**: Mirror how components are actually used in production code
2. **Document bugs**: Include comments explaining what bug the test prevents
3. **Performance checks**: Add timing assertions for operations that might hang
4. **Graceful degradation**: Handle missing sample files or dependencies
5. **Clear test names**: Use descriptive names that explain what is being tested
