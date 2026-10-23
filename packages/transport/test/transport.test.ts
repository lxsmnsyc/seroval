import { createLiveStream } from 'seroval';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  fromJSONStream,
  fromJSStream,
  SerovalFrameError,
  toJSONStream,
  toJSStream,
} from '../src';

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A stream that sends `bytes` in pieces of `size` bytes. */
function fromBytes(bytes: Uint8Array, size = bytes.length): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + size));
      offset += size;
    },
  });
}

/** A stream that sends `bytes`, then stays open. */
function openAfter(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
    },
  });
}

function frame(data: string): Uint8Array {
  const encoded = new TextEncoder().encode(data);
  const header = `;0x${encoded.length.toString(16).padStart(8, '0')};`;
  const bytes = new Uint8Array(12 + encoded.length);
  bytes.set(new TextEncoder().encode(header));
  bytes.set(encoded, 12);
  return bytes;
}

async function* numbers(): AsyncGenerator<number> {
  yield 1;
  await Promise.resolve();
  yield 2;
}

describe('JSON streams', () => {
  it('sends a value with promises and async iterables', async () => {
    const value = await fromJSONStream<{
      name: string;
      later: Promise<string>;
      items: AsyncIterable<number>;
    }>(toJSONStream({ name: 'Ada', later: Promise.resolve('done'), items: numbers() }));
    expect(value.name).toBe('Ada');
    await expect(value.later).resolves.toBe('done');
    const items: number[] = [];
    for await (const item of value.items) {
      items.push(item);
    }
    expect(items).toEqual([1, 2]);
  });

  it('reads frames split across chunks', async () => {
    const bytes = await collect(toJSONStream({ a: [1, 2, 3], b: Promise.resolve('é') }));
    const value = await fromJSONStream<{ a: number[]; b: Promise<string> }>(fromBytes(bytes, 1));
    expect(value.a).toEqual([1, 2, 3]);
    await expect(value.b).resolves.toBe('é');
  });

  it('fails pending values when the stream ends early', async () => {
    const bytes = await collect(toJSONStream({ later: Promise.resolve(1) }));
    // Keep only the first frame.
    const size = Number.parseInt(new TextDecoder().decode(bytes.subarray(3, 11)), 16);
    const value = await fromJSONStream<{ later: Promise<number> }>(
      fromBytes(bytes.subarray(0, 12 + size)),
    );
    await expect(value.later).rejects.toBeInstanceOf(SerovalFrameError);
  });

  it('reports a malformed frame after the first one', async () => {
    const bytes = await collect(toJSONStream({ later: Promise.resolve(1) }));
    const size = Number.parseInt(new TextDecoder().decode(bytes.subarray(3, 11)), 16);
    const broken = new Uint8Array(12 + size + 4);
    broken.set(bytes.subarray(0, 12 + size));
    broken.set(new TextEncoder().encode('oops'), 12 + size);
    const onError = vi.fn();
    const value = await fromJSONStream<{ later: Promise<number> }>(fromBytes(broken), {
      onError,
    });
    await expect(value.later).rejects.toBeInstanceOf(SerovalFrameError);
    expect(onError).toHaveBeenCalledWith(expect.any(SerovalFrameError));
  });

  it('rejects an empty stream', async () => {
    await expect(fromJSONStream(fromBytes(new Uint8Array(0)))).rejects.toBeInstanceOf(
      SerovalFrameError,
    );
  });

  it('rejects a malformed header', async () => {
    await expect(
      fromJSONStream(fromBytes(new TextEncoder().encode(';0xzzzzzzzz;'))),
    ).rejects.toBeInstanceOf(SerovalFrameError);
  });

  it('rejects a frame larger than maxFrameSize', async () => {
    await expect(
      fromJSONStream(toJSONStream({ text: 'x'.repeat(100) }), { maxFrameSize: 10 }),
    ).rejects.toThrow('larger than the limit of 10 bytes');
  });

  it('fails pending values when the signal aborts', async () => {
    const bytes = await collect(toJSONStream({ later: Promise.resolve(1) }));
    const size = Number.parseInt(new TextDecoder().decode(bytes.subarray(3, 11)), 16);
    const controller = new AbortController();
    const value = await fromJSONStream<{ later: Promise<number> }>(
      openAfter(bytes.subarray(0, 12 + size)),
      { signal: controller.signal },
    );
    const reason = new Error('stop');
    controller.abort(reason);
    await expect(value.later).rejects.toBe(reason);
  });

  it('rejects when the signal aborts before the first frame', async () => {
    const controller = new AbortController();
    const reason = new Error('stop');
    const result = fromJSONStream(new ReadableStream(), { signal: controller.signal });
    controller.abort(reason);
    await expect(result).rejects.toBe(reason);
  });

  it('does not cause unhandled rejections for ignored promises', async () => {
    const onUnhandled = vi.fn();
    process.on('unhandledRejection', onUnhandled);
    try {
      const bytes = await collect(
        toJSONStream({ failed: Promise.reject(new Error('ignored')), later: Promise.resolve(1) }),
      );
      const size = Number.parseInt(new TextDecoder().decode(bytes.subarray(3, 11)), 16);
      // The first frame holds both promises; the rest settles them.
      await fromJSONStream(fromBytes(bytes));
      await fromJSONStream(fromBytes(bytes.subarray(0, 12 + size)));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(onUnhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});

describe('backpressure and cancel', () => {
  it('holds back frames while the reader is slow', async () => {
    const { stream, producer } = createLiveStream<string>();
    let delivered = 0;
    const producing = (async () => {
      for (let i = 0; i < 20; i++) {
        await producer.write('x'.repeat(100));
        delivered++;
      }
    })().catch(() => {});
    const body = toJSONStream({ stream }, { highWaterMark: 1 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(delivered).toBeLessThan(5);
    await body.cancel();
    await producing;
  });

  it('stops the sources when the stream is cancelled', async () => {
    const onCancel = vi.fn();
    const { stream } = createLiveStream<number>({ onCancel });
    const body = toJSONStream({ stream });
    const reader = body.getReader();
    await reader.read();
    await reader.cancel();
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('JS streams', () => {
  // The frames declare `$R` on `self`, which Node does not define.
  beforeAll(() => {
    (globalThis as { self?: unknown }).self = globalThis;
  });
  afterAll(() => {
    delete (globalThis as { self?: unknown }).self;
  });

  it('sends a value with promises', async () => {
    const value = await fromJSStream<{ name: string; later: Promise<string> }>(
      toJSStream({ name: 'Ada', later: Promise.resolve('done') }, { scopeId: 'round-trip' }),
      { scopeId: 'round-trip' },
    );
    expect(value.name).toBe('Ada');
    await expect(value.later).resolves.toBe('done');
  });

  it('fails pending values and releases the scope when the stream ends early', async () => {
    const bytes = await collect(
      toJSStream({ later: Promise.resolve(1) }, { scopeId: 'early-end' }),
    );
    const size = Number.parseInt(new TextDecoder().decode(bytes.subarray(3, 11)), 16);
    const value = await fromJSStream<{ later: Promise<number> }>(
      fromBytes(bytes.subarray(0, 12 + size)),
      { scopeId: 'early-end' },
    );
    await expect(value.later).rejects.toBeInstanceOf(SerovalFrameError);
    const scopes = (globalThis as { $R?: Record<string, unknown> }).$R;
    expect(scopes?.['early-end']).toBeUndefined();
  });
});

it('frames each node with a length prefix', async () => {
  const bytes = await collect(toJSONStream('abc'));
  const node = new TextDecoder().decode(bytes.subarray(12));
  expect(bytes).toEqual(frame(node));
  expect(JSON.parse(node)).toEqual({ t: 1, s: 'abc' });
});
