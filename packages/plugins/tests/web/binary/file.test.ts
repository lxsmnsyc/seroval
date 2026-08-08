import { describe, expect, it } from 'vitest';
import FilePlugin from '../../../web/file';
import { roundtrip } from './utils';

const PLUGINS = [FilePlugin];

describe('binary File', () => {
  it('supports File', async () => {
    const source = new File(['Hello World'], 'hello.txt', {
      type: 'text/plain',
      lastModified: 1_700_000_000_000,
    });
    const { value } = await roundtrip<File>(source, PLUGINS);
    expect(value).toBeInstanceOf(File);
    expect(await value.text()).toBe('Hello World');
    expect(value.name).toBe('hello.txt');
    expect(value.type).toBe('text/plain');
    expect(value.lastModified).toBe(1_700_000_000_000);
  });

  it('supports empty File', async () => {
    const { value } = await roundtrip<File>(
      new File([], 'empty.bin'),
      PLUGINS,
    );
    expect(value).toBeInstanceOf(File);
    expect(value.size).toBe(0);
    expect(value.name).toBe('empty.bin');
  });

  it('supports binary content', async () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 251, 252]);
    const { value } = await roundtrip<File>(
      new File([bytes], 'data.bin', { type: 'application/octet-stream' }),
      PLUGINS,
    );
    expect([...new Uint8Array(await value.arrayBuffer())]).toEqual([...bytes]);
  });

  it('keeps the name verbatim, including path-like names', async () => {
    // The plugin is not a file system writer: it must neither reject nor
    // rewrite the name, so consumers know they own that validation.
    const { value } = await roundtrip<File>(
      new File(['x'], '../../etc/passwd'),
      PLUGINS,
    );
    expect(value.name).toBe('../../etc/passwd');
  });

  it('supports Files nested in structures', async () => {
    const { value } = await roundtrip<{ files: File[] }>(
      { files: [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')] },
      PLUGINS,
    );
    expect(value.files).toHaveLength(2);
    expect(await value.files[0].text()).toBe('a');
    expect(await value.files[1].text()).toBe('b');
  });

  it('hands over a deeply nested File already materialized', async () => {
    // A File's bytes travel as a Promise node, so the value only exists once
    // that node settles. The root must not be handed over before then, at any
    // depth - a consumer has no other signal to wait on.
    const { value } = await roundtrip<{ a: { b: { files: File[] } } }>(
      { a: { b: { files: [new File(['deep'], 'deep.txt')] } } },
      PLUGINS,
    );
    expect(value.a.b.files[0]).toBeInstanceOf(File);
    expect(await value.a.b.files[0].text()).toBe('deep');
  });

  it('hands over Files nested in Maps and Sets', async () => {
    const { value } = await roundtrip<{
      map: Map<string, File>;
      set: Set<File>;
    }>(
      {
        map: new Map([['key', new File(['in map'], 'map.txt')]]),
        set: new Set([new File(['in set'], 'set.txt')]),
      },
      PLUGINS,
    );
    expect(value.map.get('key')).toBeInstanceOf(File);
    expect(await (value.map.get('key') as File).text()).toBe('in map');
    expect(value.set.size).toBe(1);
    expect([...value.set][0]).toBeInstanceOf(File);
  });

  it('hands over a Map of Files at the root', async () => {
    const { value } = await roundtrip<Map<string, File>>(
      new Map([['f', new File(['x'], 'x.txt')]]),
      PLUGINS,
    );
    expect(value.size).toBe(1);
    expect(value.get('f')).toBeInstanceOf(File);
  });

  it('delivers a File at the root fully populated', async () => {
    const { value } = await roundtrip<File>(
      new File(['root'], 'root.txt'),
      PLUGINS,
    );
    expect(value).toBeInstanceOf(File);
    expect(await value.text()).toBe('root');
  });
});
