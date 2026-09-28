import v8 from 'node:v8';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import {
  createLiveStream,
  createStream,
  crossSerializeStream,
  fromCrossJSON,
  SerovalLiveStreamError,
  type Stream,
  toCrossJSONAsync,
  toCrossJSONStream,
} from '../src';

v8.setFlagsFromString('--expose-gc');
const gc = vm.runInNewContext('gc') as () => void;

function tick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function collect(): Promise<void> {
  await tick();
  gc();
  await tick();
  gc();
}

function collectValues<T>(stream: Stream<T>): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const values: T[] = [];
    stream.on({
      next(value) {
        values.push(value);
      },
      return(value) {
        values.push(value);
        resolve(values);
      },
      throw: reject,
    });
  });
}

describe('createLiveStream', () => {
  it('permits exactly one consumer', () => {
    const { stream } = createLiveStream<number>();
    stream.consume();
    expect(() => stream.consume()).toThrow(SerovalLiveStreamError);
  });

  it('rejects a second producer operation while one is pending', async () => {
    const { stream, producer } = createLiveStream<number>();
    const consumer = stream.consume();
    const first = producer.write(1);
    await expect(producer.write(2)).rejects.toBeInstanceOf(
      SerovalLiveStreamError,
    );
    const delivery = await consumer.read();
    expect(delivery.event).toEqual({ type: 'next', value: 1 });
    delivery.accept();
    await first;
    const second = producer.write(2);
    const next = await consumer.read();
    expect(next.event).toEqual({ type: 'next', value: 2 });
    next.accept();
    await expect(second).resolves.toBeUndefined();
  });

  it('resolves the producer only after acceptance', async () => {
    const { stream, producer } = createLiveStream<number>();
    const consumer = stream.consume();
    const settled = vi.fn();
    const write = producer.write(1).then(settled);
    const delivery = await consumer.read();
    await tick();
    expect(settled).not.toHaveBeenCalled();
    delivery.accept();
    await write;
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('delivers events and the terminal event in producer order', async () => {
    const { stream, producer } = createLiveStream<number>();
    const consumer = stream.consume();
    const seen: unknown[] = [];
    const drain = (async () => {
      for (;;) {
        const delivery = await consumer.read();
        seen.push(delivery.event);
        delivery.accept();
        if (delivery.event.type !== 'next') {
          return;
        }
      }
    })();
    await producer.write(1);
    await producer.write(2);
    await producer.close(3);
    await drain;
    expect(seen).toEqual([
      { type: 'next', value: 1 },
      { type: 'next', value: 2 },
      { type: 'return', value: 3 },
    ]);
    await expect(producer.write(4)).rejects.toBeInstanceOf(
      SerovalLiveStreamError,
    );
    await expect(consumer.read()).rejects.toBeInstanceOf(
      SerovalLiveStreamError,
    );
  });

  it('ignores a late or repeated accept', async () => {
    const { stream, producer } = createLiveStream<number>();
    const consumer = stream.consume();
    const first = producer.write(1);
    const stale = await consumer.read();
    stale.accept();
    await first;
    const second = producer.write(2);
    stale.accept();
    stale.accept();
    const settled = vi.fn();
    second.then(settled);
    await tick();
    expect(settled).not.toHaveBeenCalled();
    (await consumer.read()).accept();
    await second;
  });

  it('cancellation rejects pending operations and reports once', async () => {
    const onCancel = vi.fn();
    const { stream, producer } = createLiveStream<number>({ onCancel });
    const consumer = stream.consume();
    const reason = new Error('stop');
    const write = producer.write(1);
    consumer.cancel(reason);
    consumer.cancel(new Error('again'));
    await expect(write).rejects.toBe(reason);
    await expect(consumer.read()).rejects.toBe(reason);
    await expect(producer.write(2)).rejects.toBe(reason);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledWith(reason);
  });

  it('cancellation rejects a pending read', async () => {
    const { stream } = createLiveStream<number>();
    const consumer = stream.consume();
    const read = consumer.read();
    const reason = new Error('stop');
    consumer.cancel(reason);
    await expect(read).rejects.toBe(reason);
  });

  it('releases accepted events while the stream stays reachable', async () => {
    const { stream, producer } = createLiveStream<object>();
    const consumer = stream.consume();
    async function exchange(i: number): Promise<WeakRef<object>> {
      const value = { i };
      const write = producer.write(value);
      const delivery = await consumer.read();
      delivery.accept();
      await write;
      return new WeakRef(value);
    }
    const refs: WeakRef<object>[] = [];
    for (let i = 0; i < 3; i++) {
      refs.push(await exchange(i));
    }
    const held = { i: 3 };
    const pending = producer.write(held).catch(() => {
      // no-op
    });
    await collect();
    expect(refs.map(ref => ref.deref())).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    consumer.cancel();
    await pending;
    expect(stream).toBeDefined();
  });
});

describe('live stream serialization', () => {
  it('produces the same replay as createStream', async () => {
    const { stream, producer } = createLiveStream<number>();
    const refs = new Map();
    let restored: Stream<number> | undefined;
    const done = new Promise<void>((resolve, reject) => {
      toCrossJSONStream(stream, {
        onParse(node, initial) {
          const value = fromCrossJSON<Stream<number>>(node, { refs });
          if (initial) {
            restored = value;
          }
        },
        onDone: resolve,
        onError: reject,
      });
    });
    await producer.write(1);
    await producer.write(2);
    await producer.close(3);
    await done;
    expect(restored).toBeDefined();
    expect(await collectValues(restored as Stream<number>)).toEqual([1, 2, 3]);
  });

  it('calls the root callback synchronously and returns before it settles', () => {
    const { stream } = createLiveStream<number>();
    const onSerialize = vi.fn(
      () =>
        new Promise<void>(() => {
          // never settles
        }),
    );
    const cancel = crossSerializeStream(stream, { onSerialize });
    expect(onSerialize).toHaveBeenCalledTimes(1);
    expect(onSerialize.mock.calls[0][1]).toBe(true);
    cancel();
  });

  it('holds dynamic records until the root record is accepted', async () => {
    const { stream, producer } = createLiveStream<number>();
    let acceptRoot!: () => void;
    const emitted: boolean[] = [];
    crossSerializeStream(stream, {
      onSerialize(_data, initial) {
        emitted.push(initial);
        if (initial) {
          return new Promise<void>(resolve => {
            acceptRoot = resolve;
          });
        }
      },
    });
    const write = producer.write(1);
    await tick();
    expect(emitted).toEqual([true]);
    acceptRoot();
    await write;
    expect(emitted).toEqual([true, false]);
  });

  it('reads the next source event only after the record is accepted', async () => {
    const reads: number[] = [];
    const accepted: number[] = [];
    let release: (() => void) | undefined;
    async function* source() {
      for (let i = 0; i < 3; i++) {
        reads.push(i);
        await Promise.resolve();
        yield i;
      }
    }
    const done = new Promise<void>((resolve, reject) => {
      toCrossJSONStream(source(), {
        onParse(_node, initial) {
          if (initial) {
            return;
          }
          return new Promise<void>(resolve => {
            release = () => {
              accepted.push(accepted.length);
              resolve();
            };
          });
        },
        onDone: resolve,
        onError: reject,
      });
    });
    await tick();
    expect(reads).toEqual([0]);
    expect(reads.length - accepted.length).toBeLessThanOrEqual(1);
    while (accepted.length < 4) {
      await tick();
      expect(reads.length - accepted.length).toBeLessThanOrEqual(1);
      (release as () => void)();
      release = undefined;
    }
    await done;
    expect(reads).toEqual([0, 1, 2]);
  });

  it('runs one output callback at a time and completes after the last settles', async () => {
    const { stream, producer } = createLiveStream<number>();
    let inFlight = 0;
    let maxInFlight = 0;
    const onDone = vi.fn();
    const settled: (() => void)[] = [];
    crossSerializeStream(stream, {
      onSerialize() {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        return new Promise<void>(resolve => {
          settled.push(() => {
            inFlight--;
            resolve();
          });
        });
      },
      onDone,
    });
    expect(settled).toHaveLength(1);
    const write = producer.write(1);
    await tick();
    expect(settled).toHaveLength(1);
    settled.shift()?.();
    await tick();
    expect(settled).toHaveLength(1);
    settled.shift()?.();
    await write;
    const close = producer.close(2);
    await tick();
    expect(settled).toHaveLength(1);
    expect(onDone).not.toHaveBeenCalled();
    settled.shift()?.();
    await close;
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(maxInFlight).toBe(1);
  });

  it('reports a rejected output callback and cancels the source', async () => {
    const onCancel = vi.fn();
    const { stream, producer } = createLiveStream<number>({ onCancel });
    const onError = vi.fn();
    const onDone = vi.fn();
    const failure = new Error('output closed');
    crossSerializeStream(stream, {
      onSerialize(_data, initial) {
        if (!initial) {
          return Promise.reject(failure);
        }
      },
      onError,
      onDone,
    });
    await expect(producer.write(1)).rejects.toBe(failure);
    expect(onError).toHaveBeenCalledWith(failure);
    expect(onDone).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledWith(failure);
  });

  it('cancels the source with the parse error when an event cannot be parsed', async () => {
    const onCancel = vi.fn();
    const { stream, producer } = createLiveStream<unknown>({ onCancel });
    const onError = vi.fn();
    crossSerializeStream(stream, {
      onSerialize() {
        // no-op
      },
      onError,
    });
    const write = producer.write(() => {
      // functions cannot be serialized
    });
    await expect(write).rejects.toBeInstanceOf(Error);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCancel.mock.calls[0][0]).toBe(onError.mock.calls[0][0]);
  });

  it('cancelling serialization cancels the live stream', async () => {
    const onCancel = vi.fn();
    const { stream, producer } = createLiveStream<number>({ onCancel });
    const cancel = crossSerializeStream(stream, {
      onSerialize() {
        // no-op
      },
    });
    const write = producer.write(1);
    await write;
    const next = producer.write(2);
    cancel();
    await expect(next).rejects.toBeUndefined();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('emits a containing record before the patches for values inside it', async () => {
    const { stream, producer } = createLiveStream<unknown>();
    const refs = new Map();
    const records: string[] = [];
    let restored: Stream<{ inner: Stream<number> }> | undefined;
    const done = new Promise<void>((resolve, reject) => {
      toCrossJSONStream(stream, {
        onParse(node, initial) {
          records.push(initial ? 'root' : 'patch');
          const value = fromCrossJSON<Stream<{ inner: Stream<number> }>>(node, {
            refs,
          });
          if (initial) {
            restored = value;
          }
        },
        onDone: resolve,
        onError: reject,
      });
    });
    const inner = createStream<number>();
    inner.next(1);
    inner.return(2);
    await producer.close({ inner });
    await done;
    expect(records).toEqual(['root', 'patch', 'patch', 'patch']);
    const outer = await collectValues(
      restored as Stream<{ inner: Stream<number> }>,
    );
    expect(outer).toHaveLength(1);
    expect(await collectValues(outer[0].inner)).toEqual([1, 2]);
  });

  it('materializes a live stream when parsing asynchronously', async () => {
    const { stream, producer } = createLiveStream<number>();
    const parsed = toCrossJSONAsync(stream);
    await producer.write(1);
    await producer.close(2);
    const restored = fromCrossJSON<Stream<number>>(await parsed, {
      refs: new Map(),
    });
    expect(await collectValues(restored)).toEqual([1, 2]);
  });

  it('does not retain accepted chunks, unlike a replay stream', async () => {
    const chunkSize = 1 << 20;
    const chunks = 16;
    function chunk(i: number): string {
      return String.fromCharCode(65 + i).repeat(chunkSize);
    }
    async function retainedAfter(
      setup: () => { value: unknown; push(i: number): Promise<void> },
    ): Promise<number> {
      const source = setup();
      let release: (() => void) | undefined;
      const cancel = crossSerializeStream(source.value, {
        onSerialize(_data, initial) {
          if (initial) {
            return;
          }
          return new Promise<void>(resolve => {
            release = resolve;
          });
        },
      });
      await collect();
      const before = process.memoryUsage().heapUsed;
      for (let i = 0; i < chunks; i++) {
        const pushed = source.push(i);
        await tick();
        (release as () => void)();
        await pushed;
      }
      await collect();
      const retained = process.memoryUsage().heapUsed - before;
      cancel();
      return retained;
    }
    const live = await retainedAfter(() => {
      const { stream, producer } = createLiveStream<string>();
      return {
        value: stream,
        push: i => producer.write(chunk(i)),
      };
    });
    const replay = await retainedAfter(() => {
      const stream = createStream<string>();
      return {
        value: stream,
        push: i => {
          stream.next(chunk(i));
          return Promise.resolve();
        },
      };
    });
    expect(replay).toBeGreaterThan(chunks * chunkSize * 0.9);
    expect(live).toBeLessThan(2 * chunkSize);
  });
});
