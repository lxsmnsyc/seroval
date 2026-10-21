import { assert, describe, expect, it } from 'vitest';
import {
  SerovalParserError,
  SerovalUnsupportedTypeError,
  crossSerialize,
  crossSerializeStream,
  deserialize,
  serialize,
  serializeAsync,
  toCrossJSON,
  toJSON,
} from '../src';

const SYNC_FUNCTIONS = {
  serialize: (value: unknown) => serialize(value),
  toJSON: (value: unknown) => toJSON(value),
  crossSerialize: (value: unknown) => crossSerialize(value),
  toCrossJSON: (value: unknown) => toCrossJSON(value),
};

function expectUnsupportedPromise(run: () => unknown, promise: unknown): void {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  assert(caught instanceof SerovalParserError);
  const cause = caught.cause;
  assert(cause instanceof SerovalUnsupportedTypeError);
  expect(cause.value).toBe(promise);
}

describe('promises in sync functions', () => {
  for (const [name, run] of Object.entries(SYNC_FUNCTIONS)) {
    it(`${name} rejects a promise`, () => {
      const promise = Promise.resolve(1);
      expectUnsupportedPromise(() => run(promise), promise);
    });

    it(`${name} rejects a nested promise`, () => {
      const promise = Promise.resolve(1);
      expectUnsupportedPromise(() => run({ value: [promise] }), promise);
    });
  }

  it('serializeAsync still sends promises', async () => {
    const result = await serializeAsync({ value: Promise.resolve(1) });
    expect(await deserialize<{ value: Promise<number> }>(result).value).toBe(1);
  });

  it('crossSerializeStream still sends promises', async () => {
    const chunks: string[] = [];
    await new Promise<void>((resolve, reject) => {
      crossSerializeStream(
        { value: Promise.resolve(1) },
        {
          onSerialize(chunk) {
            chunks.push(chunk);
          },
          onDone: resolve,
          onError: reject,
        },
      );
    });
    expect(chunks).toHaveLength(2);
  });

  it('serializeAsync preserves cyclic rejected promises', async () => {
    const error = new Error('cyclic');
    const rejected = Promise.reject(error);
    rejected.catch(() => undefined);
    Object.assign(error, { self: rejected });
    const result = await serializeAsync(error);
    expect(result).toContain('Promise.reject().catch(()=>{throw h})');
    const restored = deserialize<Error & { self: Promise<unknown> }>(result);
    await expect(restored.self).rejects.toBe(restored);
  });
});
