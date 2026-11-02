import { PassThrough, Readable } from 'node:stream';
import { createLiveStream } from 'seroval';
import { describe, expect, it, vi } from 'vitest';
import { createJSONReader, createJSONWriter, fromJSONStream, toJSONStream } from '../src';
import { SerovalTransportError, fromNodeStream, toNodeStream } from '../src/node';

async function collect(stream: Readable): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Uint8Array);
  }
  return Buffer.concat(chunks);
}

/** A stream that sends `bytes` in pieces of `size` bytes. */
function fromBytes(bytes: Uint8Array, size = bytes.length): Readable {
  const pieces: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.length; offset += size) {
    pieces.push(bytes.subarray(offset, offset + size));
  }
  return Readable.from(pieces, { objectMode: false });
}

describe('Node streams', () => {
  it('sends many values over one stream', async () => {
    const stream = toNodeStream((sink) => {
      const writer = createJSONWriter(sink);
      writer.write('user', { name: 'Ada' });
      writer.write('posts', Promise.resolve(['a', 'b']));
      writer.flush();
      return writer;
    });
    const reader = createJSONReader();
    void fromNodeStream(stream, reader);
    expect(await reader.get('user')).toEqual({ name: 'Ada' });
    await expect(reader.get('posts')).resolves.toEqual(['a', 'b']);
  });

  it('reads frames split into single bytes', async () => {
    const bytes = await collect(toNodeStream((sink) => toJSONStream({ a: Promise.resolve('é') }, sink)));
    const reader = fromJSONStream<{ a: Promise<string> }>();
    void fromNodeStream(fromBytes(bytes, 1), reader);
    await expect((await reader.value).a).resolves.toBe('é');
  });

  it('fails pending values when the stream ends inside a frame', async () => {
    const bytes = await collect(toNodeStream((sink) => toJSONStream({ a: Promise.resolve(1) }, sink)));
    const reader = fromJSONStream();
    const onError = vi.fn();
    await fromNodeStream(fromBytes(bytes.subarray(0, bytes.length - 1)), reader, { onError });
    expect(onError).toHaveBeenCalledWith(expect.any(SerovalTransportError));
  });

  it('reports a stream that carries text', async () => {
    const stream = new PassThrough();
    stream.setEncoding('utf8');
    stream.end('text');
    const reader = createJSONReader();
    const onError = vi.fn();
    await fromNodeStream(stream, reader, { onError });
    expect(onError).toHaveBeenCalledWith(expect.any(SerovalTransportError));
    await expect(reader.get('a')).rejects.toThrow(SerovalTransportError);
  });

  it('ends the reader and destroys the stream when the signal aborts', async () => {
    const stream = new PassThrough();
    const reader = createJSONReader();
    const controller = new AbortController();
    const reading = fromNodeStream(stream, reader, { signal: controller.signal });
    const value = reader.get('a');
    controller.abort(new Error('stop'));
    await reading;
    await expect(value).rejects.toThrow('stop');
    expect(stream.destroyed).toBe(true);
  });

  it('holds back frames while the stream is not read', async () => {
    let sent = 0;
    async function* numbers(): AsyncGenerator<string> {
      for (let i = 0; i < 100; i++) {
        sent++;
        yield 'x'.repeat(100);
      }
    }
    const stream = toNodeStream((sink) => toJSONStream(numbers(), sink), { highWaterMark: 256 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sent).toBeLessThan(10);
    const reader = fromJSONStream<AsyncIterable<string>>();
    void fromNodeStream(stream, reader);
    let count = 0;
    for await (const _ of await reader.value) {
      count++;
    }
    expect(count).toBe(100);
  });

  it('stops the sources when the stream is destroyed', async () => {
    const onCancel = vi.fn();
    const { stream: source } = createLiveStream<number>({ onCancel });
    const stream = toNodeStream((sink) => toJSONStream({ source }, sink));
    stream.resume();
    await new Promise((resolve) => setTimeout(resolve, 10));
    stream.destroy();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onCancel).toHaveBeenCalled();
  });
});
