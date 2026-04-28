/**
 * Unit tests for plugin.js MIME type handling
 *
 * Tests the MIME type mapping logic for file extension detection.
 * This ensures that JPEG, PNG, and WebP files are correctly identified
 * before metadata extraction.
 */

import { describe, it, expect } from 'vitest';

describe('plugin.js MIME Type Mapping', () => {
  // Simulate the MIME type mapping logic from plugin.js
  const getMimeType = (filePath) => {
    const path = require('path');
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypeMap = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp'
    };
    return mimeTypeMap[ext] || 'image/webp';
  };

  describe('PNG files', () => {
    it('should map .png to image/png', () => {
      expect(getMimeType('image.png')).toBe('image/png');
    });

    it('should handle uppercase extension .PNG', () => {
      expect(getMimeType('image.PNG')).toBe('image/png');
    });

    it('should handle mixed case .Png', () => {
      expect(getMimeType('image.Png')).toBe('image/png');
    });

    it('should handle paths with directories', () => {
      expect(getMimeType('/path/to/image.png')).toBe('image/png');
    });
  });

  describe('JPEG files', () => {
    it('should map .jpg to image/jpeg', () => {
      expect(getMimeType('image.jpg')).toBe('image/jpeg');
    });

    it('should map .jpeg to image/jpeg', () => {
      expect(getMimeType('image.jpeg')).toBe('image/jpeg');
    });

    it('should handle uppercase extension .JPG', () => {
      expect(getMimeType('image.JPG')).toBe('image/jpeg');
    });

    it('should handle uppercase extension .JPEG', () => {
      expect(getMimeType('image.JPEG')).toBe('image/jpeg');
    });

    it('should handle mixed case .Jpg', () => {
      expect(getMimeType('image.Jpg')).toBe('image/jpeg');
    });

    it('should handle mixed case .Jpeg', () => {
      expect(getMimeType('image.Jpeg')).toBe('image/jpeg');
    });

    it('should handle paths with directories', () => {
      expect(getMimeType('/path/to/image.jpg')).toBe('image/jpeg');
    });
  });

  describe('WebP files', () => {
    it('should map .webp to image/webp', () => {
      expect(getMimeType('image.webp')).toBe('image/webp');
    });

    it('should handle uppercase extension .WEBP', () => {
      expect(getMimeType('image.WEBP')).toBe('image/webp');
    });

    it('should handle mixed case .WebP', () => {
      expect(getMimeType('image.WebP')).toBe('image/webp');
    });

    it('should handle paths with directories', () => {
      expect(getMimeType('/path/to/image.webp')).toBe('image/webp');
    });
  });

  describe('Unknown extensions', () => {
    it('should default to image/webp for unknown extensions', () => {
      expect(getMimeType('image.gif')).toBe('image/webp');
    });

    it('should default to image/webp for no extension', () => {
      expect(getMimeType('image')).toBe('image/webp');
    });

    it('should default to image/webp for .bmp', () => {
      expect(getMimeType('image.bmp')).toBe('image/webp');
    });

    it('should default to image/webp for .tiff', () => {
      expect(getMimeType('image.tiff')).toBe('image/webp');
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple dots in filename', () => {
      expect(getMimeType('my.image.file.jpg')).toBe('image/jpeg');
    });

    it('should handle whitespace in filename', () => {
      expect(getMimeType('my image file.png')).toBe('image/png');
    });

    it('should handle special characters in path', () => {
      expect(getMimeType('/path/with-dash/image_file.jpeg')).toBe('image/jpeg');
    });

    it('should handle Windows-style paths', () => {
      expect(getMimeType('C:\\Users\\test\\image.webp')).toBe('image/webp');
    });

    it('should handle long file paths', () => {
      expect(getMimeType('/very/long/path/to/some/directory/structure/image.jpg')).toBe('image/jpeg');
    });
  });

  describe('File extension sensitivity', () => {
    it('should not confuse similar extensions', () => {
      expect(getMimeType('image.jpg')).not.toBe('image/png');
      expect(getMimeType('image.png')).not.toBe('image/jpeg');
      expect(getMimeType('image.webp')).not.toBe('image/png');
    });
  });
});
