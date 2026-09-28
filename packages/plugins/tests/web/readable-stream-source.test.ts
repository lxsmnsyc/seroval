import type { SerovalNode } from 'seroval';
import {
  createPlugin,
  crossSerializeStream,
  fromCrossJSON,
  fromJSON,
  toCrossJSONStream,
  toJSONAsync,
} from 'seroval';
import { describe, expect, it } from 'vitest';
import ReadableStreamPlugin from '../../web/readable-stream';

const plugins = [ReadableStreamPlugin];
const DEPTH_ERROR = /depth/i;
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

async function drain<T>(stream: ReadableStream<T>): Promise<T[]> {
  const reader = stream.getReader();
  const values: T[] = [];
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) {
        return values;
      }
      values.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
}

describe('ReadableStream source', () => {
  it('checks depth before acquiring the source in async and stream modes', async () => {
    let acquired = 0;
    const source: AsyncIterable<unknown> = {
      [Symbol.asyncIterator]() {
        acquired++;
        return { next: async () => ({ done: true, value: undefined }) };
      },
    };
    const marker = {};
    const plugin = createPlugin<object, { s: SerovalNode }>({
      tag: 'test/stream-source',
      test: value => value === marker,
      parse: {
        async async(_value, ctx) {
          return { s: await ctx.parseStreamSource(source) };
        },
        stream(_value, ctx) {
          return { s: ctx.parseStreamSource(source) };
        },
      },
      serialize: () => 'undefined',
      deserialize: () => marker,
    });
    await expect(
      toJSONAsync(marker, { plugins: [plugin], depthLimit: 1 }),
    ).rejects.toMatchObject({
      cause: { message: expect.stringMatching(DEPTH_ERROR) },
    });
    const error = await new Promise<unknown>(resolve => {
      crossSerializeStream(marker, {
        plugins: [plugin],
        depthLimit: 1,
        onSerialize: () => undefined,
        onError: resolve,
      });
    });
    expect(error).toMatchObject({
      message: expect.stringMatching(DEPTH_ERROR),
    });
    expect(acquired).toBe(0);
  });

  it('keeps binary, deferred, repeated, and self-referencing chunks', async () => {
    const shared = { value: 1 };
    const outer: { stream?: ReadableStream<unknown> } = {};
    outer.stream = new ReadableStream<unknown>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue({ deferred: Promise.resolve('ready') });
        controller.enqueue(shared);
        controller.enqueue(shared);
        controller.enqueue(outer);
        controller.close();
      },
    });
    const decoded = fromJSON(await toJSONAsync(outer, { plugins }), {
      plugins,
    }) as typeof outer;
    const chunks = await drain(decoded.stream as ReadableStream<unknown>);
    expect(chunks[0]).toEqual(new Uint8Array([1, 2]));
    await expect(
      (chunks[1] as { deferred: Promise<string> }).deferred,
    ).resolves.toBe('ready');
    expect(chunks[2]).toBe(chunks[3]);
    expect(chunks[4]).toBe(decoded);
    expect(outer.stream.locked).toBe(false);
  });

  it('keeps binary, deferred, repeated, and self-referencing chunks while streaming', async () => {
    const shared = { value: 1 };
    const outer: { stream?: ReadableStream<unknown> } = {};
    outer.stream = new ReadableStream<unknown>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue({ deferred: Promise.resolve('ready') });
        controller.enqueue(shared);
        controller.enqueue(shared);
        controller.enqueue(outer);
        controller.close();
      },
    });
    let decoded: typeof outer | undefined;
    const refs = new Map();
    await new Promise<void>((resolve, reject) => {
      toCrossJSONStream(outer, {
        plugins,
        onParse(node, initial) {
          const value = fromCrossJSON<typeof outer>(node, { plugins, refs });
          if (initial) {
            decoded = value;
          }
        },
        onDone: resolve,
        onError: reject,
      });
    });
    const chunks = await drain(decoded?.stream as ReadableStream<unknown>);
    expect(chunks[0]).toEqual(new Uint8Array([1, 2]));
    await expect(
      (chunks[1] as { deferred: Promise<string> }).deferred,
    ).resolves.toBe('ready');
    expect(chunks[2]).toBe(chunks[3]);
    expect(chunks[4]).toBe(decoded);
    expect(outer.stream.locked).toBe(false);
  });

  it('does not pull the next chunk before a deferred chunk parses', async () => {
    let settle: (value: number) => void = () => {
      throw new Error('source not pulled');
    };
    let pulls = 0;
    const source = new ReadableStream<unknown>(
      {
        pull(controller) {
          pulls++;
          if (pulls === 1) {
            controller.enqueue({
              deferred: new Promise<number>(resolve => {
                settle = resolve;
              }),
            });
          } else if (pulls === 2) {
            controller.enqueue('tail');
          } else {
            controller.close();
          }
        },
      },
      { highWaterMark: 0 },
    );
    const output = toJSONAsync(source, { plugins });
    await tick();
    expect(pulls).toBe(1);
    settle(1);
    const chunks = await drain(
      fromJSON(await output, { plugins }) as ReadableStream<unknown>,
    );
    await expect(
      (chunks[0] as { deferred: Promise<number> }).deferred,
    ).resolves.toBe(1);
    expect(chunks[1]).toBe('tail');
    expect(source.locked).toBe(false);
  });

  it('forwards the stream stop reason, releases the lock, and ignores a late read', async () => {
    const reason = new Error('stop');
    const cancellations: unknown[] = [];
    const output: unknown[] = [];
    let resolveRead: (value: ReadableStreamReadResult<string>) => void = () => {
      throw new Error('source not read');
    };
    let released = 0;
    const source = new ReadableStream<string>();
    Object.defineProperty(source, 'getReader', {
      value: () => ({
        read: () =>
          new Promise<ReadableStreamReadResult<string>>(resolve => {
            resolveRead = resolve;
          }),
        cancel(value: unknown) {
          cancellations.push(value);
          return Promise.resolve();
        },
        releaseLock() {
          released++;
        },
      }),
    });
    const stop = crossSerializeStream(source, {
      plugins,
      onSerialize(value) {
        output.push(value);
      },
    });
    await tick();
    stop(reason);
    resolveRead({ done: false, value: 'late' });
    await tick();
    expect(cancellations).toEqual([reason]);
    expect(released).toBe(1);
    expect(output).toHaveLength(1);
  });

  it('cancels on an async parse failure without reading ahead', async () => {
    const reasons: unknown[] = [];
    let pulls = 0;
    const source = new ReadableStream<unknown>(
      {
        pull(controller) {
          pulls++;
          controller.enqueue(pulls === 1 ? Symbol('unsupported') : 'late');
        },
        cancel(reason) {
          reasons.push(reason);
        },
      },
      { highWaterMark: 0 },
    );
    await expect(toJSONAsync(source, { plugins })).rejects.toThrow();
    await tick();
    expect(reasons).toEqual([undefined]);
    expect(pulls).toBe(1);
    expect(source.locked).toBe(false);
  });

  it('does not let a hostile cancel replace the parse error', async () => {
    const source = new ReadableStream<unknown>({
      start(controller) {
        controller.enqueue(Symbol('unsupported'));
      },
    });
    const reader = source.getReader.bind(source);
    Object.defineProperty(source, 'getReader', {
      value: () =>
        Object.assign(reader(), {
          cancel() {
            throw new Error('hostile cancel');
          },
        }),
    });
    await expect(toJSONAsync(source, { plugins })).rejects.not.toThrow(
      'hostile cancel',
    );
    await tick();
    expect(source.locked).toBe(false);
  });

  it('keeps the output failure when cancellation throws', async () => {
    const source = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('a');
      },
    });
    const reader = source.getReader.bind(source);
    Object.defineProperty(source, 'getReader', {
      value: () =>
        Object.assign(reader(), {
          cancel() {
            throw new Error('hostile cancel');
          },
        }),
    });
    const failure = new Error('output failed');
    const observed = await new Promise<unknown>(resolve => {
      crossSerializeStream(source, {
        plugins,
        onSerialize(_value, initial) {
          if (!initial) {
            throw failure;
          }
        },
        onError: resolve,
      });
    });
    expect(observed).toBe(failure);
    expect(source.locked).toBe(false);
  });
});
