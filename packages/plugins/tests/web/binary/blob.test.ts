import { describe, expect, it } from 'vitest';
import BlobPlugin from '../../../web/blob';
import { roundtrip } from './utils';

const PLUGINS = [BlobPlugin];

describe('binary Blob', () => {
  it('supports Blob', async () => {
    const source = new Blob(['Hello World'], { type: 'text/plain' });
    const { value } = await roundtrip<Blob>(source, PLUGINS);
    expect(value).toBeInstanceOf(Blob);
    expect(await value.text()).toBe('Hello World');
    expect(value.type).toBe('text/plain');
    expect(value.size).toBe(source.size);
  });

  it('supports empty Blob', async () => {
    const { value } = await roundtrip<Blob>(new Blob([]), PLUGINS);
    expect(value).toBeInstanceOf(Blob);
    expect(value.size).toBe(0);
    expect(value.type).toBe('');
  });

  it('supports binary payloads', async () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    const source = new Blob([bytes], { type: 'application/octet-stream' });
    const { value } = await roundtrip<Blob>(source, PLUGINS);
    expect([...new Uint8Array(await value.arrayBuffer())]).toEqual([...bytes]);
    expect(value.type).toBe('application/octet-stream');
  });

  it('supports multibyte text', async () => {
    const source = new Blob(['ハロー 👋'], { type: 'text/plain;charset=utf-8' });
    const { value } = await roundtrip<Blob>(source, PLUGINS);
    expect(await value.text()).toBe('ハロー 👋');
  });

  it('supports Blobs nested in structures', async () => {
    const { value } = await roundtrip<{ file: Blob; name: string }>(
      { file: new Blob(['data']), name: 'attachment' },
      PLUGINS,
    );
    expect(value.name).toBe('attachment');
    expect(await value.file.text()).toBe('data');
  });

  it('preserves identity of a repeated Blob', async () => {
    const blob = new Blob(['shared']);
    const { value } = await roundtrip<Blob[]>([blob, blob], PLUGINS);
    expect(value[0]).toBe(value[1]);
  });
});
