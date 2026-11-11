import fc from 'fast-check';
import { describe, it } from 'vitest';
import { FUZZ_PARAMETERS, valueArb } from './arbitraries';
import { cutsArb, decode, encode, settleWithin, split } from './binary';
import findDifference from './compare';

function expectSame(actual: unknown, expected: unknown): void {
  const difference = findDifference(actual, expected);
  if (difference) {
    throw new Error(`the decoded value differs at ${difference}`);
  }
}

function rethrow(error: unknown): never {
  throw error;
}

describe('binary round trip', () => {
  it('serialize and deserialize', async () => {
    await fc.assert(
      fc.asyncProperty(valueArb, cutsArb, async (value, cuts) => {
        const bytes = await encode(value);
        const result = await settleWithin(
          decode(split(bytes, cuts), { onError: rethrow }),
          'deserialize',
        );
        expectSame(result.value, value);
      }),
      FUZZ_PARAMETERS,
    );
  });

  it('a promise of the value', async () => {
    await fc.assert(
      fc.asyncProperty(valueArb, cutsArb, async (value, cuts) => {
        const bytes = await encode({ value: Promise.resolve(value) });
        const result = await settleWithin(
          decode<{ value: Promise<unknown> }>(split(bytes, cuts), { onError: rethrow }),
          'deserialize',
        );
        expectSame(await settleWithin(result.value.value, 'the decoded promise'), value);
      }),
      FUZZ_PARAMETERS,
    );
  });
});
