import { describe, it, expect, beforeEach } from 'vitest';
import MetadataService from '../../../js/metadata-parser/integration/MetadataService.js';
import ComfyUIParser from '../../../js/metadata-parser/parsers/ComfyUIParser.js';
import A1111Parser from '../../../js/metadata-parser/parsers/A1111Parser.js';

describe('MetadataService', () => {
  let service;

  beforeEach(() => {
    service = new MetadataService();
  });

  describe('constructor', () => {
    it('creates a new instance', () => {
      expect(service).toBeDefined();
      expect(typeof service.extractMetadata).toBe('function');
    });
  });

  describe('initializeParsers', () => {
    it('registers parsers without error', () => {
      expect(() => {
        service.initializeParsers();
      }).not.toThrow();
    });

    it('allows calling initializeParsers multiple times', () => {
      service.initializeParsers();
      service.initializeParsers();
      // Should not duplicate or throw
      const results = service.extractMetadata(
        new Uint8Array([0x89, 0x50, 0x4E, 0x47]), // PNG signature
        'image/png'
      );
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('extractMetadata', () => {
    it('returns array of results', () => {
      const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const results = service.extractMetadata(buffer, 'image/png');
      expect(Array.isArray(results)).toBe(true);
    });

    it('handles empty buffer', () => {
      const buffer = new Uint8Array(0);
      const results = service.extractMetadata(buffer, 'image/png');
      expect(Array.isArray(results)).toBe(true);
    });

    it('processes PNG mime type', () => {
      const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const results = service.extractMetadata(buffer, 'image/png');
      expect(results).toBeDefined();
    });

    it('processes WebP mime type', () => {
      const buffer = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
      const results = service.extractMetadata(buffer, 'image/webp');
      expect(results).toBeDefined();
    });

    it('processes JPEG mime type', () => {
      const buffer = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
      const results = service.extractMetadata(buffer, 'image/jpeg');
      expect(results).toBeDefined();
    });

    it('accepts options parameter', () => {
      const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
      const options = { forcedOutputNodeIds: ['1'] };
      const results = service.extractMetadata(buffer, 'image/png', options);
      expect(results).toBeDefined();
    });
  });

  describe('extractPreferredMetadata', () => {
    it('returns result object when format found', () => {
      const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const results = service.extractPreferredMetadata(buffer, 'image/png', 'comfyui');
      expect(results).toBeDefined();
      expect(typeof results === 'object' || Array.isArray(results)).toBe(true);
    });

    it('can specify preferred format', () => {
      const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
      const results = service.extractPreferredMetadata(buffer, 'image/png', 'comfyui');
      expect(results).toBeDefined();
    });

    it('handles request with options', () => {
      const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
      const options = { forcedOutputNodeIds: ['1'] };
      const results = service.extractPreferredMetadata(
        buffer,
        'image/png',
        'comfyui',
        options
      );
      expect(results).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('handles invalid mime type gracefully', () => {
      const buffer = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
      const results = service.extractMetadata(buffer, 'invalid/type');
      expect(results).toBeDefined();
    });

    it('returns valid structure even on error', () => {
      const buffer = new Uint8Array([0x89]);
      const results = service.extractMetadata(buffer, 'image/png');
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
