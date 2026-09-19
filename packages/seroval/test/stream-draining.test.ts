import { describe, expect, it } from 'vitest';
import { createStream, fromCrossJSON, toCrossJSONStream } from '../src';

describe('long async iterable streams', () => {
  it('emits buffered chunks before completing once', () => {
    const source = createStream<number>();
    source.next(1);
    source.return(2);
    const events: string[] = [];
    const refs = new Map();
    let restored: ReturnType<typeof createStream<number>> | undefined;
    const cancel = toCrossJSONStream(source, {
      onParse(node, initial) {
        const value = fromCrossJSON<ReturnType<typeof createStream<number>>>(
          node,
          { refs },
        );
        if (initial) {
          restored = value;
        }
        events.push(initial ? 'initial' : 'chunk');
      },
      onDone() {
        events.push('done');
      },
    });
    cancel();
    expect(events).toEqual(['initial', 'chunk', 'chunk', 'done']);
    const values: number[] = [];
    restored?.on({
      next(value) {
        values.push(value);
      },
      return(value) {
        values.push(value);
      },
      throw(error) {
        throw error;
      },
    });
    expect(values).toEqual([1, 2]);
  });

  it.each(['return', 'throw'])('preserves chunk order and %s', async mode => {
    async function* source() {
      await Promise.resolve();
      for (let i = 0; i < 10000; i++) {
        yield i;
      }
      if (mode === 'throw') {
        throw new Error('stream failed');
      }
      return 10000;
    }

    const refs = new Map();
    let restored: AsyncIterable<number> | undefined;
    await new Promise<void>((resolve, reject) => {
      toCrossJSONStream(source(), {
        onParse(node, initial) {
          const value = fromCrossJSON<AsyncIterable<number>>(node, { refs });
          if (initial) {
            restored = value;
          }
        },
        onDone: resolve,
        onError: reject,
      });
    });

    expect(restored).toBeDefined();
    const iterator = (restored as AsyncIterable<number>)[
      Symbol.asyncIterator
    ]();
    for (let i = 0; i < 10000; i++) {
      expect(await iterator.next()).toEqual({ done: false, value: i });
    }
    if (mode === 'throw') {
      await expect(async () => iterator.next()).rejects.toThrow(
        'stream failed',
      );
    } else {
      expect(await iterator.next()).toEqual({ done: true, value: 10000 });
    }
  });
});
