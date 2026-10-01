import {
  crossSerializeStream,
  fromCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
} from 'seroval';
import { describe, expect, it, vi } from 'vitest';
import { ReadableStreamPlugin } from '../../web';

function tick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function readAll<T>(stream: ReadableStream<T>): Promise<T[]> {
  const values: T[] = [];
  const reader = stream.getReader();
  for (;;) {
    const result = await reader.read();
    if (result.done) {
      return values;
    }
    values.push(result.value);
  }
}

describe('ReadableStream streaming parse', () => {
  it('pulls a chunk only after the previous record is accepted', async () => {
    const pulls: number[] = [];
    let release: (() => void) | undefined;
    const source = new ReadableStream<number>({
      pull(controller) {
        pulls.push(pulls.length);
        if (pulls.length > 3) {
          controller.close();
        } else {
          controller.enqueue(pulls.length);
        }
      },
    });
    let accepted = 0;
    const done = new Promise<void>((resolve, reject) => {
      crossSerializeStream(source, {
        plugins: [ReadableStreamPlugin],
        onSerialize(_data, initial) {
          if (initial) {
            return;
          }
          return new Promise<void>(resolve => {
            release = () => {
              accepted++;
              resolve();
            };
          });
        },
        onDone: resolve,
        onError: reject,
      });
    });
    while (accepted < 4) {
      await tick();
      // Node's default high-water mark lets the source pull one chunk ahead
      // of the reader; the parser itself never reads more than one ahead.
      expect(pulls.length - accepted).toBeLessThanOrEqual(2);
      (release as () => void)();
      release = undefined;
    }
    await done;
    expect(pulls).toEqual([0, 1, 2, 3]);
  });

  it('cancels the source when serialization is cancelled', async () => {
    const cancelled = vi.fn();
    // Enqueues once and then stays open, so the parser is left awaiting a
    // read when serialization is cancelled.
    const source = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1);
      },
      cancel: cancelled,
    });
    const cancel = crossSerializeStream(source, {
      plugins: [ReadableStreamPlugin],
      onSerialize() {
        // no-op
      },
    });
    await tick();
    cancel();
    await tick();
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(source.locked).toBe(false);
  });

  it('cancels the source when output fails', async () => {
    const cancelled = vi.fn();
    const source = new ReadableStream<number>({
      start(controller) {
        controller.enqueue(1);
      },
      cancel: cancelled,
    });
    const failure = new Error('closed');
    const onError = vi.fn();
    const onDone = vi.fn();
    crossSerializeStream(source, {
      plugins: [ReadableStreamPlugin],
      onSerialize(_data, initial) {
        if (!initial) {
          return Promise.reject(failure);
        }
      },
      onError,
      onDone,
    });
    await tick();
    await tick();
    expect(onError).toHaveBeenCalledWith(failure);
    expect(onDone).not.toHaveBeenCalled();
    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(cancelled.mock.calls[0][0]).toBe(failure);
  });

  it('round-trips through the streaming and async parsers', async () => {
    function source(): ReadableStream<string> {
      return new ReadableStream<string>({
        start(controller) {
          controller.enqueue('a');
          controller.enqueue('b');
          controller.close();
        },
      });
    }
    const refs = new Map();
    let restored: ReadableStream<string> | undefined;
    await new Promise<void>((resolve, reject) => {
      toCrossJSONStream(source(), {
        plugins: [ReadableStreamPlugin],
        onParse(node, initial) {
          const value = fromCrossJSON<ReadableStream<string>>(node, {
            plugins: [ReadableStreamPlugin],
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
    expect(await readAll(restored as ReadableStream<string>)).toEqual([
      'a',
      'b',
    ]);
    const materialized = fromCrossJSON<ReadableStream<string>>(
      await toCrossJSONAsync(source(), { plugins: [ReadableStreamPlugin] }),
      { plugins: [ReadableStreamPlugin], refs: new Map() },
    );
    expect(await readAll(materialized)).toEqual(['a', 'b']);
  });
});
