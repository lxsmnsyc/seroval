import { createReference, fromCrossJSON, fromJSON, toJSON, toJSONAsync } from 'seroval';
import type { Plugin, SerovalNode } from 'seroval';
import { describe, expect, it, vi } from 'vitest';
import FormDataPlugin from '../../web/form-data';
import HeadersPlugin from '../../web/headers';
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

  it.each(['status', 'statusText', 'headers'])('rejects a coercible Response %s', async field => {
    const json = await toJSONAsync(new Response('body'), { plugins: [ResponsePlugin] });
    const options = toJSON({ [field]: { toString: toStringRef, valueOf: toStringRef } }).t;
    getFields(json.t).options = options;
    expectRejected(json, ResponsePlugin);
  });

  it.each(['body', 'method', 'referrer', 'headers', 'mode'])(
    'rejects a coercible Request %s',
    async field => {
      const json = await toJSONAsync(new Request('https://example.com'), {
        plugins: [RequestPlugin],
      });
      const options = toJSON({ [field]: { toString: toStringRef, valueOf: toStringRef } }).t;
      getFields(json.t).options = options;
      expectRejected(json, RequestPlugin);
    },
  );

  it('still decodes valid values', async () => {
    const form = new FormData();
    form.append('a', 'b');
    form.append('c', new Blob(['d']));
    const formBack = fromJSON<FormData>(
      await toJSONAsync(form, { plugins: [FormDataPlugin] }),
      { plugins: [FormDataPlugin] },
    );
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
  });
});
