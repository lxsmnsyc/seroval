import { assert, describe, expect, it } from 'vitest';
import {
  SerovalParserError,
  SerovalUnsupportedTypeError,
  crossSerialize,
  crossSerializeStream,
  serialize,
  toCrossJSON,
  toJSON,
} from '../src';

const SYNC_FUNCTIONS = {
  serialize: (value: unknown) => serialize(value),
  toJSON: (value: unknown) => toJSON(value),
  crossSerialize: (value: unknown) => crossSerialize(value),
  toCrossJSON: (value: unknown) => toCrossJSON(value),
};

async function* numbers(): AsyncGenerator<number> {
  await Promise.resolve();
  yield 1;
  yield 2;
}

function expectUnsupported(run: () => unknown, value: unknown): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  assert(caught instanceof SerovalParserError);
  const cause = caught.cause;
  assert(cause instanceof SerovalUnsupportedTypeError);
  expect(cause.value).toBe(value);
}

describe('async iterables in sync functions', () => {
  for (const [name, run] of Object.entries(SYNC_FUNCTIONS)) {
    it(`${name} rejects an async iterable`, () => {
      const iterable = numbers();
      expectUnsupported(() => run(iterable), iterable);
    });

    it(`${name} rejects a nested async iterable`, () => {
      const iterable = numbers();
      expectUnsupported(() => run({ value: [iterable] }), iterable);
    });

    it(`${name} rejects an object with Symbol.asyncIterator`, () => {
      const iterable = {
        title: 'Hello',
        async *[Symbol.asyncIterator](): AsyncGenerator<number> {
          yield 1;
        },
      };
      expectUnsupported(() => run(iterable), iterable);
    });
  }

  it('crossSerializeStream still sends async iterables', async () => {
    const chunks: string[] = [];
    await new Promise<void>((resolve, reject) => {
      crossSerializeStream(
        { value: numbers() },
        {
          onSerialize(chunk) {
            chunks.push(chunk);
          },
          onDone: resolve,
          onError: reject,
        },
      );
    });
    // The first chunk holds the object; the rest send the values.
    expect(chunks.length).toBeGreaterThan(1);
  });
});
