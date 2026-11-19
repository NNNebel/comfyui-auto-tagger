import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const stagePlugin = require('../../scripts/stage-plugin');

describe('release runtime package', () => {
  it('includes manifest entry points, HTML dependencies and runtime data', () => {
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-package-'));
    try {
      stagePlugin(destination);
      const manifest = JSON.parse(fs.readFileSync(path.join(destination, 'manifest.json'), 'utf8'));
      const pages = [manifest.main.url, ...Object.values(manifest.preview).map(value => value.inspector.path)];
      for (const page of pages) {
        const html = fs.readFileSync(path.join(destination, page), 'utf8');
        for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
          if (/^(?:[a-z]+:|\/\/|#)/i.test(match[1])) continue;
          expect(fs.existsSync(path.resolve(destination, path.dirname(page), match[1])), match[1]).toBe(true);
        }
      }
      for (const entry of [manifest.logo, 'LICENSE', 'js/metadata-parser/dictionary/default-dictionary.json',
        ...manifest.languages.map(language => `_locales/${language}.json`)]) {
        expect(fs.existsSync(path.join(destination, entry)), entry).toBe(true);
      }
      for (const entry of ['tests', 'node_modules', '.git', 'RELEASE_NOTES.md']) {
        expect(fs.existsSync(path.join(destination, entry)), entry).toBe(false);
      }
    } finally {
      fs.rmSync(destination, { recursive: true, force: true });
    }
  });
});
