import {
  crossSerializeAsync,
  serializeAsync,
  toCrossJSONAsync,
  toJSONAsync,
} from 'seroval';
import { describe, expect, it } from 'vitest';
import ReadableStreamPlugin from '../../web/readable-stream';

const serializers = [
  ['serializeAsync', serializeAsync],
  ['toJSONAsync', toJSONAsync],
  ['crossSerializeAsync', crossSerializeAsync],
  ['toCrossJSONAsync', toCrossJSONAsync],
] as const;

describe.each(serializers)('%s reader cleanup', (_name, serialize) => {
  it.each([0, 3])(
    'releases a reader that errors after %i chunks',
    async chunks => {
      const error = new Error('source failed');
      let count = 0;
      const source = new ReadableStream<number>({
        pull(controller) {
          if (count === chunks) {
            controller.error(error);
          } else {
            controller.enqueue(count++);
          }
        },
      });
      await serialize(source, { plugins: [ReadableStreamPlugin] });
      expect(source.locked).toBe(false);
      const reader = source.getReader();
      await expect(reader.read()).rejects.toBe(error);
      reader.releaseLock();
    },
  );
});
