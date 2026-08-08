import { describe, expect, it, vi } from 'vitest';
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
    // A File's bytes travel as a Promise node, so a File nested below the root
    // lands after the root is handed over. See the timing test below.
    await vi.waitFor(() => {
      expect(value.files[1]).toBeInstanceOf(File);
    });
    expect(value.files).toHaveLength(2);
    expect(await value.files[0].text()).toBe('a');
    expect(await value.files[1].text()).toBe('b');
  });

  it('fills a nested File in only after the root is handed over', async () => {
    // The root resolves once its own pending assignments settle, and assigning
    // the array counts as settled the moment the array *shell* exists. A
    // grandchild waiting on a Promise node is not covered by that count, and
    // the deserializer exposes no "fully materialised" signal to wait on.
    const { value } = await roundtrip<{ files: File[] }>(
      { files: [new File(['a'], 'a.txt')] },
      PLUGINS,
    );
    expect(value.files[0]).toBeUndefined();

    await vi.waitFor(() => {
      expect(value.files[0]).toBeInstanceOf(File);
    });
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
