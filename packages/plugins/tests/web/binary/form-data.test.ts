import { describe, expect, it, vi } from 'vitest';
import FormDataPlugin from '../../../web/form-data';
import { roundtrip } from './utils';

const PLUGINS = [FormDataPlugin];

describe('binary FormData', () => {
  it('supports FormData', async () => {
    const source = new FormData();
    source.set('name', 'Hello World');
    source.set('count', '2');

    const { value } = await roundtrip<FormData>(source, PLUGINS);
    expect(value).toBeInstanceOf(FormData);
    expect(value.get('name')).toBe('Hello World');
    expect(value.get('count')).toBe('2');
  });

  it('supports empty FormData', async () => {
    const { value } = await roundtrip<FormData>(new FormData(), PLUGINS);
    expect(value).toBeInstanceOf(FormData);
    expect([...value.keys()]).toEqual([]);
  });

  it('supports repeated keys in order', async () => {
    const source = new FormData();
    source.append('tag', 'a');
    source.append('tag', 'b');

    const { value } = await roundtrip<FormData>(source, PLUGINS);
    expect(value.getAll('tag')).toEqual(['a', 'b']);
  });

  // KNOWN FAILURE - a plugin's `deserialize` runs as soon as the *shell* of
  // its options object exists. A File's bytes travel as a Promise node, so
  // `FORM_DATA_FACTORY_CONSTRUCTOR` appends the entry before the File lands
  // and FormData copies the value at append time: the entry is permanently
  // the string "undefined". Flip this back to `it` once plugin options wait
  // for their subtree to materialise.
  it.fails('supports File entries through the extended plugin', async () => {
    const source = new FormData();
    source.set('upload', new File(['content'], 'upload.txt'), 'upload.txt');

    const { value } = await roundtrip<FormData>(source, PLUGINS);
    await vi.waitFor(() => {
      expect(value.get('upload')).toBeInstanceOf(File);
    });
    const file = value.get('upload') as File;
    expect(file.name).toBe('upload.txt');
    expect(await file.text()).toBe('content');
  });

  it('corrupts File entries today, and never recovers', async () => {
    // Pins the damage from the bug above so a partial fix cannot go unnoticed.
    const source = new FormData();
    source.set('text', 'value');
    source.set('blob', new File(['bytes'], 'blob.bin'));

    const { value, done } = await roundtrip<FormData>(source, PLUGINS);
    await done;
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(value.get('text')).toBe('value');
    expect(value.get('blob')).toBe('undefined');
  });

  it('supports string-only FormData without any delay', async () => {
    const source = new FormData();
    source.set('a', '1');
    source.set('b', '2');

    const { value } = await roundtrip<FormData>(source, PLUGINS);
    expect(value.get('a')).toBe('1');
    expect(value.get('b')).toBe('2');
  });

  it('supports FormData nested in structures', async () => {
    const inner = new FormData();
    inner.set('a', '1');
    const { value } = await roundtrip<{ form: FormData }>(
      { form: inner },
      PLUGINS,
    );
    expect(value.form).toBeInstanceOf(FormData);
    expect(value.form.get('a')).toBe('1');
  });
});
