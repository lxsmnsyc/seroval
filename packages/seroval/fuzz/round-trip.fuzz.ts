import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  compileJSON,
  crossSerialize,
  crossSerializeAsync,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toJSON,
  toJSONAsync,
} from '../src';
import { FUZZ_PARAMETERS, valueArb } from './arbitraries';
import findDifference from './compare';

// Runs cross-reference output the way a page would: `$R` holds the references.
function evaluateCross(source: string): unknown {
  // oxlint-disable-next-line no-new-func, no-implied-eval, no-unsafe-call -- The fuzzer runs the output it just produced.
  return new Function('$R', `return ${source}`)([]) as unknown;
}

// Writes the JSON node tree out as text and reads it back, as a transport would.
function sendJSON<T>(value: T): T {
  // oxlint-disable-next-line no-unsafe-type-assertion -- The text came from a T.
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectSame(actual: unknown, expected: unknown): void {
  const difference = findDifference(actual, expected);
  if (difference) {
    throw new Error(`the decoded value differs at ${difference}`);
  }
}

function expectScriptSafe(output: string): void {
  expect(output).not.toMatch(/<\/script|<!--/i);
  expect(output).not.toMatch(/[\u2028\u2029]/);
}

describe('round trip', () => {
  it('serialize', () => {
    fc.assert(
      fc.property(valueArb, (value) => {
        const output = serialize(value);
        expectScriptSafe(output);
        expectSame(deserialize(output), value);
      }),
      FUZZ_PARAMETERS,
    );
  });

  it('toJSON and fromJSON', () => {
    fc.assert(
      fc.property(valueArb, (value) => {
        expectSame(fromJSON(sendJSON(toJSON(value))), value);
      }),
      FUZZ_PARAMETERS,
    );
  });

  it('toJSON and compileJSON', () => {
    fc.assert(
      fc.property(valueArb, (value) => {
        const output = compileJSON(sendJSON(toJSON(value)));
        expectScriptSafe(output);
        expectSame(deserialize(output), value);
      }),
      FUZZ_PARAMETERS,
    );
  });

  it('crossSerialize', () => {
    fc.assert(
      fc.property(valueArb, (value) => {
        const output = crossSerialize(value);
        expectScriptSafe(output);
        expectSame(evaluateCross(output), value);
      }),
      FUZZ_PARAMETERS,
    );
  });

  it('toCrossJSON and fromCrossJSON', () => {
    fc.assert(
      fc.property(valueArb, (value) => {
        const node = sendJSON(toCrossJSON(value));
        expectSame(fromCrossJSON(node, { refs: new Map() }), value);
      }),
      FUZZ_PARAMETERS,
    );
  });

  it('serializeAsync', async () => {
    await fc.assert(
      fc.asyncProperty(valueArb, async (value) => {
        const output = await serializeAsync(value);
        expectScriptSafe(output);
        expectSame(await deserialize(output), value);
      }),
      FUZZ_PARAMETERS,
    );
  });

  it('toJSONAsync and fromJSON', async () => {
    await fc.assert(
      fc.asyncProperty(valueArb, async (value) => {
        expectSame(fromJSON(sendJSON(await toJSONAsync(value))), value);
      }),
      FUZZ_PARAMETERS,
    );
  });

  it('crossSerializeAsync', async () => {
    await fc.assert(
      fc.asyncProperty(valueArb, async (value) => {
        const output = await crossSerializeAsync(value);
        expectScriptSafe(output);
        expectSame(await evaluateCross(output), value);
      }),
      FUZZ_PARAMETERS,
    );
  });

  it('toCrossJSONAsync and fromCrossJSON', async () => {
    await fc.assert(
      fc.asyncProperty(valueArb, async (value) => {
        const node = sendJSON(await toCrossJSONAsync(value));
        expectSame(fromCrossJSON(node, { refs: new Map() }), value);
      }),
      FUZZ_PARAMETERS,
    );
  });

  it('a promise of the value survives the async modes', async () => {
    await fc.assert(
      fc.asyncProperty(valueArb, async (value) => {
        const source = { value: Promise.resolve(value) };
        const vanilla = deserialize<typeof source>(await serializeAsync(source));
        expectSame(await vanilla.value, value);
        const json = fromJSON<typeof source>(sendJSON(await toJSONAsync(source)));
        expectSame(await json.value, value);
      }),
      FUZZ_PARAMETERS,
    );
  });
});
