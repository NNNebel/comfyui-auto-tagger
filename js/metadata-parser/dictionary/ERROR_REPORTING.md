# Error Reporting Guide

This guide explains how to report metadata extraction errors and what information to include.

## When to Report an Error

Report an error when:

1. **Metadata extraction fails**: No metadata is extracted from a valid ComfyUI/A1111 image
2. **Incorrect values**: Extracted values don't match the workflow
3. **Missing fields**: Some metadata fields are missing
4. **Plugin crashes**: The plugin stops working or shows errors

## How to Report

### Automatic Error Reporting

When metadata extraction encounters issues, the plugin may show a warning dialog with an "Report Error" button.

**Steps:**

1. Click the "Report Error" button
2. The error report is automatically copied to your clipboard
3. A GitHub issue page opens in your browser
4. Paste the clipboard content into the issue description
5. **IMPORTANT**: Attach the original image file to the issue
6. Add any additional context (what you expected, what happened, etc.)
7. Submit the issue

### Manual Error Reporting

If automatic reporting doesn't work or you want to report manually:

1. Go to: https://github.com/[repository]/issues/new
2. Choose "Bug Report" template
3. Fill in the required information (see below)
4. **IMPORTANT**: Attach the original image file
5. Submit the issue

## What to Include

### Required Information

1. **Image File**: The PNG/WebP file that failed to extract
   - **CRITICAL**: Without the image, we cannot reproduce the issue
   - Attach directly to the GitHub issue
   - If the image is private, create a minimal test case

2. **Expected Metadata**: What values should have been extracted
   - Seed, steps, CFG, sampler, scheduler, etc.
   - You can find these in ComfyUI's workflow JSON

3. **Actual Result**: What actually happened
   - "No metadata extracted"
   - "Wrong seed value: got 12345, expected 67890"
   - "Missing scheduler field"

4. **Plugin Version**: Check `manifest.json` for version number

### Optional but Helpful

1. **Workflow JSON**: The ComfyUI workflow JSON
   - Right-click in ComfyUI → "Save (API Format)"
   - Or extract from PNG using `scripts/inspect-comfyui-structure.js`

2. **Custom Nodes**: List any custom nodes used
   - Node name and version
   - Where to download the node

3. **Browser**: Which browser you're using (Chrome, Firefox, Edge)

4. **Eagle Version**: Your Eagle app version

5. **Console Errors**: Any errors in browser console
   - Open DevTools (F12)
   - Check Console tab for red errors
   - Copy and paste error messages

## Error Report Format

### Automatic Report Structure

The automatic error report includes:

```json
{
  "version": "1.3.4",
  "timestamp": "2026-03-04T10:30:00.000Z",
  "error": {
    "message": "Failed to extract metadata",
    "type": "ExtractionError"
  },
  "trace": [
    {
      "timestamp": "2026-03-04T10:30:00.100Z",
      "action": "visit_node",
      "nodeId": "5",
      "nodeType": "KSampler"
    },
    {
      "timestamp": "2026-03-04T10:30:00.150Z",
      "action": "exclude_node",
      "nodeId": "5",
      "reason": "latent_image_not_connected"
    }
  ],
  "excluded_nodes": [
    {
      "nodeId": "5",
      "nodeType": "KSampler",
      "reason": "latent_image_not_connected"
    }
  ],
  "workflow": {
    /* ComfyUI workflow JSON */
  }
}
```

### Manual Report Template

If reporting manually, use this template:

```markdown
## Description
[Brief description of the issue]

## Expected Behavior
- Seed: 12345
- Steps: 20
- CFG: 7.0
- Sampler: euler
- Scheduler: normal

## Actual Behavior
[What actually happened]

## Image
[Attach the PNG/WebP file here]

## Workflow JSON (if available)
```json
[Paste workflow JSON here]
```

## Custom Nodes Used
- NodeName v1.0.0 (https://github.com/...)

## Environment
- Plugin Version: 1.3.4
- Eagle Version: 4.0
- Browser: Chrome 120
- OS: Windows 11

## Additional Context
[Any other relevant information]
```

## Understanding the Trace Log

The trace log shows what the extraction system did:

### Common Actions

- `visit_node`: Visited a node during traversal
- `exclude_node`: Excluded a node (with reason)
- `dictionary_lookup`: Found node in dictionary
- `heuristic_search`: Used heuristic pattern matching
- `value_extracted`: Successfully extracted a value

### Exclusion Reasons

- `latent_image_not_connected`: Sampler has no latent_image input
- `node_muted`: Node is muted in workflow
- `node_bypassed`: Node is bypassed in workflow
- `inactive_branch`: Node is in an inactive router branch

### Example Trace

```json
[
  {
    "timestamp": "2026-03-04T10:30:00.100Z",
    "action": "visit_node",
    "nodeId": "10",
    "nodeType": "SamplerCustomAdvanced"
  },
  {
    "timestamp": "2026-03-04T10:30:00.120Z",
    "action": "dictionary_lookup",
    "nodeType": "SamplerCustomAdvanced",
    "found": true
  },
  {
    "timestamp": "2026-03-04T10:30:00.140Z",
    "action": "value_extracted",
    "field": "seed",
    "value": 12345,
    "source": "RandomNoise"
  }
]
```

This shows:
1. Found a `SamplerCustomAdvanced` node
2. Looked it up in the dictionary (found)
3. Extracted seed value 12345 from `RandomNoise` node

## Privacy Considerations

### Sensitive Images

If your image contains sensitive content:

1. **Create a minimal test case**: Recreate the issue with a simple workflow
2. **Use a blank image**: The metadata is in PNG chunks, not the image pixels
3. **Remove sensitive nodes**: Simplify the workflow to just the problematic part

### Workflow Privacy

If your workflow is proprietary:

1. **Simplify the workflow**: Remove unrelated nodes
2. **Rename nodes**: Change custom node names if needed
3. **Focus on the issue**: Only include the part that's failing

## Common Issues and Solutions

### Issue: "No metadata extracted"

**Possible causes:**
- Image is not from ComfyUI or A1111
- Metadata was stripped during editing
- Unsupported image format

**What to include:**
- The original image file
- How the image was created
- Any editing tools used

### Issue: "Wrong values extracted"

**Possible causes:**
- Custom nodes not in dictionary
- Complex workflow routing
- Multiple samplers in workflow

**What to include:**
- Expected vs actual values
- Workflow JSON
- List of custom nodes

### Issue: "Plugin crashes"

**Possible causes:**
- Malformed workflow JSON
- Browser compatibility issue
- Large workflow size

**What to include:**
- Browser console errors
- Image file size
- Workflow complexity (number of nodes)

## After Reporting

### What Happens Next

1. **Triage**: We'll review the issue and ask for clarification if needed
2. **Investigation**: We'll analyze the workflow and trace logs
3. **Fix or Dictionary Update**: We'll either fix a bug or add nodes to the dictionary
4. **Testing**: We'll test the fix with your image
5. **Release**: The fix will be included in the next release

### Timeline

- **Critical bugs**: Fixed in next patch release (days)
- **Missing custom nodes**: Added to dictionary in next minor release (weeks)
- **Feature requests**: Considered for future releases (months)

## Contributing

If you're comfortable with JavaScript:

1. **Add the node yourself**: See [Adding Custom Nodes Guide](./ADDING_CUSTOM_NODES.md)
2. **Submit a pull request**: Include the node definition and test
3. **Help others**: Answer questions in issues

## Getting Help

If you need help reporting an issue:

1. **Check existing issues**: Your issue may already be reported
2. **Ask in discussions**: Use GitHub Discussions for questions
3. **Join the community**: [Link to Discord/forum if available]

## See Also

- [Dictionary Format Documentation](./DICTIONARY_FORMAT.md)
- [Adding Custom Nodes Guide](./ADDING_CUSTOM_NODES.md)
- [GitHub Issues](https://github.com/[repository]/issues)
