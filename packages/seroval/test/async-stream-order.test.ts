import { describe, expect, it } from 'vitest';
import {
  createLiveStream,
  createStream,
  fromJSON,
  type Stream,
  toJSONAsync,
} from '../src';

const events = (stream: Stream<unknown>) =>
  new Promise<unknown[]>(resolve => {
    const seen: unknown[] = [];
    stream.on({
      next: value => seen.push(value),
      throw: value => resolve([...seen, ['throw', value]]),
      return: value => resolve([...seen, ['return', value]]),
    });
  });

const later = <T>(value: T) =>
  new Promise<T>(resolve => setTimeout(() => resolve(value), 5));

describe('async stream event order', () => {
  it('keeps replay stream chunks before the terminal event', async () => {
    const source = createStream<unknown>();
    source.next(new Uint8Array([1]));
    source.next({ deferred: later(2) });
    source.next('c');
    source.return(undefined);
    const decoded = fromJSON(await toJSONAsync(source)) as Stream<unknown>;
    const seen = await events(decoded);
    expect(seen.length).toBe(4);
    expect([...(seen[0] as Uint8Array)]).toEqual([1]);
    await expect(
      (seen[1] as { deferred: Promise<number> }).deferred,
    ).resolves.toBe(2);
    expect(seen.slice(2)).toEqual(['c', ['return', undefined]]);
  });

  it('accepts a live event only after it is in place', async () => {
    const { stream, producer } = createLiveStream<unknown>();
    const order: string[] = [];
    const result = toJSONAsync(stream);
    const settle = later(1).then(value => {
      order.push('settled');
      return value;
    });
    await producer.write({ deferred: settle });
    order.push('accepted');
    await producer.write(new Uint8Array([2]));
    await producer.close(undefined);
    const decoded = fromJSON(await result) as Stream<unknown>;
    const seen = await events(decoded);
    expect(order).toEqual(['settled', 'accepted']);
    expect(seen.length).toBe(3);
    expect([...(seen[1] as Uint8Array)]).toEqual([2]);
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
    const record = (reason: unknown) => unhandled.push(reason);
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
      const [parseResult, sendResult] = await Promise.allSettled([
        parsed,
        sent,
      ]);
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      expect(parseResult.status).toBe('rejected');
      expect(sendResult.status).toBe('rejected');
      const primary = (parseResult as PromiseRejectedResult).reason as {
        cause?: unknown;
      };
      const cause = primary.cause;
      expect(cause).toBeInstanceOf(Error);
      expect((cause as Error).message).not.toBe('secondary cleanup failure');
      expect((sendResult as PromiseRejectedResult).reason).toBe(cause);
      expect(cancelled).toEqual([cause]);
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', record);
    }
  });

  it('surfaces a cleanup failure after a successful sequence', async () => {
    const unhandled: unknown[] = [];
    const record = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', record);
    try {
      const source = createStream<unknown>();
      const on = source.on;
      const failure = new Error('cleanup failed');
      source.on = listener => {
        on(listener);
        return () => {
          throw failure;
        };
      };
      source.next(new Uint8Array([1]));
      source.return(undefined);
      const result = await Promise.allSettled([toJSONAsync(source)]);
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setImmediate(resolve));
      expect(result[0].status).toBe('rejected');
      expect(
        ((result[0] as PromiseRejectedResult).reason as { cause?: unknown })
          .cause,
      ).toBe(failure);
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', record);
    }
  });
});
