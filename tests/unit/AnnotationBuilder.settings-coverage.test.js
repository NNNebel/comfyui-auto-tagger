import { describe, it, expect } from 'vitest';
import AnnotationBuilder from '../../js/metadata-processor/AnnotationBuilder.js';

const t = (key) => {
  const map = {
    'ui.option.checkpoint': 'Checkpoint', 'ui.option.lora': 'LoRA',
    'ui.option.seed': 'Seed', 'ui.option.steps': 'Steps', 'ui.option.sampler': 'Sampler',
  };
  return map[key] || key.split('.').pop();
};

// ---------------------------------------------------------------------------
// Settings coverage — each settings key must produce output when ON and
// suppress it when OFF.  Any future deletion of implementation will fail the
// corresponding ON test immediately.
//
// Uses generationSteps format (primary path) and fallback format (secondary).
// ---------------------------------------------------------------------------

const STEP_META = (overrides) => ({
  generationSteps: [{ nodeId: '1', nodeType: 'KSampler', isBase: true, ...overrides }]
});

const FALLBACK_META = (overrides) => ({ ...overrides });

const cases = [
  // key, metadata, expected fragment in output
  { key: 'checkpoint', meta: { checkpoint: 'models/myModel.safetensors', ...STEP_META({}) },
    fragment: 'Checkpoint: myModel' },
  { key: 'lora',       meta: { loras: ['loras/myLora.safetensors'], ...STEP_META({}) },
    fragment: 'LoRA: myLora' },
  { key: 'seed',       meta: STEP_META({ seed: 99 }),       fragment: 'Seed: 99' },
  { key: 'steps',      meta: STEP_META({ steps: 25 }),      fragment: 'Steps: 25' },
  { key: 'cfg',        meta: STEP_META({ cfg: 6.5 }),       fragment: 'CFG: 6.5' },
  { key: 'sampler',    meta: STEP_META({ sampler: 'euler' }), fragment: 'Sampler: euler' },
  { key: 'scheduler',  meta: STEP_META({ scheduler: 'karras' }), fragment: 'Scheduler: karras' },
  { key: 'positive',   meta: STEP_META({ positive: 'masterpiece' }), fragment: 'Positive: masterpiece' },
  { key: 'negative',   meta: STEP_META({ negative: 'bad quality' }), fragment: 'Negative: bad quality' },
];

const fallbackCases = [
  { key: 'seed',      meta: FALLBACK_META({ seed: 99 }),            fragment: 'Seed: 99' },
  { key: 'steps',     meta: FALLBACK_META({ steps: 25 }),           fragment: 'Steps: 25' },
  { key: 'cfg',       meta: FALLBACK_META({ cfg: 6.5 }),            fragment: 'CFG: 6.5' },
  { key: 'sampler',   meta: FALLBACK_META({ sampler: 'euler' }),    fragment: 'Sampler: euler' },
  { key: 'scheduler', meta: FALLBACK_META({ scheduler: 'karras' }), fragment: 'Scheduler: karras' },
  { key: 'positive',  meta: FALLBACK_META({ seed: 1, positive: 'masterpiece' }),
    fragment: '[Positive Prompt]' },
  { key: 'negative',  meta: FALLBACK_META({ seed: 1, negative: 'bad quality' }),
    fragment: '[Negative Prompt]' },
];

describe('AnnotationBuilder — settings coverage (generationSteps path)', () => {
  it.each(cases)(
    'setting "$key" ON → "$fragment" appears',
    ({ key, meta, fragment }) => {
      const result = AnnotationBuilder.build(meta, { [key]: true }, t);
      expect(result).toContain(fragment);
    }
  );

  it.each(cases)(
    'setting "$key" OFF → "$fragment" absent',
    ({ key, meta, fragment }) => {
      const result = AnnotationBuilder.build(meta, { [key]: false }, t);
      expect(result).not.toContain(fragment);
    }
  );
});

describe('AnnotationBuilder — settings coverage (fallback path)', () => {
  it.each(fallbackCases)(
    'setting "$key" ON → "$fragment" appears',
    ({ key, meta, fragment }) => {
      const result = AnnotationBuilder.build(meta, { [key]: true }, t);
      expect(result).toContain(fragment);
    }
  );

  it.each(fallbackCases)(
    'setting "$key" OFF → "$fragment" absent',
    ({ key, meta, fragment }) => {
      const result = AnnotationBuilder.build(meta, { [key]: false }, t);
      expect(result).not.toContain(fragment);
    }
  );
});
