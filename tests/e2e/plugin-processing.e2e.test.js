/**
 * E2E Tests for plugin.js processing flow
 * 
 * These tests simulate the actual processing flow in plugin.js,
 * including debug logging, suspicious node handling, and metadata processing.
 * 
 * This catches runtime errors that unit/integration tests miss.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the modules that plugin.js uses
const MetadataService = (await import('../../js/metadata-parser/integration/MetadataService.js')).default;
const { processMetadata } = await import('../../js/core.js');

describe('Plugin.js E2E Tests - Processing Flow', () => {
  let metadataService;
  let debugLogs;
  let isDebugMode;

  beforeEach(() => {
    metadataService = new MetadataService();
    debugLogs = [];
    isDebugMode = true;

    // Mock debug logging function (simulates plugin.js debugLog)
    global.debugLog = async (msg, item = null, level = 'info') => {
      if (!isDebugMode) return;
      
      const timestamp = new Date().toISOString();
      const itemPrefix = item ? `[${item.name}] ` : '';
      const levelPrefix = `[${level.toUpperCase()}]`;
      const line = `[${timestamp}] ${levelPrefix} ${itemPrefix}${msg}`;
      
      debugLogs.push({ msg, item, level, line });
    };

    global.isDebugMode = () => isDebugMode;
  });

  describe('Suspicious Node Handling with Debug Logging', () => {
    // Test each fixture file individually to catch file-specific issues
    const fixtureFiles = [
      'a1111_simple.png',
      'blank.png',
      'civitai-generate1.png',
      'comfy-samplerCustomAdvanced.png',
      'comfyui_flux.png',
      'comfyui_i2i.webp',
      'comfyui_multi.png',
      'comfyui_multi.webp',
      'comfyui_simple.png',
      'comfyui_simple.webp',
      'comfyui_suspicious_node.webp',
      'comfyui_suspicious_node2.webp',
      'gemini-generate.png'
    ];

    fixtureFiles.forEach(filename => {
      it(`should handle ${filename} without errors`, async () => {
        const fixturePath = path.join(__dirname, '../fixtures', filename);
        
        // Skip if fixture doesn't exist
        if (!fs.existsSync(fixturePath)) {
          console.warn(`Skipping test: ${filename} not found`);
          return;
        }

        const buffer = fs.readFileSync(fixturePath);
        const item = { name: filename, filePath: fixturePath };
        const ext = path.extname(filename).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : 'image/webp';

        let error = null;
        try {
          await debugLog('--- Processing item: ' + item.name + ' ---');
          await debugLog('File info: ext=' + ext + ', size=' + buffer.length + ' bytes, mimeType=' + mimeType, item);
          
          const suspiciousNodeHandling = 'exclude';
          await debugLog('Suspicious node handling: ' + suspiciousNodeHandling, item);
          
          await debugLog('Extracting metadata...', item);
          const metadata = metadataService.extractPreferredMetadata(buffer, mimeType, 'comfyui', {
            suspiciousNodeHandling: suspiciousNodeHandling
          });
          
          if (metadata) {
            await debugLog('=== METADATA EXTRACTION COMPLETE ===', item);
            await debugLog('Format: ' + metadata.format, item);
            
            // Log full metadata content
            await debugLog('--- Full Metadata Content ---', item);
            await debugLog(JSON.stringify(metadata, null, 2), item);
            await debugLog('--- End of Full Metadata ---', item);
            
            // Log summary
            await debugLog('--- Metadata Summary ---', item);
            await debugLog('Checkpoint: ' + (metadata.checkpoint || 'none'), item);
            await debugLog('Suspicious Nodes: ' + (metadata.suspiciousNodes ? metadata.suspiciousNodes.length : 0), item);
            
            // THIS IS THE CRITICAL PART THAT WAS FAILING
            if (metadata.suspiciousNodes && metadata.suspiciousNodes.length > 0) {
              await debugLog('=== SUSPICIOUS NODES DETECTED ===', item, 'warn');
              await debugLog('Count: ' + metadata.suspiciousNodes.length, item, 'warn');
              
              for (let i = 0; i < metadata.suspiciousNodes.length; i++) {
                const node = metadata.suspiciousNodes[i];
                await debugLog('  Node ' + (i + 1) + ':', item, 'warn');
                await debugLog('    ID: ' + node.nodeId, item, 'warn');
                await debugLog('    Type: ' + node.nodeType, item, 'warn');
                await debugLog('    Reason Key: ' + (node.reasonKey || 'unknown'), item, 'warn');
                
                // FIXED: Check if missingInputs exists AND is an array
                if (node.missingInputs && Array.isArray(node.missingInputs)) {
                  await debugLog('    Missing inputs: ' + JSON.stringify(node.missingInputs), item, 'warn');
                  await debugLog('    Reason: ' + (node.missingInputs.includes('latent_image') || node.missingInputs.includes('latent') ? 'Missing latent connection' : 
                                                  node.missingInputs.includes('image') ? 'Missing image connection' : 
                                                  'Missing required inputs: ' + node.missingInputs.join(', ')), item, 'warn');
                }
                
                if (node.affectedSteps && node.affectedSteps.length > 0) {
                  await debugLog('    Affected steps: ' + node.affectedSteps.length, item, 'warn');
                  for (let j = 0; j < node.affectedSteps.length; j++) {
                    const step = node.affectedSteps[j];
                    await debugLog('      Step ' + (j + 1) + ': index=' + step.stepIndex + ', nodeId=' + step.stepNodeId + ', type=' + step.stepNodeType, item, 'warn');
                  }
                }
              }
            }
          }
        } catch (e) {
          error = e;
          await debugLog('ERROR: ' + e.message, item, 'error');
        }

        // Assertions
        expect(error).toBeNull();
        
        // Verify no error logs
        const errorLogs = debugLogs.filter(log => log.level === 'error');
        expect(errorLogs.length).toBe(0);
      });
    });
  });

  describe('Full Processing Flow with processMetadata', () => {
    it('should complete full processing flow for comfyui_suspicious_node2.webp', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/comfyui_suspicious_node2.webp');
      
      if (!fs.existsSync(fixturePath)) {
        console.warn('Skipping test: comfyui_suspicious_node2.webp not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const item = { name: 'comfyui_suspicious_node2', tags: [], annotation: '' };

      const settings = {
        checkpoint: true,
        lora: true,
        positive: true,
        negative: true,
        seed: true,
        sampler: true,
        scheduler: true,
        steps: true,
        cfg: true,
        addTags: true,
        writeNotes: true
      };

      // Mock translation function that returns actual translations
      const translations = {
        'ui.option.checkpoint': 'Checkpoint',
        'ui.option.lora': 'LoRA',
        'ui.option.seed': 'Seed',
        'ui.option.steps': 'Steps',
        'ui.option.sampler': 'Sampler',
        'ui.option.scheduler': 'Scheduler',
        'ui.option.cfg': 'CFG',
        'ui.option.positive': 'Positive',
        'ui.option.negative': 'Negative'
      };
      
      const t = (key, replacements = {}) => {
        return translations[key] || replacements.defaultValue || key;
      };

      let error = null;
      let result = null;

      try {
        // Extract metadata
        const metadata = metadataService.extractPreferredMetadata(buffer, 'image/webp', 'comfyui', {
          suspiciousNodeHandling: 'exclude'
        });

        expect(metadata).toBeDefined();
        expect(metadata.format).toBe('comfyui');
        expect(metadata.suspiciousNodes).toBeDefined();
        expect(metadata.suspiciousNodes.length).toBe(2);

        // Process metadata (this is what plugin.js does)
        result = processMetadata(metadata, settings, t);

        expect(result).toBeDefined();
        expect(result.tags).toBeDefined();
        expect(result.annotation).toBeDefined();

        // Simulate tag and annotation updates
        if (settings.addTags && result.tags.size > 0) {
          const current = new Set((item.tags || []).map(t => t.toLowerCase()));
          const toAdd = Array.from(result.tags).filter(tag => !current.has(tag));
          if (toAdd.length > 0) {
            item.tags = [...(item.tags || []), ...toAdd];
          }
        }

        if (settings.writeNotes && result.annotation) {
          const marker = '[Generation Info]';
          const currentAnnotation = item.annotation || '';
          const idx = currentAnnotation.indexOf(marker);
          item.annotation = idx !== -1 
            ? currentAnnotation.substring(0, idx).trim() + '\n\n' + result.annotation 
            : (currentAnnotation ? currentAnnotation + '\n\n' : '') + result.annotation;
        }

        // Verify results
        expect(item.tags.length).toBeGreaterThan(0);
        expect(item.annotation).toContain('[Generation Info]');
        expect(item.annotation).toContain('Checkpoint: perfectdeliberate_v60'); // Without extension, as AnnotationBuilder.getBaseName removes it

      } catch (e) {
        error = e;
        console.error('Processing error:', e);
      }

      expect(error).toBeNull();
      expect(result).not.toBeNull();
    });

    it('should handle all fixture files without errors', async () => {
      const fixturesDir = path.join(__dirname, '../fixtures');
      const files = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.png') || f.endsWith('.webp'));

      const settings = {
        checkpoint: true,
        lora: true,
        positive: true,
        negative: true,
        seed: true,
        sampler: true,
        scheduler: true,
        steps: true,
        cfg: true,
        addTags: true,
        writeNotes: true
      };

      const translations = {
        'ui.option.checkpoint': 'Checkpoint',
        'ui.option.lora': 'LoRA',
        'ui.option.seed': 'Seed',
        'ui.option.steps': 'Steps',
        'ui.option.sampler': 'Sampler',
        'ui.option.scheduler': 'Scheduler',
        'ui.option.cfg': 'CFG',
        'ui.option.positive': 'Positive',
        'ui.option.negative': 'Negative'
      };
      
      const t = (key, replacements = {}) => {
        return translations[key] || replacements.defaultValue || key;
      };

      const errors = [];

      for (const file of files) {
        const fixturePath = path.join(fixturesDir, file);
        const buffer = fs.readFileSync(fixturePath);
        const ext = path.extname(file).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : 'image/webp';
        const item = { name: file, tags: [], annotation: '' };

        try {
          // Extract metadata
          const metadata = metadataService.extractPreferredMetadata(buffer, mimeType, 'comfyui', {
            suspiciousNodeHandling: 'exclude'
          });

          if (!metadata) {
            continue; // Skip files with no metadata
          }

          // Debug logging simulation (the part that was failing)
          if (metadata.suspiciousNodes && metadata.suspiciousNodes.length > 0) {
            for (let i = 0; i < metadata.suspiciousNodes.length; i++) {
              const node = metadata.suspiciousNodes[i];
              
              // This should not throw an error
              if (node.missingInputs && Array.isArray(node.missingInputs)) {
                await debugLog('Missing inputs: ' + JSON.stringify(node.missingInputs), item, 'warn');
              }
              
              if (node.affectedSteps && node.affectedSteps.length > 0) {
                await debugLog('Affected steps: ' + node.affectedSteps.length, item, 'warn');
              }
            }
          }

          // Process metadata
          const result = processMetadata(metadata, settings, t);

          // Verify result structure
          expect(result).toBeDefined();
          expect(result.tags).toBeDefined();

        } catch (e) {
          errors.push({ file, error: e.message, stack: e.stack });
        }
      }

      // Report all errors at once
      if (errors.length > 0) {
        console.error('Errors encountered:');
        errors.forEach(({ file, error, stack }) => {
          console.error(`  ${file}: ${error}`);
          console.error(`    ${stack}`);
        });
      }

      expect(errors).toHaveLength(0);
    });
  });

  describe('Debug Mode Toggle', () => {
    it('should not log when debug mode is off', async () => {
      isDebugMode = false;
      debugLogs = [];

      await debugLog('This should not be logged');

      expect(debugLogs.length).toBe(0);
    });

    it('should log when debug mode is on', async () => {
      isDebugMode = true;
      debugLogs = [];

      await debugLog('This should be logged');

      expect(debugLogs.length).toBe(1);
      expect(debugLogs[0].msg).toBe('This should be logged');
    });
  });
});
