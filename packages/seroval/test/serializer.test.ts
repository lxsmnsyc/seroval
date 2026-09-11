import { describe, expect, it, vi } from 'vitest';
import { createStream, Serializer } from '../src';

describe('Serializer lifecycle', () => {
  it.each(['flush', 'close'] as const)(
    'completes once when %s reenters close',
    operation => {
      const onData = vi.fn();
      const onDone = vi.fn(() => {
        writer.write('late', 2);
        writer.close();
      });
      const writer = new Serializer({
        globalIdentifier: 'values',
        onData,
        onDone,
        onError: error => {
          throw error;
        },
      });
      writer.write('value', 1);
      onData.mockClear();
      writer[operation]();
      writer.close();
      expect(onDone).toHaveBeenCalledTimes(1);
      expect(onData).not.toHaveBeenCalled();
      expect([...writer.keys]).toEqual(['value']);
    },
  );

  it('releases a subscription when onData closes an active write', () => {
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
    const onData = vi.fn(() => writer.close());
    const writer = new Serializer({
      globalIdentifier: 'values',
      onData,
      onError: error => {
        throw error;
      },
    });
    writer.write('stream', source);
    expect(subscribed).toBe(false);
    onData.mockClear();
    source.next(1);
    expect(onData).not.toHaveBeenCalled();
  });

  it('releases every subscription when a cleanup throws', () => {
    const failure = new Error('cleanup failed');
    const sources = [createStream<number>(), createStream<number>()];
    const active = new Set<number>();
    sources.forEach((source, index) => {
      const subscribe = source.on;
      source.on = listener => {
        active.add(index);
        const unsubscribe = subscribe(listener);
        return () => {
          active.delete(index);
          unsubscribe();
          if (index === 0) {
            throw failure;
          }
        };
      };
    });
    const onDone = vi.fn();
    const writer = new Serializer({
      globalIdentifier: 'values',
      onData: vi.fn(),
      onDone,
      onError: error => {
        throw error;
      },
    });
    sources.forEach((source, index) => {
      writer.write(String(index), source);
    });
    expect(() => writer.close()).toThrow(failure);
    expect([...active]).toEqual([]);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(() => writer.close()).not.toThrow();
  });

  it('ignores pending promise output after closure', async () => {
    let resolveValue: (value: number) => void = vi.fn();
    const pending = new Promise<number>(resolve => {
      resolveValue = resolve;
    });
    const onData = vi.fn();
    const onDone = vi.fn();
    const writer = new Serializer({
      globalIdentifier: 'values',
      onData,
      onDone,
      onError: error => {
        throw error;
      },
    });
    writer.write('value', pending);
    writer.close();
    onData.mockClear();
    resolveValue(1);
    await pending;
    await Promise.resolve();
    expect(onData).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('completes once when a flushed promise closes the writer', async () => {
    const pending = Promise.resolve(1);
    const onDone = vi.fn(() => writer.close());
    const writer = new Serializer({
      globalIdentifier: 'values',
      onData: vi.fn(),
      onDone,
      onError: error => {
        throw error;
      },
    });
    writer.write('value', pending);
    writer.flush();
    await pending;
    await Promise.resolve();
    writer.close();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stays closed when its completion callback throws', () => {
    const failure = new Error('completion failed');
    const onData = vi.fn();
    const writer = new Serializer({
      globalIdentifier: 'values',
      onData,
      onDone: () => {
        throw failure;
      },
      onError: error => {
        throw error;
      },
    });
    writer.write('value', 1);
    expect(() => writer.close()).toThrow(failure);
    onData.mockClear();
    writer.write('late', 2);
    expect(() => writer.close()).not.toThrow();
    expect(onData).not.toHaveBeenCalled();
  });

  it('keeps other writers reference state independent', () => {
    const values: Record<string, unknown>[] = [{}, {}];
    const writers = values.map(output => {
      const refs: unknown[] = [];
      return new Serializer({
        globalIdentifier: 'values',
        onData: source => new Function('values', '$R', source)(output, refs),
        onError: error => {
          throw error;
        },
      });
    });
    const shared = { value: 1 };
    writers[0].write('first', shared);
    writers[1].write('first', shared);
    writers[0].close();
    writers[1].write('again', shared);
    writers[1].close();
    expect(values[1].again).toBe(values[1].first);
    expect(values[0].first).not.toBe(values[1].first);
  });
});
