# Test Sample Images

> [!IMPORTANT]
> **Sample images are NOT included in the repository.**
> 
> Developers must provide their own test images with ComfyUI/A1111 metadata for testing.

## Why aren't sample images included?

1. **File Size**: Image files would bloat the repository
2. **Copyright**: Sample images may contain copyrighted content
3. **Privacy**: Generated images may contain sensitive prompts or settings
4. **Flexibility**: Developers can test with their own workflows and custom nodes

## How to Add Test Samples

To test the metadata parser with your own images:

1. **Generate test images** using ComfyUI or Automatic1111
2. **Place images in this directory**:
   - `comfyui_simple.png` - Simple ComfyUI workflow
   - `comfyui_multi.png` - Complex multi-sampler workflow
   - `comfyui_simple.webp` - WebP format
   - `a1111_simple.png` - Automatic1111 image
   
3. **Generate expected output** (optional):
   ```bash
   node scripts/analyze-image.js tests/samples/your_image.png > tests/expected/sample/your_image.json
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

## Recommended Test Cases

For comprehensive testing, include images with:
- ✅ Simple single-sampler workflows
- ✅ Multi-sampler workflows (HiresFix, FaceDetailer)
- ✅ img2img workflows with VAEEncode
- ✅ Custom nodes and complex connections
- ✅ Both PNG and WebP formats
- ✅ A1111 format for compatibility testing

## File Naming Convention

Use descriptive names that indicate the test scenario:
- `comfyui_simple.png` - Basic ComfyUI workflow
- `comfyui_multi.png` - Multiple samplers
- `comfyui_i2i.webp` - Image-to-image workflow
- `a1111_simple.png` - Automatic1111 format

## Note

Sample images are automatically ignored by git (see `.gitignore`). This ensures:
- Clean repository without binary files
- No accidental commits of large images
- Each developer maintains their own test set
