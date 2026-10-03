import { describe, expect, it, vi } from 'vitest';
import { binary, createLiveStream, createStream, type Stream } from '../../src';
import { createPlugin } from '../../src/core/plugin';
import { startDeserialize } from './utils';

function tick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

interface Run {
  chunks: Uint8Array[];
  onDone: ReturnType<typeof vi.fn>;
  onError: ReturnType<typeof vi.fn>;
  abort: () => void;
}

function run(
  value: unknown,
  options?: Partial<binary.SerializeOptions>,
): Run {
  const chunks: Uint8Array[] = [];
  const onDone = vi.fn();
  const onError = vi.fn();
  const abort = binary.serialize(value, {
    refs: new Map(),
    ...options,
    onSerialize(bytes) {
      chunks.push(bytes);
    },
    onDone,
    onError,
  });
  return { chunks, onDone, onError, abort };
}

function endless() {
  const state = { pulled: 0, returned: false };
  const iterable = {
    async *[Symbol.asyncIterator]() {
      try {
        while (true) {
          state.pulled++;
          await tick();
          yield state.pulled;
        }
      } finally {
        state.returned = true;
      }
    },
  };
  return { state, iterable };
}

describe('binary serializer lifecycle', () => {
  it('stops an async iterable source on abort without calling onDone', async () => {
    const { state, iterable } = endless();
    const result = run(iterable);
    await tick();
    await tick();
    result.abort();
    const pulled = state.pulled;
    await tick();
    await tick();
    await tick();
    expect(state.pulled).toBeLessThanOrEqual(pulled + 1);
    expect(state.returned).toBe(true);
    expect(result.onDone).not.toHaveBeenCalled();
    expect(result.onError).not.toHaveBeenCalled();
  });

  it('unsubscribes from a stream on abort', () => {
    const source = createStream<number>();
    const off = vi.fn();
    const on = source.on.bind(source);
    source.on = listener => {
      const unsubscribe = on(listener);
      return () => {
        off();
        unsubscribe();
      };
    };
    const result = run(source);
    result.abort();
    expect(off).toHaveBeenCalledTimes(1);
    expect(result.onDone).not.toHaveBeenCalled();
  });

  it('runs every cleanup when one throws and reports the first error', () => {
    const first = vi.fn(() => {
      throw new Error('first');
    });
    const second = vi.fn();
    class Holder {}
    const plugin = createPlugin<Holder, any, Record<string, never>>({
      tag: 'test/cleanup',
      test: value => value instanceof Holder,
      parse: {},
      serialize: () => '',
      deserialize: () => new Holder(),
      binary: {
        serialize(_value, ctx) {
          ctx.addCleanup(first);
          ctx.addCleanup(second);
          return {};
        },
        deserialize: () => new Holder(),
      },
    });
    const result = run([new Holder(), new Promise(() => {})], {
      plugins: [plugin],
    });
    result.abort();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(result.onError).toHaveBeenCalledTimes(1);
    expect((result.onError.mock.calls[0][0] as Error).message).toBe('first');
  });

  it('stops started sources when the root fails', async () => {
    const { state, iterable } = endless();
    const result = run([iterable, Symbol('unsupported')]);
    expect(result.onError).toHaveBeenCalledTimes(1);
    await tick();
    await tick();
    expect(state.returned).toBe(true);
    expect(result.onDone).not.toHaveBeenCalled();
  });

  it('calls onDone once every value has settled', async () => {
    const result = run({ a: Promise.resolve(1) });
    await tick();
    expect(result.onDone).toHaveBeenCalledTimes(1);
    result.abort();
    expect(result.onDone).toHaveBeenCalledTimes(1);
    expect(result.onError).not.toHaveBeenCalled();
  });
});

describe('binary live streams', () => {
  it('accepts an event only after onSerialize accepts its chunk', async () => {
    const { stream, producer } = createLiveStream<number>();
    const releases: (() => void)[] = [];
    const chunks: Uint8Array[] = [];
    binary.serialize(stream, {
      refs: new Map(),
      onSerialize(bytes) {
        chunks.push(bytes);
        return new Promise<void>(resolve => {
          releases.push(resolve);
        });
      },
      onDone() {},
      onError() {},
    });
    let accepted = false;
    const write = producer.write(1).then(() => {
      accepted = true;
    });
    await tick();
    expect(accepted).toBe(false);
    for (const release of releases.splice(0)) {
      release();
    }
    await write;
    expect(accepted).toBe(true);
  });

  it('cancels a live stream on abort', async () => {
    const onCancel = vi.fn();
    const { stream } = createLiveStream<number>({ onCancel });
    const result = run(stream);
    result.abort();
    await tick();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(result.onDone).not.toHaveBeenCalled();
  });

  it('decodes a live stream as a single-consumer receiver', async () => {
    const { stream, producer } = createLiveStream<number>();
    const transport = {
      queue: [] as (Uint8Array | undefined)[],
      waiting: [] as ((chunk: Uint8Array | undefined) => void)[],
      push(chunk: Uint8Array | undefined) {
        const reader = this.waiting.shift();
        if (reader) {
          reader(chunk);
        } else {
          this.queue.push(chunk);
        }
      },
      read(): Promise<Uint8Array | undefined> {
        if (this.queue.length) {
          return Promise.resolve(this.queue.shift());
        }
        return new Promise(resolve => this.waiting.push(resolve));
      },
    };
    binary.serialize(stream, {
      refs: new Map(),
      onSerialize: bytes => transport.push(bytes),
      onDone: () => transport.push(undefined),
      onError() {},
    });
    const { value } = await startDeserialize<Stream<number>>(
      transport as never,
    );
    const seen: unknown[] = [];
    value.on({
      next: v => seen.push(v),
      throw: e => seen.push(['throw', e]),
      return: v => seen.push(['return', v]),
    });
    await producer.write(1);
    await producer.close(2);
    await tick();
    expect(seen).toEqual([1, ['return', 2]]);
    expect(() => value.on({ next() {}, throw() {}, return() {} })).toThrow();
  });
});
