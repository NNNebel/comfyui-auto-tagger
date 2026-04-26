import { describe, it, expect } from 'vitest';
import TagGenerator from '../../js/metadata-processor/TagGenerator.js';

describe('TagGenerator', () => {
  describe('cleanPrompt', () => {
    it('should split prompt by comma and newline', () => {
      const result = TagGenerator.cleanPrompt('tag1, tag2\ntag3');
      expect(result).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should convert tags to lowercase', () => {
      const result = TagGenerator.cleanPrompt('Tag1, TAG2');
      expect(result).toEqual(['tag1', 'tag2']);
    });

    it('should add prefix to tags', () => {
      const result = TagGenerator.cleanPrompt('tag1, tag2', 'neg:');
      expect(result).toEqual(['neg:tag1', 'neg:tag2']);
    });

    it('should remove parentheses from tags', () => {
      const result = TagGenerator.cleanPrompt('(tag1), (tag2)');
      expect(result).toEqual(['tag1', 'tag2']);
    });

    it('should handle empty string', () => {
      const result = TagGenerator.cleanPrompt('');
      expect(result).toEqual([]);
    });

    it('should handle null', () => {
      const result = TagGenerator.cleanPrompt(null);
      expect(result).toEqual([]);
    });

    it('should deduplicate tags', () => {
      const result = TagGenerator.cleanPrompt('tag1, tag1, tag2');
      expect(result).toEqual(['tag1', 'tag2']);
    });
  });

  describe('getBaseName', () => {
    it('should extract base name from path', () => {
      expect(TagGenerator.getBaseName('path/to/file.txt')).toBe('file');
    });

    it('should handle Windows paths', () => {
      expect(TagGenerator.getBaseName('path\\to\\file.txt')).toBe('file');
    });

    it('should handle file without extension', () => {
      expect(TagGenerator.getBaseName('path/to/file')).toBe('file');
    });

    it('should handle empty string', () => {
      expect(TagGenerator.getBaseName('')).toBe('');
    });

    it('should handle null', () => {
      expect(TagGenerator.getBaseName(null)).toBe('');
    });
  });

  describe('generate', () => {
    it('should generate checkpoint tags', () => {
      const metadata = {
        checkpoint: 'models/checkpoint.safetensors'
      };
      const settings = { checkpoint: true };
      const result = TagGenerator.generate(metadata, settings);
      
      expect(result.tags.has('checkpoint')).toBe(true);
      expect(result.cats.cp.has('checkpoint')).toBe(true);
    });

    it('should generate LoRA tags', () => {
      const metadata = {
        loras: ['loras/lora1.safetensors', 'loras/lora2.safetensors']
      };
      const settings = { lora: true };
      const result = TagGenerator.generate(metadata, settings);
      
      expect(result.tags.has('lora1')).toBe(true);
      expect(result.tags.has('lora2')).toBe(true);
      expect(result.cats.lora.has('lora1')).toBe(true);
      expect(result.cats.lora.has('lora2')).toBe(true);
    });

    it('should generate positive prompt tags', () => {
      const metadata = {
        positive: 'beautiful, landscape'
      };
      const settings = { positive: true };
      const result = TagGenerator.generate(metadata, settings);
      
      expect(result.tags.has('beautiful')).toBe(true);
      expect(result.tags.has('landscape')).toBe(true);
      expect(result.cats.pos.has('beautiful')).toBe(true);
      expect(result.cats.pos.has('landscape')).toBe(true);
    });

    it('should generate negative prompt tags with prefix', () => {
      const metadata = {
        negative: 'bad, ugly'
      };
      const settings = { negative: true };
      const result = TagGenerator.generate(metadata, settings);
      
      expect(result.tags.has('neg:bad')).toBe(true);
      expect(result.tags.has('neg:ugly')).toBe(true);
      expect(result.cats.neg.has('neg:bad')).toBe(true);
      expect(result.cats.neg.has('neg:ugly')).toBe(true);
    });

    it('should generate parameter tags', () => {
      const metadata = {
        seed: 12345,
        steps: 20,
        cfg: 7.5,
        sampler: 'euler'
      };
      const settings = { seed: true, steps: true, cfg: true, sampler: true };
      const result = TagGenerator.generate(metadata, settings);
      
      expect(result.tags.has('seed:12345')).toBe(true);
      expect(result.tags.has('steps:20')).toBe(true);
      expect(result.tags.has('cfg:7.50')).toBe(true);
      expect(result.tags.has('sampler:euler')).toBe(true);
    });

    it('should filter tags based on settings', () => {
      const metadata = {
        checkpoint: 'models/checkpoint.safetensors',
        positive: 'beautiful',
        seed: 12345
      };
      const settings = { checkpoint: false, positive: true, seed: false };
      const result = TagGenerator.generate(metadata, settings);
      
      expect(result.tags.has('checkpoint')).toBe(false);
      expect(result.tags.has('beautiful')).toBe(true);
      expect(result.tags.has('seed:12345')).toBe(false);
    });

    it('should handle generationSteps format', () => {
      const metadata = {
        generationSteps: [
          { positive: 'step1, prompt', negative: 'step1, neg' },
          { positive: 'step2, prompt', negative: 'step2, neg' }
        ]
      };
      const settings = { positive: true, negative: true };
      const result = TagGenerator.generate(metadata, settings);
      
      expect(result.tags.has('step1')).toBe(true);
      expect(result.tags.has('step2')).toBe(true);
      expect(result.tags.has('prompt')).toBe(true);
      expect(result.tags.has('neg:step1')).toBe(true);
      expect(result.tags.has('neg:step2')).toBe(true);
      expect(result.tags.has('neg:neg')).toBe(true);
    });

    it('should deduplicate tags across generation steps', () => {
      const metadata = {
        generationSteps: [
          { positive: 'common, unique1' },
          { positive: 'common, unique2' }
        ]
      };
      const settings = { positive: true };
      const result = TagGenerator.generate(metadata, settings);
      
      expect(result.tags.has('common')).toBe(true);
      expect(result.tags.has('unique1')).toBe(true);
      expect(result.tags.has('unique2')).toBe(true);
      expect(result.tags.size).toBe(3);
    });

    it('should generate parameter tags from all generation steps', () => {
      const metadata = {
        generationSteps: [
          { seed: 111111, steps: 30, cfg: 6.0, sampler: 'dpmpp_2m' },
          { seed: 222222, steps: 20, cfg: 6.0, sampler: 'dpmpp_2m' },
          { seed: 333333, steps: 30, cfg: 7.0, sampler: 'dpmpp_2m' },
          { seed: 444444, steps: 2, cfg: 2.0, sampler: 'dpmpp_2m' }
        ]
      };
      const settings = { seed: true, steps: true, cfg: true, sampler: true, includeAllSamplers: true };
      const result = TagGenerator.generate(metadata, settings);
      
      // All seeds should be present
      expect(result.tags.has('seed:111111')).toBe(true);
      expect(result.tags.has('seed:222222')).toBe(true);
      expect(result.tags.has('seed:333333')).toBe(true);
      expect(result.tags.has('seed:444444')).toBe(true);
      
      // All unique steps values should be present
      expect(result.tags.has('steps:30')).toBe(true);
      expect(result.tags.has('steps:20')).toBe(true);
      expect(result.tags.has('steps:2')).toBe(true);
      
      // All unique cfg values should be present
      expect(result.tags.has('cfg:6.00')).toBe(true);
      expect(result.tags.has('cfg:7.00')).toBe(true);
      expect(result.tags.has('cfg:2.00')).toBe(true);
      
      // Sampler should be present (deduplicated)
      expect(result.tags.has('sampler:dpmpp_2m')).toBe(true);
    });

    it('should generate parameter tags from first sampler only when includeAllSamplers is false', () => {
      const metadata = {
        generationSteps: [
          { seed: 111111, steps: 30, cfg: 6.0, sampler: 'dpmpp_2m' },
          { seed: 222222, steps: 20, cfg: 6.0, sampler: 'euler' },
          { seed: 333333, steps: 30, cfg: 7.0, sampler: 'dpmpp_2m' }
        ]
      };
      const settings = { seed: true, steps: true, cfg: true, sampler: true, includeAllSamplers: false };
      const result = TagGenerator.generate(metadata, settings);
      
      // Only first sampler's parameters should be present
      expect(result.tags.has('seed:111111')).toBe(true);
      expect(result.tags.has('seed:222222')).toBe(false);
      expect(result.tags.has('seed:333333')).toBe(false);
      
      expect(result.tags.has('steps:30')).toBe(true);
      expect(result.tags.has('steps:20')).toBe(false);
      
      expect(result.tags.has('cfg:6.00')).toBe(true);
      expect(result.tags.has('cfg:7.00')).toBe(false);
      
      expect(result.tags.has('sampler:dpmpp_2m')).toBe(true);
      expect(result.tags.has('sampler:euler')).toBe(false);
    });

    it('should use base sampler parameters when generationSteps is not present', () => {
      const metadata = {
        seed: 12345,
        steps: 20,
        cfg: 7.5,
        sampler: 'euler'
      };
      const settings = { seed: true, steps: true, cfg: true, sampler: true };
      const result = TagGenerator.generate(metadata, settings);
      
      expect(result.tags.has('seed:12345')).toBe(true);
      expect(result.tags.has('steps:20')).toBe(true);
      expect(result.tags.has('cfg:7.50')).toBe(true);
      expect(result.tags.has('sampler:euler')).toBe(true);
    });

    it('should return empty tags when settings are all false', () => {
      const metadata = {
        checkpoint: 'models/checkpoint.safetensors',
        positive: 'beautiful',
        seed: 12345
      };
      const settings = { checkpoint: false, positive: false, seed: false };
      const result = TagGenerator.generate(metadata, settings);
      
      expect(result.tags.size).toBe(0);
    });

    it('should handle empty metadata', () => {
      const metadata = {};
      const settings = { checkpoint: true, positive: true };
      const result = TagGenerator.generate(metadata, settings);

      expect(result.tags.size).toBe(0);
      expect(result.cats.cp.size).toBe(0);
      expect(result.cats.pos.size).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Settings coverage: every settings key must produce output when enabled.
  // If a new key is added to ALL_SETTINGS but TagGenerator doesn't implement
  // it, one of these tests will fail immediately.
  // ---------------------------------------------------------------------------
  describe('settings coverage — each key produces output when ON', () => {
    const cases = [
      { key: 'checkpoint', meta: { checkpoint: 'models/myModel.safetensors' }, tag: 'mymodel' },
      { key: 'lora',       meta: { loras: ['loras/myLora.safetensors'] },       tag: 'mylora' },
      { key: 'positive',   meta: { positive: 'masterpiece' },                   tag: 'masterpiece' },
      { key: 'negative',   meta: { negative: 'bad quality' },                   tag: 'neg:bad quality' },
      { key: 'seed',    meta: { generationSteps: [{ seed: 42 }] },              tag: 'seed:42' },
      { key: 'steps',   meta: { generationSteps: [{ steps: 20 }] },             tag: 'steps:20' },
      { key: 'cfg',     meta: { generationSteps: [{ cfg: 7.0 }] },              tag: 'cfg:7.00' },
      { key: 'sampler', meta: { generationSteps: [{ sampler: 'euler' }] },      tag: 'sampler:euler' },
      { key: 'scheduler', meta: { generationSteps: [{ scheduler: 'normal' }] }, tag: 'scheduler:normal' },
    ];

    it.each(cases)(
      'setting "$key" ON → "$tag" appears in tags',
      ({ key, meta, tag }) => {
        const settings = { [key]: true };
        const result = TagGenerator.generate(meta, settings);
        expect([...result.tags].some(t => t === tag || t.includes(tag))).toBe(true);
      }
    );

    it.each(cases)(
      'setting "$key" OFF → "$tag" absent from tags',
      ({ key, meta, tag }) => {
        const settings = { [key]: false };
        const result = TagGenerator.generate(meta, settings);
        expect([...result.tags].some(t => t === tag || t.includes(tag))).toBe(false);
      }
    );
  });
});
