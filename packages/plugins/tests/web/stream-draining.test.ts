import { fromCrossJSON, toCrossJSONStream } from 'seroval';
import { expect, it } from 'vitest';
import ReadableStreamPlugin from '../../web/readable-stream';

it('preserves all chunks while draining a long ReadableStream', async () => {
  let next = 0;
  const source = new ReadableStream<number>({
    pull(controller) {
      if (next === 10000) {
        controller.close();
      } else {
        controller.enqueue(next++);
      }
    },
  });
  const refs = new Map();
  const plugins = [ReadableStreamPlugin];
  let restored: ReadableStream<number> | undefined;
  await new Promise<void>((resolve, reject) => {
    toCrossJSONStream(source, {
      plugins,
      onParse(node, initial) {
        const value = fromCrossJSON<ReadableStream<number>>(node, {
          refs,
          plugins,
        });
        if (initial) {
          restored = value;
        }
      },
      onDone: resolve,
      onError: reject,
    });
  });
  expect(source.locked).toBe(false);
  const reader = (restored as ReadableStream<number>).getReader();
  for (let i = 0; i < 10000; i++) {
    expect(await reader.read()).toEqual({ done: false, value: i });
  }
  expect(await reader.read()).toEqual({ done: true, value: undefined });
  reader.releaseLock();
});
