import { assert, describe, expect, it } from 'vitest';
import { type Stream, createLiveStream, createStream, fromJSON, toJSONAsync } from '../src';

const events = async (stream: Stream<unknown>): Promise<unknown[]> =>
  new Promise<unknown[]>((resolve) => {
    const seen: unknown[] = [];
    stream.on({
      next: (value) => {
        seen.push(value);
      },
      throw: (value) => {
        resolve([...seen, ['throw', value]]);
      },
      return: (value) => {
        resolve([...seen, ['return', value]]);
      },
    });
  });

const later = async <T>(value: T): Promise<T> =>
  new Promise<T>((resolve) => {
    setTimeout(() => {
      resolve(value);
    }, 5);
  });

describe('async stream event order', () => {
  it('keeps replay stream chunks before the terminal event', async () => {
    const source = createStream<unknown>();
    source.next(new Uint8Array([1]));
    source.next({ deferred: later(2) });
    source.next('c');
    source.return(undefined);
    const decoded = fromJSON<Stream<unknown>>(await toJSONAsync(source));
    const seen = await events(decoded);
    expect(seen.length).toBe(4);
    const [bytes, record] = seen;
    assert(bytes instanceof Uint8Array);
    expect([...bytes]).toEqual([1]);
    assert(typeof record === 'object' && record !== null && 'deferred' in record);
    await expect(record.deferred).resolves.toBe(2);
    expect(seen.slice(2)).toEqual(['c', ['return', undefined]]);
  });

  it('accepts a live event only after it is in place', async () => {
    const { stream, producer } = createLiveStream<unknown>();
    const order: string[] = [];
    const result = toJSONAsync(stream);
    const settle = later(1).then((value) => {
      order.push('settled');
      return value;
    });
    await producer.write({ deferred: settle });
    order.push('accepted');
    await producer.write(new Uint8Array([2]));
    await producer.close(undefined);
    const decoded = fromJSON<Stream<unknown>>(await result);
    const seen = await events(decoded);
    expect(order).toEqual(['settled', 'accepted']);
    expect(seen.length).toBe(3);
    const bytes = seen[1];
    assert(bytes instanceof Uint8Array);
    expect([...bytes]).toEqual([2]);
    expect(seen[2]).toEqual(['return', undefined]);
  });

  it('rejects once when a chunk fails to parse', async () => {
    const source = createStream<unknown>();
    source.next(Symbol('unsupported'));
    source.next(Symbol('also unsupported'));
    source.return(undefined);
    await expect(toJSONAsync(source)).rejects.toThrow();
  });
  it('shares the original parse failure and keeps cleanup failure secondary', async () => {
    const unhandled: unknown[] = [];
    const record = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', record);
    try {
      const cancelled: unknown[] = [];
      const { stream, producer } = createLiveStream<unknown>({
        onCancel(reason) {
          cancelled.push(reason);
          throw new Error('secondary cleanup failure');
        },
      });
      const parsed = toJSONAsync(stream);
      const sent = producer.write(Symbol('unsupported'));
      const [parseResult, sendResult] = await Promise.allSettled([parsed, sent]);
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      assert(parseResult.status === 'rejected');
      assert(sendResult.status === 'rejected');
      const primary: unknown = parseResult.reason;
      assert(typeof primary === 'object' && primary !== null && 'cause' in primary);
      const cause = primary.cause;
      assert(cause instanceof Error);
      expect(cause.message).not.toBe('secondary cleanup failure');
      expect(sendResult.reason).toBe(cause);
      expect(cancelled).toEqual([cause]);
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', record);
    }
  });

  it('surfaces a cleanup failure after a successful sequence', async () => {
    const unhandled: unknown[] = [];
    const record = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', record);
    try {
      const source = createStream<unknown>();
      const on = source.on.bind(source);
      const failure = new Error('cleanup failed');
      source.on = (listener) => {
        on(listener);
        return () => {
          throw failure;
        };
      };
      source.next(new Uint8Array([1]));
      source.return(undefined);
      const [result] = await Promise.allSettled([toJSONAsync(source)]);
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      assert(result.status === 'rejected');
      const reason: unknown = result.reason;
      assert(typeof reason === 'object' && reason !== null && 'cause' in reason);
      expect(reason.cause).toBe(failure);
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', record);
    }
  });
});
