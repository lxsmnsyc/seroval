import { describe, expect, it } from 'vitest';
import ResponsePlugin from '../../../web/response';
import { roundtrip, startDeserialize, startSerialize } from './utils';

const PLUGINS = [ResponsePlugin];

describe('binary Response', () => {
  it('supports Response', async () => {
    const source = new Response('Hello World', {
      status: 201,
      statusText: 'Created',
      headers: { 'content-type': 'text/plain' },
    });

    const { value, done } = await roundtrip<Response>(source, PLUGINS);
    expect(value).toBeInstanceOf(Response);
    expect(value.status).toBe(201);
    expect(value.statusText).toBe('Created');
    expect(value.headers.get('content-type')).toBe('text/plain');
    expect(await value.text()).toBe('Hello World');
    await done;
  });

  it('supports a bodyless Response', async () => {
    const { value } = await roundtrip<Response>(
      new Response(null, { status: 204 }),
      PLUGINS,
    );
    expect(value.status).toBe(204);
    expect(value.body).toBe(null);
  });

  it('supports an already read Response', async () => {
    const source = new Response('consumed');
    await source.text();

    const { value } = await roundtrip<Response>(source, PLUGINS);
    expect(value.body).toBe(null);
    expect(value.status).toBe(200);
  });

  it('streams the body as it arrives', async () => {
    let push!: (chunk: string) => void;
    let stop!: () => void;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        push = chunk => controller.enqueue(encoder.encode(chunk));
        stop = () => controller.close();
      },
    });

    const handle = startSerialize(new Response(body), PLUGINS);
    const result = await startDeserialize<Response>(handle.transport, PLUGINS);
    const reader = result.value.body?.getReader();
    expect(reader).toBeDefined();

    push('first');
    const first = await reader?.read();
    expect(new TextDecoder().decode(first?.value)).toBe('first');

    stop();
    expect((await reader?.read())?.done).toBe(true);
    await handle.done;
  });

  it('supports error status codes', async () => {
    const { value } = await roundtrip<Response>(
      new Response('nope', { status: 503, statusText: 'Service Unavailable' }),
      PLUGINS,
    );
    expect(value.status).toBe(503);
    expect(value.ok).toBe(false);
    expect(await value.text()).toBe('nope');
  });

  it('supports Responses nested in structures', async () => {
    const { value } = await roundtrip<{ response: Response }>(
      { response: new Response('nested') },
      PLUGINS,
    );
    expect(value.response).toBeInstanceOf(Response);
    expect(await value.response.text()).toBe('nested');
  });
});
