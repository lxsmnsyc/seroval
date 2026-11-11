import { createLiveStream } from 'seroval';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { Message, Reader } from '../src/binary';
import {
  createBinaryReader,
  createBinaryWriter,
  fromBinaryStream,
  SerovalTransportError,
  toBinaryStream,
} from '../src/binary';
import { createFrameDecoder, encodeFrame } from '../src/frame';
import { fromNodeStream, toNodeStream } from '../src/node';
import { fromResponse, fromWebStream, toResponse, toWebStream } from '../src/web';

/** Sends each message through `structuredClone`, as `postMessage` does. */
function pipeTo(reader: Pick<Reader, 'push'>): (message: Message) => void {
  return (message) => reader.push(structuredClone(message));
}

async function* numbers(): AsyncGenerator<number> {
  yield 1;
  await Promise.resolve();
  yield 2;
}

async function collectItems<T>(items: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of items) {
    result.push(item);
  }
  return result;
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('binary messages', () => {
  it('sends a value with promises and async iterables', async () => {
    const reader = fromBinaryStream<{
      name: string;
      bytes: Uint8Array;
      later: Promise<string>;
      items: AsyncIterable<number>;
    }>();
    toBinaryStream(
      {
        name: 'Ada',
        bytes: new Uint8Array([1, 2, 3]),
        later: Promise.resolve('done'),
        items: numbers(),
      },
      { send: pipeTo(reader) },
    );
    const value = await reader.value;
    expect(value.name).toBe('Ada');
    expect(value.bytes).toEqual(new Uint8Array([1, 2, 3]));
    await expect(value.later).resolves.toBe('done');
    expect(await collectItems(value.items)).toEqual([1, 2]);
    await expect(reader.settled).resolves.toBeUndefined();
  });

  it('sends each message with bytes as its data', () => {
    const messages: Message[] = [];
    toBinaryStream('abc', { send: (message) => void messages.push(message) });
    expect(messages.length).toBe(2);
    expect(messages[0][0]).toBe(0);
    expect(messages[0][1]).toBe('0');
    expect(messages[0][2]).toBeInstanceOf(Uint8Array);
    expect(messages[1]).toEqual([1, '0']);
  });

  it('sends many values under keys', async () => {
    const reader = createBinaryReader();
    const writer = createBinaryWriter({ send: pipeTo(reader) });
    const user = reader.get<{ name: string }>('user');
    writer.write('user', { name: 'Ada' });
    const key = writer.push({ later: Promise.resolve(2) });
    writer.push('next');
    writer.flush();
    expect((await user).name).toBe('Ada');
    const pushed = await reader.get<{ later: Promise<number> }>(key);
    await expect(pushed.later).resolves.toBe(2);
    await expect(reader.get('1')).resolves.toBe('next');
  });

  it('keeps references within a value, not across values', async () => {
    const reader = createBinaryReader();
    const writer = createBinaryWriter({ send: pipeTo(reader) });
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
    const reader = createBinaryReader({ sharedRefs: true });
    const writer = createBinaryWriter({ send: pipeTo(reader), sharedRefs: true });
    const shared = { id: 1 };
    writer.write('a', shared);
    writer.write('b', { shared });
    const a = await reader.get('a');
    const b = await reader.get<{ shared: unknown }>('b');
    expect(b.shared).toBe(a);
  });

  it('keeps references between values that stream at once with sharedRefs', async () => {
    const pool = Array.from({ length: 4 }, (_, id) => ({ id }));
    async function* items(offset: number): AsyncGenerator<object> {
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => {
          setTimeout(resolve, (offset * 5 + i) % 4);
        });
        yield pool[(offset + i) % pool.length];
      }
    }
    const reader = createBinaryReader({ sharedRefs: true });
    const writer = createBinaryWriter({ send: pipeTo(reader), sharedRefs: true });
    const keys: string[] = [];
    for (let i = 0; i < 10; i++) {
      keys.push(writer.push({ first: pool[i % pool.length], items: items(i) }));
    }
    writer.flush();
    const seen = new Map<number, object>();
    for (const key of keys) {
      const value = await reader.get<{
        first: { id: number };
        items: AsyncIterable<{ id: number }>;
      }>(key);
      for (const item of [value.first, ...(await collectItems(value.items))]) {
        const known = seen.get(item.id);
        if (known) {
          expect(item).toBe(known);
        } else {
          seen.set(item.id, item);
        }
      }
      await reader.settled(key);
    }
    expect(seen.size).toBe(pool.length);
  });

  it('refers to the nodes of a value that failed with sharedRefs', async () => {
    const reader = createBinaryReader({ sharedRefs: true });
    const writer = createBinaryWriter({ send: pipeTo(reader), sharedRefs: true });
    const shared = { id: 1 };
    writer.write('a', { later: Promise.resolve({ shared, fn: Symbol('local') }) });
    await expect(reader.settled('a')).rejects.toBeInstanceOf(SerovalTransportError);
    writer.write('b', { shared });
    const b = await reader.get<{ shared: unknown }>('b');
    expect(b.shared).toEqual({ id: 1 });
  });

  it('fails what waits in one value alone with sharedRefs', async () => {
    const reader = createBinaryReader({ sharedRefs: true });
    const writer = createBinaryWriter({ send: pipeTo(reader), sharedRefs: true });
    writer.write('a', { later: new Promise(() => {}) });
    writer.write('b', { later: Promise.resolve(2) });
    const a = await reader.get<{ later: Promise<never> }>('a');
    const reason = new Error('stop');
    reader.cancel('a', reason);
    await expect(a.later).rejects.toBe(reason);
    const b = await reader.get<{ later: Promise<number> }>('b');
    await expect(b.later).resolves.toBe(2);
  });

  it('settles a value once the reader decoded every byte', async () => {
    const reader = createBinaryReader();
    const messages: Message[] = [];
    toBinaryStream({ items: numbers() }, { send: (message) => void messages.push(message) });
    await tick();
    const settled = reader.settled('0');
    for (const message of messages) {
      reader.push(message);
    }
    await settled;
    const value = await reader.get<{ items: AsyncIterable<number> }>('0');
    expect(await collectItems(value.items)).toEqual([1, 2]);
  });

  it('fails a value it cannot serialize and reports the error', async () => {
    const onError = vi.fn();
    const reader = createBinaryReader();
    const writer = createBinaryWriter({ send: pipeTo(reader), onError });
    writer.write('bad', { fn: Symbol('local') });
    writer.write('good', 1);
    await expect(reader.get('bad')).rejects.toBeInstanceOf(SerovalTransportError);
    await expect(reader.get('good')).resolves.toBe(1);
    expect(onError).toHaveBeenCalledWith(expect.anything(), 'bad');
  });

  it('cancels one value on the writer, which stops its sources', async () => {
    const onCancel = vi.fn();
    const { stream } = createLiveStream<number>({ onCancel });
    const reader = createBinaryReader();
    const writer = createBinaryWriter({ send: pipeTo(reader) });
    writer.write('live', { stream, later: new Promise(() => {}) });
    writer.write('other', Promise.resolve('kept'));
    const live = await reader.get<{ later: Promise<never> }>('live');
    writer.cancel('live');
    expect(onCancel).toHaveBeenCalled();
    await expect(live.later).rejects.toBeInstanceOf(SerovalTransportError);
    await expect(reader.settled('live')).rejects.toBeInstanceOf(SerovalTransportError);
    expect(await reader.get('other')).toBe('kept');
  });

  it('cancels one value on the reader, and drops its later messages', async () => {
    const reader = createBinaryReader();
    const writer = createBinaryWriter({ send: pipeTo(reader) });
    let resolve!: (value: number) => void;
    writer.write('a', { later: new Promise<number>((res) => (resolve = res)) });
    const a = await reader.get<{ later: Promise<number> }>('a');
    const reason = new Error('stop');
    reader.cancel('a', reason);
    await expect(a.later).rejects.toBe(reason);
    resolve(1);
    await tick();
    writer.write('b', 2);
    await expect(reader.get('b')).resolves.toBe(2);
  });

  it('fails what still waits when the reader ends', async () => {
    const reader = createBinaryReader();
    const writer = createBinaryWriter({ send: pipeTo(reader) });
    writer.write('a', { later: new Promise(() => {}) });
    const a = await reader.get<{ later: Promise<never> }>('a');
    const settled = reader.settled('a');
    const missing = reader.get('never');
    reader.end();
    await expect(a.later).rejects.toThrow('every value settled');
    await expect(settled).rejects.toThrow('every value settled');
    await expect(missing).rejects.toThrow('before "never" arrived');
  });

  it('fails settled when the reader ends while it decodes', async () => {
    const reader = createBinaryReader();
    const messages: Message[] = [];
    toBinaryStream({ name: 'Ada' }, { send: (message) => void messages.push(message) });
    const settled = reader.settled('0');
    for (const message of messages) {
      reader.push(message);
    }
    // The DONE message arrived, but the deserializer has not run yet.
    const reason = new Error('gone');
    reader.end(reason);
    await expect(settled).rejects.toBe(reason);
  });

  it('refuses data that is not bytes', () => {
    const reader = createBinaryReader();
    expect(() => reader.push([0, 'a', { t: 1, s: 'x' }])).toThrow(SerovalTransportError);
  });

  it('throws on bytes that do not decode', async () => {
    const reader = createBinaryReader();
    const value = reader.get('a');
    expect(() =>
      reader.push([0, 'a', new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff])]),
    ).toThrow();
    // The caller ends the reader with the error, as `fromWebStream` does.
    const reason = new Error('malformed');
    reader.end(reason);
    await expect(value).rejects.toBe(reason);
  });

  it('throws on bytes that do not decode after the value opened', async () => {
    const reader = createBinaryReader();
    const writer = createBinaryWriter({ send: pipeTo(reader) });
    writer.write('a', { later: new Promise(() => {}) });
    const a = await reader.get<{ later: Promise<never> }>('a');
    expect(() =>
      reader.push([0, 'a', new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff])]),
    ).toThrow();
    await expect(a.later).rejects.toBeInstanceOf(Error);
  });

  it('fails settled when the bytes end inside the value', async () => {
    const onError = vi.fn();
    const reader = createBinaryReader({ onError });
    const messages: Message[] = [];
    toBinaryStream({ name: 'Ada' }, { send: (message) => void messages.push(message) });
    const settled = reader.settled('0');
    const data = messages[0][2] as Uint8Array;
    reader.push([0, '0', data.subarray(0, 3)]);
    reader.push([1, '0']);
    await expect(settled).rejects.toBeInstanceOf(Error);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), '0');
  });

  it('cancels a value that the writer settled while it still decodes', async () => {
    const reader = createBinaryReader();
    const messages: Message[] = [];
    toBinaryStream({ name: 'Ada' }, { send: (message) => void messages.push(message) });
    const value = reader.get('0');
    const settled = reader.settled('0');
    for (const message of messages) {
      reader.push(message);
    }
    const reason = new Error('stop');
    reader.cancel('0', reason);
    await expect(settled).rejects.toBe(reason);
    await expect(value).rejects.toBe(reason);
    expect(reader.size).toBe(0);
  });

  it('refuses a message for a key it still decodes', () => {
    const reader = createBinaryReader();
    const messages: Message[] = [];
    toBinaryStream('abc', { send: (message) => void messages.push(message) });
    for (const message of messages) {
      reader.push(message);
    }
    expect(() => reader.push(messages[0])).toThrow(SerovalTransportError);
  });

  it('applies the deserializer limits', async () => {
    const reader = createBinaryReader({ maxArrayBufferLength: 4 });
    const writer = createBinaryWriter({ send: pipeTo(reader) });
    writer.write('a', new Uint8Array(16));
    await expect(reader.get('a')).rejects.toBeInstanceOf(Error);
  });

  it('keeps no state for 1,000 sequential values', async () => {
    const reader = createBinaryReader();
    const writer = createBinaryWriter({ send: pipeTo(reader) });
    for (let i = 0; i < 1000; i++) {
      const key = writer.push({ i });
      const value = reader.get<{ i: number }>(key);
      await reader.settled(key);
      expect((await value).i).toBe(i);
    }
    expect(reader.size).toBe(0);
  });

  it('does not cause unhandled rejections for ignored values', async () => {
    const onUnhandled = vi.fn();
    process.on('unhandledRejection', onUnhandled);
    try {
      const reader = createBinaryReader();
      const writer = createBinaryWriter({ send: pipeTo(reader) });
      writer.write('a', { failed: Promise.reject(new Error('ignored')) });
      writer.write('b', { fn: Symbol('local') });
      writer.write('c', { later: new Promise(() => {}) });
      reader.push([0, 'd', new Uint8Array([2, 1])]);
      reader.push([1, 'd']);
      reader.get('never');
      await tick();
      reader.end();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(onUnhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });
});

describe('binary frames', () => {
  it('encodes bytes without JSON and decodes them back', () => {
    const data = new Uint8Array([0, 1, 2, 255]);
    const [head, body] = encodeFrame([0, 'kéy', data]);
    expect(body).toBe(data);
    const messages: unknown[] = [];
    const decoder = createFrameDecoder({ onMessage: (message) => void messages.push(message) });
    // One byte at a time, so the frame spans many chunks.
    for (const piece of [head, body]) {
      for (let i = 0; i < piece.length; i++) {
        decoder.push(piece.subarray(i, i + 1));
      }
    }
    decoder.end();
    expect(messages).toEqual([[0, 'kéy', data]]);
  });

  it('decodes JSON frames and byte frames mixed in one stream', () => {
    const messages: Message[] = [
      [0, 'json', { t: 1, s: 'a' }],
      [0, '', new Uint8Array([1, 2])],
      [0, 'ключ', new Uint8Array(0)],
      [1, 'json'],
      [2, ''],
    ];
    const bytes: number[] = [];
    for (const message of messages) {
      for (const piece of encodeFrame(message)) {
        bytes.push(...piece);
      }
    }
    const decoded: unknown[] = [];
    const decoder = createFrameDecoder({ onMessage: (message) => void decoded.push(message) });
    for (const byte of bytes) {
      decoder.push(new Uint8Array([byte]));
    }
    decoder.end();
    expect(decoded).toEqual(messages);
  });

  it('refuses a byte frame whose key is not UTF-8', () => {
    const [head, body] = encodeFrame([0, 'k', new Uint8Array([7])]);
    // Replace the key with a lone continuation byte.
    head[12 + 5] = 0x80;
    const decoder = createFrameDecoder({ onMessage() {} });
    expect(() => {
      decoder.push(head);
      decoder.push(body);
    }).toThrow(SerovalTransportError);
  });

  it('refuses a frame whose key runs past its data', () => {
    const [head] = encodeFrame([0, 'key', new Uint8Array(0)]);
    // Claim a key of 255 bytes.
    head[12 + 4] = 255;
    const decoder = createFrameDecoder({ onMessage() {} });
    expect(() => decoder.push(head)).toThrow(SerovalTransportError);
  });

  it('refuses a frame too short for its key size', () => {
    const bytes = new TextEncoder().encode(';0x00000002;');
    const frame = new Uint8Array(14);
    frame.set(bytes);
    const decoder = createFrameDecoder({ onMessage() {} });
    expect(() => decoder.push(frame)).toThrow(SerovalTransportError);
  });

  it('sends values over a web stream', async () => {
    const reader = createBinaryReader();
    const stream = toWebStream((sink) => {
      const writer = createBinaryWriter(sink);
      writer.write('a', { items: numbers(), bytes: new Uint8Array([9, 8]) });
      writer.write('b', Promise.resolve('later'));
      writer.flush();
      return writer;
    });
    const reading = fromWebStream(stream, reader);
    const a = await reader.get<{ items: AsyncIterable<number>; bytes: Uint8Array }>('a');
    expect(a.bytes).toEqual(new Uint8Array([9, 8]));
    expect(await collectItems(a.items)).toEqual([1, 2]);
    await expect(reader.get('b')).resolves.toBe('later');
    await reading;
  });

  it('sends values over a Node stream', async () => {
    const reader = createBinaryReader();
    const stream = toNodeStream((sink) => toBinaryStream({ big: new Uint8Array(100_000) }, sink));
    const reading = fromNodeStream(stream, reader);
    const value = await reader.get<{ big: Uint8Array }>('0');
    await reader.settled('0');
    expect(value.big.length).toBe(100_000);
    await reading;
  });
});

/** Re-sends the bytes of `body` in pieces of `size` bytes. */
async function rechunk(
  body: ReadableStream<Uint8Array>,
  size: number,
): Promise<ReadableStream<Uint8Array>> {
  const bytes = new Uint8Array(await new Response(body).arrayBuffer());
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

describe('binary responses and streams', () => {
  it('sends values through a Response', async () => {
    const response = toResponse(
      (sink) => {
        const writer = createBinaryWriter(sink);
        writer.write('user', {
          name: 'Ada',
          avatar: new Uint8Array([1, 2, 3]),
          later: Promise.resolve(1),
        });
        writer.write('items', { items: numbers() });
        writer.flush();
        return writer;
      },
      { status: 201 },
    );
    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    const reader = createBinaryReader();
    const reading = fromResponse(response, reader);
    const user = await reader.get<{ name: string; avatar: Uint8Array; later: Promise<number> }>(
      'user',
    );
    expect(user.name).toBe('Ada');
    expect(user.avatar).toEqual(new Uint8Array([1, 2, 3]));
    await expect(user.later).resolves.toBe(1);
    const { items } = await reader.get<{ items: AsyncIterable<number> }>('items');
    expect(await collectItems(items)).toEqual([1, 2]);
    await reading;
  });

  it('reads one value of a Response with fromBinaryStream', async () => {
    const response = toResponse((sink) => toBinaryStream({ later: Promise.resolve('done') }, sink));
    const reader = fromBinaryStream<{ later: Promise<string> }>();
    void fromResponse(response, reader);
    const value = await reader.value;
    await expect(value.later).resolves.toBe('done');
    await expect(reader.settled).resolves.toBeUndefined();
  });

  it('keeps references with sharedRefs through a Response split into small chunks', async () => {
    const shared = { id: 1 };
    const response = toResponse((sink) => {
      const writer = createBinaryWriter({ ...sink, sharedRefs: true });
      writer.write('a', { shared, later: Promise.resolve(shared) });
      writer.write('b', [shared]);
      writer.flush();
      return writer;
    });
    const reader = createBinaryReader({ sharedRefs: true });
    const reading = fromWebStream(await rechunk(response.body!, 3), reader);
    const a = await reader.get<{ shared: object; later: Promise<object> }>('a');
    const b = await reader.get<object[]>('b');
    expect(await a.later).toBe(a.shared);
    expect(b[0]).toBe(a.shared);
    await reading;
  });

  it('reports bytes that do not decode and ends the reader', async () => {
    const [head] = encodeFrame([0, 'a', new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff])]);
    const body = new Uint8Array(head.length + 6);
    body.set(head);
    body.fill(0xff, head.length);
    const onError = vi.fn();
    const reader = createBinaryReader();
    const value = reader.get('a');
    await fromResponse(new Response(body), reader, { onError });
    await expect(value).rejects.toBeInstanceOf(Error);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('fails pending values and stops the writer when the reading stops', async () => {
    const onCancel = vi.fn();
    const { stream: live } = createLiveStream<number>({ onCancel });
    const response = toResponse((sink) =>
      toBinaryStream({ live, later: new Promise(() => {}) }, sink),
    );
    const reader = createBinaryReader();
    const controller = new AbortController();
    const reading = fromResponse(response, reader, { signal: controller.signal });
    const value = await reader.get<{ later: Promise<never> }>('0');
    // Stop reading, as a client that goes away does.
    const reason = new Error('gone');
    controller.abort(reason);
    await expect(value.later).rejects.toBe(reason);
    await reading;
    // Cancelling the body closes the writer, which stops its sources.
    await vi.waitFor(() => expect(onCancel).toHaveBeenCalled());
  });

  it('stops the sources when the web stream is cancelled', async () => {
    const onCancel = vi.fn();
    const { stream: live } = createLiveStream<number>({ onCancel });
    const stream = toWebStream((sink) => toBinaryStream({ live }, sink));
    await stream.cancel(new Error('gone'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('stops the sources when the Node stream is destroyed', () => {
    const onCancel = vi.fn();
    const { stream: live } = createLiveStream<number>({ onCancel });
    const stream = toNodeStream((sink) => toBinaryStream({ live }, sink));
    stream.destroy();
    expect(onCancel).toHaveBeenCalled();
  });

  it('reads a Node stream that sends bytes in small chunks', async () => {
    const shared = { id: 1 };
    const pieces: Buffer[] = [];
    for await (const chunk of toNodeStream((sink) => {
      const writer = createBinaryWriter({ ...sink, sharedRefs: true });
      writer.write('a', shared);
      writer.write('b', { shared, items: numbers() });
      writer.flush();
      return writer;
    })) {
      pieces.push(chunk as Buffer);
    }
    const bytes = Buffer.concat(pieces);
    const chunks: Buffer[] = [];
    for (let i = 0; i < bytes.length; i += 2) {
      chunks.push(bytes.subarray(i, i + 2));
    }
    const reader = createBinaryReader({ sharedRefs: true });
    const reading = fromNodeStream(Readable.from(chunks), reader);
    const a = await reader.get('a');
    const b = await reader.get<{ shared: unknown; items: AsyncIterable<number> }>('b');
    expect(b.shared).toBe(a);
    expect(await collectItems(b.items)).toEqual([1, 2]);
    await reading;
  });
});
