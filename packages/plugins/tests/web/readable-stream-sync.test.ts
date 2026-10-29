import {
  SerovalParserError,
  SerovalUnsupportedTypeError,
  crossSerialize,
  serialize,
  toCrossJSON,
  toJSON,
} from 'seroval';
import { assert, describe, expect, it } from 'vitest';
import ReadableStreamPlugin from '../../web/readable-stream';

const plugins = [ReadableStreamPlugin];

const SYNC_FUNCTIONS = {
  serialize: (value: unknown) => serialize(value, { plugins }),
  toJSON: (value: unknown) => toJSON(value, { plugins }),
  crossSerialize: (value: unknown) => crossSerialize(value, { plugins }),
  toCrossJSON: (value: unknown) => toCrossJSON(value, { plugins }),
};

describe('ReadableStream in sync functions', () => {
  for (const [name, run] of Object.entries(SYNC_FUNCTIONS)) {
    it(`${name} rejects a ReadableStream`, () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue('a');
          controller.close();
        },
      });
      let caught: unknown;
      try {
        run({ value: stream });
      } catch (error) {
        caught = error;
      }
      assert(caught instanceof SerovalParserError);
      const cause = caught.cause;
      assert(cause instanceof SerovalUnsupportedTypeError);
      expect(cause.value).toBe(stream);
    });
  }
});
