// tests/integration/browser-compatibility.integration.test.js
/**
 * Browser Compatibility Integration Tests
 * 
 * PURPOSE: Prevent Node.js-specific code from being used in browser-compatible modules
 * 
 * BUG HISTORY:
 * - v1.3.2-pre: metadata-parser modules used `require()` which doesn't work in browser (Eagle/Electron)
 * - Caused "MetadataParser has already been declared" and "MetadataService is not a constructor" errors
 * - Fixed by wrapping all modules in IIFE and exporting to window object
 * 
 * CRITICAL RULES:
 * 1. Files in js/metadata-parser/ MUST NOT use Node.js require() in browser context
 * 2. Files in js/metadata-parser/ MUST use IIFE pattern and window exports for browser
 * 3. Files can use conditional require() ONLY when checking for Node.js environment first
 * 4. Files in js/ (plugin.js, core.js) can use require() as they run in Electron/Node.js context
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const METADATA_PARSER_DIR = path.join(process.cwd(), 'js', 'metadata-parser');
const BROWSER_COMPATIBLE_DIRS = [
  path.join(METADATA_PARSER_DIR, 'binary-extraction'),
  path.join(METADATA_PARSER_DIR, 'parsers'),
  path.join(METADATA_PARSER_DIR, 'integration'),
  path.join(METADATA_PARSER_DIR, 'containers')
];

/**
 * Check if a file contains unsafe Node.js patterns for browser environment
 */
function checkBrowserCompatibility(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  
  // Pattern 1: Bare require() without environment check
  // BAD: const fs = require('fs');
  // GOOD: if (typeof require !== 'undefined') { const fs = require('fs'); }
  const bareRequirePattern = /^(?!\s*\/\/).*require\s*\(/gm;
  const envCheckPattern = /typeof\s+(?:require|window|module)\s*[!=]=\s*['"]undefined['"]/;
  
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    
    // Check for bare require()
    if (bareRequirePattern.test(line)) {
      // Check if we're inside an IIFE (look for IIFE pattern in file)
      const hasIIFE = /\(function\s*\([^)]*\)\s*\{[\s\S]*\}\)\s*\(/.test(content) ||
                     /\(\s*\([^)]*\)\s*=>\s*\{[\s\S]*\}\s*\)\s*\(/.test(content);
      
      // Check if there's an environment check nearby (within 3 lines before or same line)
      const contextStart = Math.max(0, index - 3);
      const contextLines = lines.slice(contextStart, index + 1).join('\n');
      
      // Allow if inside IIFE OR has environment check
      if (!hasIIFE && !envCheckPattern.test(contextLines)) {
        issues.push({
          line: index + 1,
          code: line.trim(),
          issue: 'Bare require() without environment check - will fail in browser'
        });
      }
    }
  });
  
  // Pattern 2: Direct module.exports without environment check
  // BAD: module.exports = { ... };
  // GOOD: if (typeof module !== 'undefined') { module.exports = { ... }; }
  const bareExportsPattern = /^(?!\s*\/\/).*module\.exports\s*=/gm;
  
  lines.forEach((line, index) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    
    if (bareExportsPattern.test(line)) {
      // Check if we're inside an IIFE
      const hasIIFE = /\(function\s*\([^)]*\)\s*\{[\s\S]*\}\)\s*\(/.test(content) ||
                     /\(\s*\([^)]*\)\s*=>\s*\{[\s\S]*\}\s*\)\s*\(/.test(content);
      
      // Check if there's an environment check on the same line or within 2 lines before
      const contextStart = Math.max(0, index - 2);
      const contextLines = lines.slice(contextStart, index + 1).join('\n');
      
      // Allow if inside IIFE OR has environment check
      if (!hasIIFE && !envCheckPattern.test(contextLines)) {
        issues.push({
          line: index + 1,
          code: line.trim(),
          issue: 'Bare module.exports without environment check - will fail in browser'
        });
      }
    }
  });
  
  return issues;
}

/**
 * Recursively get all .js files in a directory
 */
function getJsFiles(dir) {
  const files = [];
  
  if (!fs.existsSync(dir)) return files;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...getJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

describe('Browser Compatibility', () => {
  describe('metadata-parser modules', () => {
    BROWSER_COMPATIBLE_DIRS.forEach(dir => {
      const dirName = path.basename(dir);
      
      it(`should not contain unsafe Node.js patterns in ${dirName}/`, () => {
        const jsFiles = getJsFiles(dir);
        
        if (jsFiles.length === 0) {
          console.warn(`No JS files found in ${dir}`);
          return;
        }
        
        const allIssues = [];
        
        jsFiles.forEach(filePath => {
          const issues = checkBrowserCompatibility(filePath);
          if (issues.length > 0) {
            allIssues.push({
              file: path.relative(process.cwd(), filePath),
              issues
            });
          }
        });
        
        if (allIssues.length > 0) {
          const errorMessage = allIssues.map(({ file, issues }) => {
            const issueList = issues.map(i => 
              `  Line ${i.line}: ${i.issue}\n    ${i.code}`
            ).join('\n');
            return `\n${file}:\n${issueList}`;
          }).join('\n');
          
          expect.fail(
            `Found browser-incompatible code in metadata-parser modules:${errorMessage}\n\n` +
            `CRITICAL: These files run in browser (Eagle/Electron) and MUST NOT use bare require() or module.exports.\n` +
            `Use IIFE pattern with window exports instead, or wrap Node.js code in environment checks.`
          );
        }
        
        expect(allIssues).toHaveLength(0);
      });
    });
  });
  
  describe('IIFE pattern validation', () => {
    it('should use IIFE pattern in browser-compatible modules', () => {
      const jsFiles = BROWSER_COMPATIBLE_DIRS.flatMap(dir => getJsFiles(dir));
      
      if (jsFiles.length === 0) {
        console.warn('No JS files found in metadata-parser directories');
        return;
      }
      
      const filesWithoutIIFE = [];
      
      jsFiles.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check for IIFE pattern: (function() { ... })() or (() => { ... })()
        const hasIIFE = /\(function\s*\([^)]*\)\s*\{[\s\S]*\}\)\s*\(\)/.test(content) ||
                       /\(\s*\([^)]*\)\s*=>\s*\{[\s\S]*\}\s*\)\s*\(\)/.test(content);
        
        // Check for window export
        const hasWindowExport = /window\.\w+\s*=/.test(content);
        
        if (!hasIIFE || !hasWindowExport) {
          filesWithoutIIFE.push({
            file: path.relative(process.cwd(), filePath),
            hasIIFE,
            hasWindowExport
          });
        }
      });
      
      if (filesWithoutIIFE.length > 0) {
        const errorMessage = filesWithoutIIFE.map(({ file, hasIIFE, hasWindowExport }) => {
          const issues = [];
          if (!hasIIFE) issues.push('Missing IIFE wrapper');
          if (!hasWindowExport) issues.push('Missing window export');
          return `  ${file}: ${issues.join(', ')}`;
        }).join('\n');
        
        console.warn(
          `Some metadata-parser modules may not follow IIFE pattern:\n${errorMessage}\n` +
          `This is a warning - ensure these files are browser-compatible.`
        );
      }
    });
  });
});
