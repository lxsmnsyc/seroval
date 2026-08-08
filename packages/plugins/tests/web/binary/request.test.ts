import { describe, expect, it } from 'vitest';
import RequestPlugin from '../../../web/request';
import { captureSerializeError, roundtrip } from './utils';

const PLUGINS = [RequestPlugin];
const EXAMPLE_URL = 'http://localhost:3000/';

describe('binary Request', () => {
  it('supports a bodyless Request', async () => {
    const source = new Request(EXAMPLE_URL, {
      method: 'GET',
      headers: { 'x-custom': 'value' },
    });

    const { value } = await roundtrip<Request>(source, PLUGINS);
    expect(value).toBeInstanceOf(Request);
    expect(value.url).toBe(EXAMPLE_URL);
    expect(value.method).toBe('GET');
    expect(value.headers.get('x-custom')).toBe('value');
    expect(value.body).toBe(null);
  });

  it('supports an already read Request', async () => {
    const source = new Request(EXAMPLE_URL, {
      method: 'POST',
      body: 'Hello World!',
    });
    await source.text();

    const { value } = await roundtrip<Request>(source, PLUGINS);
    expect(value.body).toBe(null);
    expect(value.method).toBe('POST');
    expect(value.url).toBe(EXAMPLE_URL);
  });

  it('carries the request metadata', async () => {
    const source = new Request(EXAMPLE_URL, {
      method: 'PUT',
      cache: 'no-store',
      credentials: 'include',
      integrity: 'sha256-abc',
      keepalive: true,
      mode: 'cors',
      redirect: 'manual',
      referrerPolicy: 'no-referrer',
    });

    const { value } = await roundtrip<Request>(source, PLUGINS);
    expect(value.method).toBe('PUT');
    expect(value.cache).toBe('no-store');
    expect(value.credentials).toBe('include');
    expect(value.integrity).toBe('sha256-abc');
    expect(value.keepalive).toBe(true);
    expect(value.redirect).toBe('manual');
    expect(value.referrerPolicy).toBe('no-referrer');
  });

  it('supports a Request with a body', async () => {
    // Binary mode hands `new Request()` the body as a ReadableStream (the
    // async tree mode sends an ArrayBuffer instead), which the constructor
    // only accepts alongside `duplex: 'half'`.
    const source = new Request(EXAMPLE_URL, {
      method: 'POST',
      body: 'Hello World!',
    });

    const { value, done } = await roundtrip<Request>(source, PLUGINS);
    expect(value).toBeInstanceOf(Request);
    expect(value.method).toBe('POST');
    expect(await value.text()).toBe('Hello World!');
    await done;
  });

  it('streams a request body as it arrives', async () => {
    let push!: (chunk: string) => void;
    let stop!: () => void;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        push = chunk => controller.enqueue(encoder.encode(chunk));
        stop = () => controller.close();
      },
    });
    const source = new Request(EXAMPLE_URL, {
      method: 'POST',
      body,
      duplex: 'half',
    } as RequestInit);

    const { value } = await roundtrip<Request>(source, PLUGINS);
    const reader = value.body?.getReader();
    push('chunk');
    const first = await reader?.read();
    expect(new TextDecoder().decode(first?.value)).toBe('chunk');
    stop();
    expect((await reader?.read())?.done).toBe(true);
  });

  it('serializes a Request with a body without error', async () => {
    const source = new Request(EXAMPLE_URL, {
      method: 'POST',
      body: 'Hello World!',
    });
    expect(await captureSerializeError(source, PLUGINS)).toBeUndefined();
  });
});
