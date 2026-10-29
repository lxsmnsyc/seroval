import { createReference, fromCrossJSON, fromJSON, toJSON, toJSONAsync } from 'seroval';
import type { Plugin, SerovalJSON, SerovalNode } from 'seroval';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CustomEventPlugin from '../../web/custom-event';
import EventPlugin from '../../web/event';
import FilePlugin from '../../web/file';
import FormDataPlugin from '../../web/form-data';
import HeadersPlugin from '../../web/headers';
import ImageDataPlugin from '../../web/image-data';
import RequestPlugin from '../../web/request';
import ResponsePlugin from '../../web/response';

// A Web constructor converts a plain object to a string or a number, which
// calls its `toString` or `valueOf`. A callable is only reachable through a
// registered reference, so each case aims a field at an object carrying one
// and checks the decoder rejects it before the call.
const spy = vi.fn(() => 'called');
const toStringRef = createReference('test/coercion-to-string', spy);

function createCoercible(): SerovalNode {
  return toJSON({ toString: toStringRef, valueOf: toStringRef }).t;
}

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The test builds malformed input on purpose.
function getFields(node: SerovalNode): Record<string, SerovalNode> {
  return (node as unknown as { s: Record<string, SerovalNode> }).s;
}

function createCoercibleField(field: string): SerovalNode {
  return toJSON({ [field]: { toString: toStringRef, valueOf: toStringRef } }).t;
}

function expectRejected(json: { t: SerovalNode }, plugin: Plugin<any, any>): void {
  spy.mockClear();
  expect(() => fromJSON(json as never, { plugins: [plugin] })).toThrow();
  expect(() => fromCrossJSON(json.t, { plugins: [plugin], refs: new Map() })).toThrow();
  expect(spy).not.toHaveBeenCalled();
}

describe('Web constructor coercion', () => {
  it('rejects a coercible FormData entry value', () => {
    const form = new FormData();
    form.append('key', 'value');
    const json = toJSON(form, { plugins: [FormDataPlugin] });
    getFields(json.t).entries = toJSON([['key', { toString: toStringRef }]]).t;
    expectRejected(json, FormDataPlugin);
  });

  it('rejects a coercible FormData entry key', () => {
    const json = toJSON(new FormData(), { plugins: [FormDataPlugin] });
    getFields(json.t).entries = toJSON([[{ toString: toStringRef }, 'value']]).t;
    expectRejected(json, FormDataPlugin);
  });

  it('rejects FormData entries that are not pairs', () => {
    const json = toJSON(new FormData(), { plugins: [FormDataPlugin] });
    getFields(json.t).entries = createCoercible();
    expectRejected(json, FormDataPlugin);
  });

  it('rejects a coercible Headers value', () => {
    const json = toJSON(new Headers(), { plugins: [HeadersPlugin] });
    getFields(json.t).value = toJSON([['x-test', { toString: toStringRef }]]).t;
    expectRejected(json, HeadersPlugin);
  });

  it('rejects a Headers record', () => {
    const json = toJSON(new Headers(), { plugins: [HeadersPlugin] });
    getFields(json.t).value = toJSON({ 'x-test': { toString: toStringRef } }).t;
    expectRejected(json, HeadersPlugin);
  });

  it('rejects a coercible Response body', async () => {
    const json = await toJSONAsync(new Response('body'), { plugins: [ResponsePlugin] });
    getFields(json.t).body = createCoercible();
    expectRejected(json, ResponsePlugin);
  });

  it.each(['status', 'statusText', 'headers'])('rejects a coercible Response %s', async (field) => {
    const json = await toJSONAsync(new Response('body'), { plugins: [ResponsePlugin] });
    const options = toJSON({ [field]: { toString: toStringRef, valueOf: toStringRef } }).t;
    getFields(json.t).options = options;
    expectRejected(json, ResponsePlugin);
  });

  it.each(['body', 'method', 'referrer', 'headers', 'mode'])(
    'rejects a coercible Request %s',
    async (field) => {
      const json = await toJSONAsync(new Request('https://example.com'), {
        plugins: [RequestPlugin],
      });
      const options = toJSON({ [field]: { toString: toStringRef, valueOf: toStringRef } }).t;
      getFields(json.t).options = options;
      expectRejected(json, RequestPlugin);
    },
  );

  it.each(['type', 'lastModified'])('rejects a coercible File %s', async (field) => {
    const json = await toJSONAsync(new File(['body'], 'a.txt'), { plugins: [FilePlugin] });
    getFields(json.t).options = createCoercibleField(field);
    expectRejected(json, FilePlugin);
  });

  it('rejects File options that are not an object', async () => {
    const json = await toJSONAsync(new File(['body'], 'a.txt'), { plugins: [FilePlugin] });
    getFields(json.t).options = toJSON('text/plain').t;
    expectRejected(json, FilePlugin);
  });

  it.each(['bubbles', 'cancelable', 'composed'])(
    'rejects an Event %s that is not a boolean',
    (field) => {
      const json = toJSON(new Event('test'), { plugins: [EventPlugin] });
      getFields(json.t).options = createCoercibleField(field);
      expectRejected(json, EventPlugin);
    },
  );

  it.each(['bubbles', 'cancelable', 'composed'])(
    'rejects a CustomEvent %s that is not a boolean',
    (field) => {
      const json = toJSON(new CustomEvent('test'), { plugins: [CustomEventPlugin] });
      getFields(json.t).options = createCoercibleField(field);
      expectRejected(json, CustomEventPlugin);
    },
  );

  describe('ImageData', () => {
    // Node has no ImageData, so a stand-in records what the decoder passes.
    const construct = vi.fn();
    class FakeImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      colorSpace: string;
      constructor(data: unknown, width: unknown, height: unknown, settings?: ImageDataSettings) {
        construct(data, width, height, settings);
        // Convert the way the real constructor does, so a coercible value
        // would call the spy.
        this.data = data instanceof Uint8ClampedArray ? data : new Uint8ClampedArray(Number(data));
        this.width = Number(width);
        this.height = Number(height);
        this.colorSpace = settings?.colorSpace ?? 'srgb';
      }
    }

    function createImageDataJSON(): SerovalJSON {
      vi.stubGlobal('ImageData', FakeImageData);
      const json = toJSON(new FakeImageData(new Uint8ClampedArray(4), 1, 1), {
        plugins: [ImageDataPlugin],
      });
      construct.mockClear();
      return json;
    }

    afterEach(() => {
      vi.unstubAllGlobals();
      construct.mockClear();
    });

    it('rejects coercible data', () => {
      const json = createImageDataJSON();
      getFields(json.t).data = createCoercible();
      expectRejected(json, ImageDataPlugin);
      expect(construct).not.toHaveBeenCalled();
    });

    it('rejects a coercible colorSpace', () => {
      const json = createImageDataJSON();
      getFields(json.t).options = createCoercibleField('colorSpace');
      expectRejected(json, ImageDataPlugin);
      expect(construct).not.toHaveBeenCalled();
    });

    it('still decodes a valid ImageData', () => {
      const json = createImageDataJSON();
      const back = fromJSON<FakeImageData>(json, { plugins: [ImageDataPlugin] });
      expect(back).toBeInstanceOf(FakeImageData);
      expect(back.width).toBe(1);
      expect(back.colorSpace).toBe('srgb');
    });
  });

  it('still decodes valid values', async () => {
    const form = new FormData();
    form.append('a', 'b');
    form.append('c', new Blob(['d']));
    const formBack = fromJSON<FormData>(await toJSONAsync(form, { plugins: [FormDataPlugin] }), {
      plugins: [FormDataPlugin],
    });
    expect(formBack.get('a')).toBe('b');
    expect(formBack.get('c')).toBeInstanceOf(Blob);

    const response = new Response('body', {
      status: 201,
      statusText: 'Created',
      headers: { 'x-test': 'a' },
    });
    const responseBack = fromJSON<Response>(
      await toJSONAsync(response, { plugins: [ResponsePlugin] }),
      { plugins: [ResponsePlugin] },
    );
    expect(responseBack.status).toBe(201);
    expect(responseBack.statusText).toBe('Created');
    expect(responseBack.headers.get('x-test')).toBe('a');
    expect(await responseBack.text()).toBe('body');

    const request = new Request('https://example.com', {
      method: 'POST',
      body: 'body',
      headers: { 'x-test': 'a' },
    });
    const requestBack = fromJSON<Request>(
      await toJSONAsync(request, { plugins: [RequestPlugin] }),
      { plugins: [RequestPlugin] },
    );
    expect(requestBack.method).toBe('POST');
    expect(requestBack.headers.get('x-test')).toBe('a');
    expect(await requestBack.text()).toBe('body');

    const file = new File(['body'], 'a.txt', { type: 'text/plain', lastModified: 1000 });
    const fileBack = fromJSON<File>(await toJSONAsync(file, { plugins: [FilePlugin] }), {
      plugins: [FilePlugin],
    });
    expect(fileBack.name).toBe('a.txt');
    expect(fileBack.type).toBe('text/plain');
    expect(fileBack.lastModified).toBe(1000);
    expect(await fileBack.text()).toBe('body');

    const event = new Event('test', { bubbles: true, cancelable: true });
    const eventBack = fromJSON<Event>(toJSON(event, { plugins: [EventPlugin] }), {
      plugins: [EventPlugin],
    });
    expect(eventBack.type).toBe('test');
    expect(eventBack.bubbles).toBe(true);
    expect(eventBack.cancelable).toBe(true);

    const custom = new CustomEvent('test', { detail: { a: 1 }, composed: true });
    const customBack = fromJSON<CustomEvent>(toJSON(custom, { plugins: [CustomEventPlugin] }), {
      plugins: [CustomEventPlugin],
    });
    expect(customBack.detail).toEqual({ a: 1 });
    expect(customBack.composed).toBe(true);
  });
});
