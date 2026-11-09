import { SerovalDeserializationError, SerovalPluginValidationError, toJSON } from 'seroval';
import { describe, expect, it, vi } from 'vitest';
import {
  FILE_FIELD,
  SerovalTransportError,
  VALUE_FIELD,
  fromFormData,
  fromFormRequest,
  toFormData,
  toFormRequest,
} from '../src/web';

function getCause(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(SerovalDeserializationError);
    return error instanceof SerovalDeserializationError ? error.cause : undefined;
  }
  throw new Error('Expected an error.');
}

// Copies `form` with one field of the root plugin node replaced by `value`.
function tamperRoot(form: FormData, field: string, value: unknown): FormData {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The test builds malformed input on purpose.
  const json = JSON.parse(String(form.get(VALUE_FIELD))) as { t: { s: Record<string, unknown> } };
  json.t.s[field] = toJSON(value).t;
  const tampered = new FormData();
  for (const [name, part] of form.entries()) {
    tampered.set(name, name === VALUE_FIELD ? JSON.stringify(json) : part);
  }
  return tampered;
}

describe('form data', () => {
  it('sends files and blobs as parts', async () => {
    const file = new File(['hello'], 'a.txt', { type: 'text/plain', lastModified: 1234 });
    const blob = new Blob([new Uint8Array([1, 2, 3])]);
    const form = await toFormData({ file, blob, list: [file] });

    // The JSON holds only indexes, and the same file goes once.
    expect(form.get(VALUE_FIELD)).not.toContain('hello');
    expect(form.get(FILE_FIELD + '0')).toBeInstanceOf(Blob);
    expect(form.get(FILE_FIELD + '1')).toBeInstanceOf(Blob);
    expect(form.has(FILE_FIELD + '2')).toBe(false);

    const result = fromFormData<{ file: File; blob: Blob; list: File[] }>(form);
    expect(result.file).toBeInstanceOf(File);
    expect(result.file.name).toBe('a.txt');
    expect(result.file.type).toBe('text/plain');
    expect(result.file.lastModified).toBe(1234);
    expect(await result.file.text()).toBe('hello');
    expect(result.list[0]).toBe(result.file);

    // A blob comes back as a blob with its own type, not a file.
    expect(result.blob).not.toBeInstanceOf(File);
    expect(result.blob.type).toBe('');
    expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('sends form data with files in it', async () => {
    const input = new FormData();
    input.append('name', 'Ada');
    input.append('photo', new File(['png'], 'photo.png', { type: 'image/png' }));
    input.append('name', 'Grace');
    const result = fromFormData<{ data: FormData }>(await toFormData({ data: input }));
    expect(result.data).toBeInstanceOf(FormData);
    expect(result.data.getAll('name')).toEqual(['Ada', 'Grace']);
    const photo = result.data.get('photo') as File;
    expect(photo.name).toBe('photo.png');
    expect(await photo.text()).toBe('png');
  });

  it('awaits promises in the value', async () => {
    const form = await toFormData({ a: Promise.resolve(new Blob(['x'])) });
    const result = fromFormData<{ a: Promise<Blob> }>(form);
    expect(await (await result.a).text()).toBe('x');
  });

  it('sends a value through a request', async () => {
    const request = await toFormRequest('http://localhost/api', [
      'call',
      new File(['data'], 'f.bin'),
    ]);
    expect(request.method).toBe('POST');
    expect(request.headers.get('content-type')).toMatch(/^multipart\/form-data/);
    const result = await fromFormRequest<[string, File]>(request);
    expect(result[0]).toBe('call');
    expect(result[1].name).toBe('f.bin');
    expect(await result[1].text()).toBe('data');
  });

  it('refuses malformed form data', () => {
    const empty = new FormData();
    expect(() => fromFormData(empty)).toThrow(SerovalTransportError);

    const notJSON = new FormData();
    notJSON.set(VALUE_FIELD, '{');
    expect(() => fromFormData(notJSON)).toThrow(SerovalTransportError);
  });

  it('refuses an index without its part', async () => {
    const form = await toFormData(new Blob(['x']));
    form.delete(FILE_FIELD + '0');
    expect(() => fromFormData(form)).toThrow(SerovalDeserializationError);
  });

  it('refuses a part that is not a file', async () => {
    const form = await toFormData(new Blob(['x']));
    form.set(FILE_FIELD + '0', 'text');
    expect(() => fromFormData(form)).toThrow(SerovalDeserializationError);
  });

  it('checks the fields of a blob node with its validators', async () => {
    const form = await toFormData(new File(['x'], 'a.txt', { lastModified: 1 }));
    const fields: [field: string, value: unknown][] = [
      ['i', -1],
      ['i', 0.5],
      ['t', 1],
      ['n', 1],
      ['l', '1'],
    ];
    for (const [field, value] of fields) {
      const cause = getCause(() => fromFormData(tamperRoot(form, field, value)));
      expect(cause).toBeInstanceOf(SerovalPluginValidationError);
      expect(cause).toMatchObject({ field });
    }
  });

  it('checks the entries of a form data node with its validator', async () => {
    const form = await toFormData(new FormData());
    const entries: unknown[] = ['text', [['name']], [[1, 'value']], [['name', 1]]];
    for (const value of entries) {
      const cause = getCause(() => fromFormData(tamperRoot(form, 'e', value)));
      expect(cause).toBeInstanceOf(SerovalPluginValidationError);
      expect(cause).toMatchObject({ field: 'e' });
    }
  });

  it('reads the form fields once, however many blobs the value has', async () => {
    const blobs: Blob[] = [];
    for (let i = 0; i < 100; i++) {
      blobs.push(new Blob([String(i)]));
    }
    const form = await toFormData(blobs);
    const get = vi.spyOn(form, 'get');
    const result = fromFormData<Blob[]>(form);
    expect(result).toHaveLength(100);
    expect(await result[99].text()).toBe('99');
    // One read of the value field. The parts are indexed in one pass, since
    // `form.get` scans every entry.
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('refuses a request body that is not form data', async () => {
    const request = new Request('http://localhost/api', { method: 'POST', body: '{}' });
    await expect(fromFormRequest(request)).rejects.toThrow(SerovalTransportError);
  });
});
