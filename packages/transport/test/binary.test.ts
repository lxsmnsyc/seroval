import { createLiveStream } from 'seroval';
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
import { fromWebStream, toWebStream } from '../src/web';

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

  it('fails the value and reports bytes that do not decode', async () => {
    const onError = vi.fn();
    const reader = createBinaryReader({ onError });
    const value = reader.get('a');
    const settled = reader.settled('a');
    reader.push([0, 'a', new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff])]);
    reader.push([1, 'a']);
    await expect(value).rejects.toBeInstanceOf(Error);
    await expect(settled).rejects.toBeInstanceOf(Error);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'a');
  });

  it('fails settled when bytes that do not decode arrive before the end', async () => {
    const onError = vi.fn();
    const reader = createBinaryReader({ onError });
    const value = reader.get('a');
    const settled = reader.settled('a');
    reader.push([0, 'a', new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff])]);
    // The deserializer fails before the writer settles the value.
    await expect(value).rejects.toBeInstanceOf(Error);
    reader.push([1, 'a']);
    await expect(settled).rejects.toBeInstanceOf(Error);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(reader.size).toBe(0);
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
      reader.push([0, 'd', new Uint8Array([0xff])]);
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
