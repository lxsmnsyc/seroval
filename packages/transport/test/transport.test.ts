import { createLiveStream } from 'seroval';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Message, Reader } from '../src';
import {
  createJSONReader,
  createJSONWriter,
  createJSReader,
  createJSWriter,
  fromJSONStream,
  fromWebStream,
  SerovalTransportError,
  toJSONStream,
  toJSStream,
  toWebStream,
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

/** The bytes of the first frame of `bytes`. */
function firstFrame(bytes: Uint8Array): Uint8Array {
  const size = Number.parseInt(new TextDecoder().decode(bytes.subarray(3, 11)), 16);
  return bytes.subarray(0, 12 + size);
}

function frame(data: string): Uint8Array {
  const encoded = new TextEncoder().encode(data);
  const header = `;0x${encoded.length.toString(16).padStart(8, '0')};`;
  const bytes = new Uint8Array(12 + encoded.length);
  bytes.set(new TextEncoder().encode(header));
  bytes.set(encoded, 12);
  return bytes;
}

/** Sends each message through `structuredClone`, as `postMessage` does. */
function pipeTo(reader: Reader): (message: Message) => void {
  return (message) => reader.push(structuredClone(message));
}

async function* numbers(): AsyncGenerator<number> {
  yield 1;
  await Promise.resolve();
  yield 2;
}

describe('JSON messages', () => {
  it('sends a value with promises and async iterables', async () => {
    const reader = fromJSONStream<{
      name: string;
      later: Promise<string>;
      items: AsyncIterable<number>;
    }>();
    toJSONStream(
      { name: 'Ada', later: Promise.resolve('done'), items: numbers() },
      { send: (message) => reader.push(structuredClone(message)) },
    );
    const value = await reader.value;
    expect(value.name).toBe('Ada');
    await expect(value.later).resolves.toBe('done');
    const items: number[] = [];
    for await (const item of value.items) {
      items.push(item);
    }
    expect(items).toEqual([1, 2]);
  });

  it('sends many values under keys', async () => {
    const reader = createJSONReader();
    const writer = createJSONWriter({ send: pipeTo(reader) });
    const user = reader.get<{ name: string }>('user');
    writer.write('user', { name: 'Ada' });
    const key = writer.push({ later: Promise.resolve(2) });
    expect(key).toBe('0');
    expect(writer.push('next')).toBe('1');
    writer.flush();
    expect((await user).name).toBe('Ada');
    const pushed = await reader.get<{ later: Promise<number> }>(key);
    await expect(pushed.later).resolves.toBe(2);
    await expect(reader.get('1')).resolves.toBe('next');
  });

  it('skips written keys when it picks a number', () => {
    const writer = createJSONWriter({ send() {} });
    writer.write('0', 'a');
    expect(writer.push('b')).toBe('1');
  });

  it('refuses to write a key twice', () => {
    const writer = createJSONWriter({ send() {} });
    writer.write('a', Promise.resolve(1));
    expect(() => writer.write('a', 2)).toThrow(SerovalTransportError);
  });

  it('sends each message as an array tagged with its key', () => {
    const messages: Message[] = [];
    toJSONStream('abc', { send: (message) => void messages.push(message) });
    expect(messages).toEqual([
      [0, '0', { t: 1, s: 'abc' }],
      [1, '0'],
    ]);
  });

  it('keeps references within a value, not across values', async () => {
    const reader = createJSONReader();
    const writer = createJSONWriter({ send: pipeTo(reader) });
    const shared = { id: 1 };
    writer.write('a', [shared, shared]);
    writer.write('b', shared);
    const a = await reader.get<{ id: number }[]>('a');
    const b = await reader.get<{ id: number }>('b');
    expect(a[0]).toBe(a[1]);
    expect(b).not.toBe(a[0]);
    expect(b).toEqual(a[0]);
  });

  it('keeps references across values with sharedRefs', async () => {
    const reader = createJSONReader({ sharedRefs: true });
    const writer = createJSONWriter({ send: pipeTo(reader), sharedRefs: true });
    const shared = { id: 1 };
    writer.write('a', shared);
    writer.write('b', { shared });
    const a = await reader.get('a');
    const b = await reader.get<{ shared: unknown }>('b');
    expect(b.shared).toBe(a);
  });

  it('calls onDone once every value is done after flush', async () => {
    const onDone = vi.fn();
    const writer = createJSONWriter({ send() {}, onDone });
    writer.write('a', Promise.resolve(1));
    writer.flush();
    expect(onDone).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('fails a value it cannot serialize and reports the error', async () => {
    const onError = vi.fn();
    const reader = createJSONReader();
    const writer = createJSONWriter({ send: pipeTo(reader), onError });
    writer.write('bad', { fn: Symbol('local') });
    writer.write('good', 1);
    await expect(reader.get('bad')).rejects.toBeInstanceOf(SerovalTransportError);
    await expect(reader.get('good')).resolves.toBe(1);
    expect(onError).toHaveBeenCalledWith(expect.anything(), 'bad');
  });

  it('cancels one value on the writer, which stops its sources', async () => {
    const onCancel = vi.fn();
    const { stream } = createLiveStream<number>({ onCancel });
    const reader = createJSONReader();
    const writer = createJSONWriter({ send: pipeTo(reader) });
    writer.write('live', { stream, later: new Promise(() => {}) });
    writer.write('other', Promise.resolve('kept'));
    const live = await reader.get<{ later: Promise<never> }>('live');
    writer.cancel('live');
    expect(onCancel).toHaveBeenCalled();
    await expect(live.later).rejects.toBeInstanceOf(SerovalTransportError);
    await expect(await reader.get('other')).toBe('kept');
  });

  it('fails every open value when the writer closes', async () => {
    const onDone = vi.fn();
    const reader = createJSONReader();
    const writer = createJSONWriter({ send: pipeTo(reader), onDone });
    writer.write('a', { later: new Promise(() => {}) });
    const a = await reader.get<{ later: Promise<never> }>('a');
    writer.close();
    expect(onDone).toHaveBeenCalledTimes(1);
    await expect(a.later).rejects.toBeInstanceOf(SerovalTransportError);
  });

  it('cancels one value on the reader, and drops its later messages', async () => {
    const reader = createJSONReader();
    const writer = createJSONWriter({ send: pipeTo(reader) });
    let resolve!: (value: number) => void;
    writer.write('a', { later: new Promise<number>((res) => (resolve = res)) });
    const a = await reader.get<{ later: Promise<number> }>('a');
    const reason = new Error('stop');
    reader.cancel('a', reason);
    await expect(a.later).rejects.toBe(reason);
    resolve(1);
    await new Promise((done) => setTimeout(done, 0));
    // The writer's later messages for "a" did not throw.
    writer.write('b', 2);
    await expect(reader.get('b')).resolves.toBe(2);
  });

  it('fails what still waits when the reader ends', async () => {
    const reader = createJSONReader();
    const writer = createJSONWriter({ send: pipeTo(reader) });
    writer.write('a', { later: new Promise(() => {}) });
    const a = await reader.get<{ later: Promise<never> }>('a');
    const missing = reader.get('never');
    reader.end();
    await expect(a.later).rejects.toThrow('every value settled');
    await expect(missing).rejects.toThrow('before "never" arrived');
    await expect(reader.get('later')).rejects.toBeInstanceOf(SerovalTransportError);
  });

  it('refuses malformed messages', () => {
    const reader = createJSONReader();
    expect(() => reader.push({})).toThrow(SerovalTransportError);
    expect(() => reader.push([0, 1, {}])).toThrow(SerovalTransportError);
    expect(() => reader.push([1, 'a'])).toThrow(SerovalTransportError);
    reader.push([0, 'b', { t: 1, s: 'x' }]);
    reader.push([1, 'b']);
    expect(() => reader.push([0, 'b', { t: 1, s: 'x' }])).toThrow(SerovalTransportError);
  });

  it('holds back the next message while send waits', async () => {
    const { stream, producer } = createLiveStream<string>();
    let delivered = 0;
    const producing = (async () => {
      for (let i = 0; i < 20; i++) {
        await producer.write('x');
        delivered++;
      }
    })().catch(() => {});
    const writer = toJSONStream({ stream }, { send: () => new Promise<void>(() => {}) });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(delivered).toBeLessThan(5);
    writer.close();
    await producing;
  });

  it('does not cause unhandled rejections for ignored values', async () => {
    const onUnhandled = vi.fn();
    process.on('unhandledRejection', onUnhandled);
    try {
      const reader = createJSONReader();
      const writer = createJSONWriter({ send: pipeTo(reader) });
      writer.write('a', { failed: Promise.reject(new Error('ignored')) });
      writer.write('b', { fn: Symbol('local') });
      writer.write('c', { later: new Promise(() => {}) });
      reader.get('never');
      await new Promise((resolve) => setTimeout(resolve, 0));
      reader.end();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(onUnhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});

describe('Web Streams', () => {
  function toBody(value: unknown, highWaterMark?: number): ReadableStream<Uint8Array> {
    return toWebStream((sink) => toJSONStream(value, sink), { highWaterMark });
  }

  it('sends many values over one stream', async () => {
    const body = toWebStream((sink) => {
      const writer = createJSONWriter(sink);
      writer.write('user', { name: 'Ada' });
      writer.write('posts', Promise.resolve(['a', 'b']));
      writer.flush();
      return writer;
    });
    const reader = createJSONReader();
    void fromWebStream(body, reader);
    expect(await reader.get('user')).toEqual({ name: 'Ada' });
    await expect(reader.get('posts')).resolves.toEqual(['a', 'b']);
  });

  it('reads frames split across chunks', async () => {
    const bytes = await collect(toBody({ a: [1, 2, 3], b: Promise.resolve('é') }));
    const reader = fromJSONStream<{ a: number[]; b: Promise<string> }>();
    void fromWebStream(fromBytes(bytes, 1), reader);
    const value = await reader.value;
    expect(value.a).toEqual([1, 2, 3]);
    await expect(value.b).resolves.toBe('é');
  });

  it('fails pending values when the stream ends early', async () => {
    const bytes = await collect(toBody({ later: Promise.resolve(1) }));
    const reader = fromJSONStream<{ later: Promise<number> }>();
    void fromWebStream(fromBytes(firstFrame(bytes)), reader);
    const value = await reader.value;
    await expect(value.later).rejects.toBeInstanceOf(SerovalTransportError);
  });

  it('rejects the value of an empty stream', async () => {
    const reader = fromJSONStream();
    await fromWebStream(fromBytes(new Uint8Array(0)), reader);
    await expect(reader.value).rejects.toBeInstanceOf(SerovalTransportError);
  });

  it('reports a malformed frame', async () => {
    const bytes = firstFrame(await collect(toBody({ later: Promise.resolve(1) })));
    const broken = new Uint8Array(bytes.length + 4);
    broken.set(bytes);
    broken.set(new TextEncoder().encode('oops'), bytes.length);
    const onError = vi.fn();
    const reader = fromJSONStream<{ later: Promise<number> }>();
    await fromWebStream(fromBytes(broken), reader, { onError });
    await expect((await reader.value).later).rejects.toBeInstanceOf(SerovalTransportError);
    expect(onError).toHaveBeenCalledWith(expect.any(SerovalTransportError));
  });

  it('reports a malformed message', async () => {
    const onError = vi.fn();
    const reader = fromJSONStream();
    await fromWebStream(fromBytes(frame('{"not":"a message"}')), reader, { onError });
    await expect(reader.value).rejects.toBeInstanceOf(SerovalTransportError);
    expect(onError).toHaveBeenCalledWith(expect.any(SerovalTransportError));
  });

  it('refuses a frame larger than maxFrameSize', async () => {
    const onError = vi.fn();
    const reader = fromJSONStream();
    await fromWebStream(toBody({ text: 'x'.repeat(100) }), reader, { maxFrameSize: 10, onError });
    await expect(reader.value).rejects.toThrow('larger than the limit of 10 bytes');
  });

  it('ends the reader when the signal aborts', async () => {
    const bytes = await collect(toBody({ later: Promise.resolve(1) }));
    const controller = new AbortController();
    const reader = fromJSONStream<{ later: Promise<number> }>();
    const reading = fromWebStream(openAfter(firstFrame(bytes)), reader, {
      signal: controller.signal,
    });
    const value = await reader.value;
    const reason = new Error('stop');
    controller.abort(reason);
    await expect(value.later).rejects.toBe(reason);
    await reading;
  });

  it('ends the reader when the signal aborted before it started', async () => {
    const controller = new AbortController();
    const reason = new Error('stop');
    controller.abort(reason);
    const reader = fromJSONStream();
    await fromWebStream(new ReadableStream(), reader, { signal: controller.signal });
    await expect(reader.value).rejects.toBe(reason);
  });

  it('holds back frames while the stream is not read', async () => {
    const { stream, producer } = createLiveStream<string>();
    let delivered = 0;
    const producing = (async () => {
      for (let i = 0; i < 20; i++) {
        await producer.write('x'.repeat(100));
        delivered++;
      }
    })().catch(() => {});
    const body = toBody({ stream }, 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(delivered).toBeLessThan(5);
    await body.cancel();
    await producing;
  });

  it('holds back every value while the stream is not read', async () => {
    const counts = [0, 0];
    const live = [createLiveStream<string>(), createLiveStream<string>()];
    const producing = live.map(({ producer }, index) =>
      (async () => {
        for (let i = 0; i < 20; i++) {
          await producer.write('x'.repeat(100));
          counts[index]++;
        }
      })().catch(() => {}),
    );
    const body = toWebStream(
      (sink) => {
        const writer = createJSONWriter(sink);
        writer.write('a', live[0].stream);
        writer.write('b', live[1].stream);
        return writer;
      },
      { highWaterMark: 1 },
    );
    const bodyReader = body.getReader();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(counts[0]).toBeLessThan(5);
    expect(counts[1]).toBeLessThan(5);
    // Reading lets both values go on.
    for (let i = 0; i < 20; i++) {
      await bodyReader.read();
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(counts[0]).toBeGreaterThan(1);
    expect(counts[1]).toBeGreaterThan(1);
    await bodyReader.cancel();
    await Promise.all(producing);
  });

  it('stops the sources when the stream is cancelled', async () => {
    const onCancel = vi.fn();
    const { stream } = createLiveStream<number>({ onCancel });
    const reader = toBody({ stream }).getReader();
    await reader.read();
    await reader.cancel();
    expect(onCancel).toHaveBeenCalled();
  });

  it('frames each message with a length prefix', async () => {
    const bytes = await collect(toBody('abc'));
    const data = new TextDecoder().decode(firstFrame(bytes).subarray(12));
    expect(firstFrame(bytes)).toEqual(frame(data));
    expect(JSON.parse(data)).toEqual([0, '0', { t: 1, s: 'abc' }]);
  });
});

describe('JS messages', () => {
  // The messages declare `$R` on `self`, which Node does not define.
  beforeAll(() => {
    (globalThis as { self?: unknown }).self = globalThis;
  });
  afterAll(() => {
    delete (globalThis as { self?: unknown }).self;
  });

  it('sends many values that share references', async () => {
    const reader = createJSReader({ scopeId: 'shared' });
    const writer = createJSWriter({ scopeId: 'shared', send: pipeTo(reader) });
    const shared = { id: 1 };
    writer.write('a', shared);
    writer.write('b', { shared, later: Promise.resolve('done') });
    const a = await reader.get('a');
    const b = await reader.get<{ shared: unknown; later: Promise<string> }>('b');
    expect(b.shared).toBe(a);
    await expect(b.later).resolves.toBe('done');
  });

  it('fails pending values and releases the scope when the stream ends early', async () => {
    const bytes = await collect(
      toWebStream((sink) =>
        toJSStream({ later: Promise.resolve(1) }, { ...sink, scopeId: 'early-end' }),
      ),
    );
    const reader = createJSReader({ scopeId: 'early-end' });
    void fromWebStream(fromBytes(firstFrame(bytes)), reader);
    const value = await reader.get<{ later: Promise<number> }>('0');
    await expect(value.later).rejects.toBeInstanceOf(SerovalTransportError);
    const scopes = (globalThis as { $R?: Record<string, unknown> }).$R;
    expect(scopes?.['early-end']).toBeUndefined();
  });
});
