import { describe, it, expect, vi } from 'vitest';
import Mp4ContainerReader from '../../../js/metadata-parser/containers/Mp4ContainerReader.js';

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value);
  return buffer;
}

function box(type, ...contents) {
  const payload = Buffer.concat(contents);
  return Buffer.concat([u32(payload.length + 8), Buffer.from(type, 'latin1'), payload]);
}

// In-memory unit input for the QuickTime metadata container structure.
function mp4(metadata) {
  const entries = Object.entries(metadata);
  const keys = box('keys', u32(0), u32(entries.length),
    ...entries.map(([key]) => box('mdta', Buffer.from(key))));
  const items = entries.map(([, value], index) =>
    box(u32(index + 1).toString('latin1'), box('data', u32(1), u32(0), Buffer.from(value))));
  return box('moov', box('udta', box('meta', u32(0), keys, box('ilst', ...items))));
}

describe('Mp4ContainerReader JSON metadata', () => {
  it('decodes bridge routing and generation metadata while preserving other text', () => {
    const metadata = {
      prompt: '{"20":{"class_type":"SaveImage","inputs":{}}}',
      workflow: '{"nodes":[]}',
      eagle_bridge: '{"version":1,"final_node_id":"20"}',
      encoder: 'Lavf'
    };
    const result = new Mp4ContainerReader().extractRawChunks(mp4(metadata));
    expect(result).toEqual({
      prompt: JSON.parse(metadata.prompt),
      workflow: { nodes: [] },
      eagle_bridge: { version: 1, final_node_id: '20' },
      encoder: 'Lavf'
    });
  });

  it('preserves malformed JSON and still decodes valid fields', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(new Mp4ContainerReader().extractRawChunks(mp4({
        prompt: '{broken', eagle_bridge: '{"final_node_id":"20"}'
      }))).toEqual({ prompt: '{broken', eagle_bridge: { final_node_id: '20' } });
    } finally {
      warning.mockRestore();
    }
  });
});
