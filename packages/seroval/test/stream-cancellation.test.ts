import { describe, expect, it, vi } from 'vitest';
import { createStream, crossSerializeStream, toCrossJSONStream } from '../src';

const serializers = [
  [
    'JSON',
    (value: unknown, emit: () => void) =>
      toCrossJSONStream(value, { onParse: emit }),
  ],
  [
    'JavaScript',
    (value: unknown, emit: () => void) =>
      crossSerializeStream(value, { onSerialize: emit }),
  ],
] as const;

describe.each(serializers)('%s stream subscriptions', (name, serialize) => {
  it.each(['cancel', 'return', 'throw'] as const)(
    'releases its subscription after %s',
    mode => {
      const source = createStream<number>();
      const subscribe = source.on;
      let subscribed = false;
      source.on = listener => {
        subscribed = true;
        const unsubscribe = subscribe(listener);
        return () => {
          subscribed = false;
          unsubscribe();
        };
      };
      const emit = vi.fn();
      const cancel = serialize(source, emit);
      expect(subscribed).toBe(true);
      if (mode === 'cancel') {
        cancel();
      } else {
        source[mode](1);
      }
      expect(subscribed).toBe(false);
      emit.mockClear();
      source.next(2);
      expect(emit).not.toHaveBeenCalled();
    },
  );

  it('completes once when the completion callback cancels serialization', () => {
    const source = createStream<number>();
    let completions = 0;
    const options = {
      onParse: vi.fn(),
      onSerialize: vi.fn(),
      onDone() {
        completions++;
        cancel();
      },
    };
    const cancel =
      name === 'JSON'
        ? toCrossJSONStream(source, options)
        : crossSerializeStream(source, options);
    source.return(1);
    cancel();
    expect(completions).toBe(1);
  });
});

describe.each(serializers)(
  '%s async iterator cancellation',
  (_name, serialize) => {
    it('stops pulling and runs generator cleanup when serialization stops', async () => {
      let pulled = 0;
      let closed = false;
      async function* source() {
        await Promise.resolve();
        try {
          for (let i = 0; i < 1000; i++) {
            pulled++;
            yield i;
          }
        } finally {
          closed = true;
        }
      }
      let emitted = 0;
      const cancel = serialize(source(), () => {
        if (++emitted === 4) {
          cancel();
        }
      });
      await vi.waitFor(() => expect(closed).toBe(true));
      expect(pulled).toBe(3);
      expect(emitted).toBe(4);
      cancel();
      expect(pulled).toBe(3);
    });

    it('closes once and ignores a read that settles after cancellation', async () => {
      let settle: (value: IteratorResult<number>) => void = vi.fn();
      const pending = new Promise<IteratorResult<number>>(resolve => {
        settle = resolve;
      });
      const next = vi
        .fn<() => Promise<IteratorResult<number>>>()
        .mockReturnValueOnce(pending)
        .mockResolvedValue({ done: true, value: undefined });
      const close = vi.fn(() =>
        Promise.resolve({ done: true, value: undefined }),
      );
      const source = {
        [Symbol.asyncIterator]() {
          return { next, return: close };
        },
      };
      const emit = vi.fn();
      const cancel = serialize(source, emit);
      cancel();
      cancel();
      settle({ done: false, value: 1 });
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(next).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledTimes(1);
      expect(emit).toHaveBeenCalledTimes(1);
    });

    it('does not close an iterator that completed normally', async () => {
      const next = vi.fn(() =>
        Promise.resolve({ done: true, value: undefined }),
      );
      const close = vi.fn(() =>
        Promise.resolve({ done: true, value: undefined }),
      );
      const source = {
        [Symbol.asyncIterator]() {
          return { next, return: close };
        },
      };
      const cancel = serialize(source, vi.fn());
      await new Promise(resolve => setTimeout(resolve, 0));
      cancel();
      expect(next).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
    });

    it.each(['throw', 'reject'])(
      'handles an iterator return that can %s',
      async mode => {
        const next = vi
          .fn<() => Promise<IteratorResult<number>>>()
          .mockResolvedValueOnce({ done: false, value: 1 })
          .mockResolvedValue({ done: true, value: undefined });
        const close = vi.fn(() => {
          const error = new Error('cleanup failed');
          if (mode === 'throw') {
            throw error;
          }
          return Promise.reject(error);
        });
        const source = {
          [Symbol.asyncIterator]() {
            return { next, return: close };
          },
        };
        const cancel = serialize(source, vi.fn());
        cancel();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(next).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledTimes(1);
      },
    );
  },
);
