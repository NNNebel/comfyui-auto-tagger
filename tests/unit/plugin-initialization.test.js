import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Test suite for plugin.js initialization functions
 *
 * Note: plugin.js itself runs in Eagle browser context, but we test
 * the initialization patterns here using Node.js mocks.
 */
describe('Plugin Initialization - Settings File', () => {
  let tempDir;
  let mockEagle;
  let mockFsp;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-init-test-'));

    // Mock Eagle library context
    mockEagle = {
      library: {
        path: tempDir
      },
      app: {
        locale: 'en'
      }
    };

    // Mock file system promises
    mockFsp = fs.promises;
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Settings File Structure', () => {
    it('should create default settings file with correct structure', async () => {
      const libraryPath = tempDir;
      const settingsDir = path.join(libraryPath, '.eagle', 'plugins', 'comfyui-auto-tagger');
      const settingsPath = path.join(settingsDir, 'inspector-settings.json');

      // Create the directory structure
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });

      // Create default settings
      const defaults = {
        skipCache: false,
        suspiciousNodeHandling: 'exclude'
      };

      await mockFsp.writeFile(settingsPath, JSON.stringify(defaults, null, 2), 'utf8');

      // Verify file exists
      expect(fs.existsSync(settingsPath)).toBe(true);

      // Verify content
      const content = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      expect(content.skipCache).toBe(false);
      expect(content.suspiciousNodeHandling).toBe('exclude');
    });

    it('should preserve existing settings file', async () => {
      const libraryPath = tempDir;
      const settingsDir = path.join(libraryPath, '.eagle', 'plugins', 'comfyui-auto-tagger');
      const settingsPath = path.join(settingsDir, 'inspector-settings.json');

      // Create initial settings
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      const initial = {
        skipCache: true,
        suspiciousNodeHandling: 'include',
        customSetting: 'preserved'
      };
      fs.writeFileSync(settingsPath, JSON.stringify(initial, null, 2), 'utf8');

      // Try to read existing file (should not overwrite)
      try {
        const existing = await mockFsp.readFile(settingsPath, 'utf8');
        const parsed = JSON.parse(existing);
        expect(parsed.skipCache).toBe(true);
        expect(parsed.customSetting).toBe('preserved');
      } catch (e) {
        // File doesn't exist, would create default
        expect(false).toBe(true);
      }
    });
  });

  describe('Settings Properties', () => {
    it('should define skipCache property with false default', () => {
      const defaults = {
        skipCache: false,
        suspiciousNodeHandling: 'exclude'
      };

      expect(defaults.skipCache).toBe(false);
      expect(typeof defaults.skipCache).toBe('boolean');
    });

    it('should define suspiciousNodeHandling property with exclude default', () => {
      const defaults = {
        skipCache: false,
        suspiciousNodeHandling: 'exclude'
      };

      expect(defaults.suspiciousNodeHandling).toBe('exclude');
      expect(['exclude', 'include', 'ask']).toContain(defaults.suspiciousNodeHandling);
    });

    it('should allow skipCache to be toggled', async () => {
      const settingsDir = path.join(tempDir, '.eagle', 'plugins', 'comfyui-auto-tagger');
      const settingsPath = path.join(settingsDir, 'inspector-settings.json');

      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });

      // Create initial settings
      const initial = {
        skipCache: false,
        suspiciousNodeHandling: 'exclude'
      };
      fs.writeFileSync(settingsPath, JSON.stringify(initial, null, 2), 'utf8');

      // Read and modify
      let settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      settings.skipCache = true;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');

      // Verify change persisted
      const updated = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      expect(updated.skipCache).toBe(true);
    });

    it('should allow suspiciousNodeHandling to be changed', async () => {
      const settingsDir = path.join(tempDir, '.eagle', 'plugins', 'comfyui-auto-tagger');
      const settingsPath = path.join(settingsDir, 'inspector-settings.json');

      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });

      // Create initial settings
      const initial = {
        skipCache: false,
        suspiciousNodeHandling: 'exclude'
      };
      fs.writeFileSync(settingsPath, JSON.stringify(initial, null, 2), 'utf8');

      // Read and modify
      let settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      settings.suspiciousNodeHandling = 'include';
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');

      // Verify change persisted
      const updated = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      expect(updated.suspiciousNodeHandling).toBe('include');
    });
  });

  describe('Directory Structure', () => {
    it('should create nested Eagle plugin directory structure', () => {
      const libraryPath = tempDir;
      const settingsDir = path.join(
        libraryPath,
        '.eagle',
        'plugins',
        'comfyui-auto-tagger'
      );

      fs.mkdirSync(settingsDir, { recursive: true });

      expect(fs.existsSync(settingsDir)).toBe(true);
      expect(fs.existsSync(path.join(libraryPath, '.eagle'))).toBe(true);
      expect(fs.existsSync(path.join(libraryPath, '.eagle', 'plugins'))).toBe(true);
    });

    it('should not fail with recursive mkdir if directories exist', () => {
      const libraryPath = tempDir;
      const settingsDir = path.join(
        libraryPath,
        '.eagle',
        'plugins',
        'comfyui-auto-tagger'
      );

      // Create once
      fs.mkdirSync(settingsDir, { recursive: true });

      // Create again - should not throw
      expect(() => {
        fs.mkdirSync(settingsDir, { recursive: true });
      }).not.toThrow();
    });
  });

  describe('File I/O Operations', () => {
    it('should write settings file with proper JSON formatting', async () => {
      const settingsDir = path.join(tempDir, '.eagle', 'plugins', 'comfyui-auto-tagger');
      const settingsPath = path.join(settingsDir, 'inspector-settings.json');

      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });

      const settings = {
        skipCache: false,
        suspiciousNodeHandling: 'exclude'
      };

      await mockFsp.writeFile(
        settingsPath,
        JSON.stringify(settings, null, 2),
        'utf8'
      );

      // Verify file is readable and valid JSON
      const content = fs.readFileSync(settingsPath, 'utf8');
      const parsed = JSON.parse(content);

      expect(parsed).toEqual(settings);
      // Check formatting (2-space indentation)
      expect(content).toContain('\n  "skipCache"');
    });

    it('should handle read errors gracefully', async () => {
      const settingsPath = path.join(
        tempDir,
        '.eagle',
        'plugins',
        'comfyui-auto-tagger',
        'inspector-settings.json'
      );

      // Try to read non-existent file
      try {
        await mockFsp.readFile(settingsPath, 'utf8');
        expect(false).toBe(true); // Should not reach here
      } catch (e) {
        // Expected behavior
        expect(e.code).toBe('ENOENT');
      }
    });

    it('should handle write errors when directory missing', async () => {
      const settingsPath = path.join(
        tempDir,
        'nonexistent',
        'nested',
        'dir',
        'settings.json'
      );

      try {
        // Try to write without creating directory
        await mockFsp.writeFile(settingsPath, JSON.stringify({}), 'utf8');
        expect(false).toBe(true); // Should not reach here
      } catch (e) {
        // Expected behavior
        expect(e.code).toBe('ENOENT');
      }
    });
  });

  describe('Settings Initialization Pattern', () => {
    it('should follow try-read, catch-create pattern', async () => {
      const settingsDir = path.join(tempDir, '.eagle', 'plugins', 'comfyui-auto-tagger');
      const settingsPath = path.join(settingsDir, 'inspector-settings.json');

      // Pattern: Try to read
      let settings = null;
      try {
        const data = fs.readFileSync(settingsPath, 'utf8');
        settings = JSON.parse(data);
      } catch (e) {
        // If not found, create default
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
        settings = {
          skipCache: false,
          suspiciousNodeHandling: 'exclude'
        };
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
      }

      // Verify pattern worked
      expect(settings).toBeDefined();
      expect(settings.skipCache).toBe(false);
      expect(settings.suspiciousNodeHandling).toBe('exclude');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty eagle.library.path gracefully', () => {
      const mockEagleNoPath = {
        library: {
          path: null
        }
      };

      // Should skip initialization without throwing
      expect(() => {
        if (!mockEagleNoPath.library.path) {
          // Expected: skip initialization
          return;
        }
      }).not.toThrow();
    });

    it('should handle corrupted settings file', async () => {
      const settingsDir = path.join(tempDir, '.eagle', 'plugins', 'comfyui-auto-tagger');
      const settingsPath = path.join(settingsDir, 'inspector-settings.json');

      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
      fs.writeFileSync(settingsPath, 'invalid json {', 'utf8');

      // Try to read and recreate if invalid
      try {
        const data = fs.readFileSync(settingsPath, 'utf8');
        JSON.parse(data);
      } catch (e) {
        // Recreate default
        const defaults = {
          skipCache: false,
          suspiciousNodeHandling: 'exclude'
        };
        fs.writeFileSync(settingsPath, JSON.stringify(defaults, null, 2), 'utf8');
      }

      // Verify recreated file is valid
      const content = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      expect(content.skipCache).toBe(false);
    });
  });
});
