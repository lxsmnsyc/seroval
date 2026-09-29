import { deepStrictEqual, strictEqual } from 'node:assert';
import { test } from 'vitest';
import { deserialize, fromJSON, serialize, toJSON } from '../src';

const options = {
  time: 1000,
  iterations: 10,
  warmupTime: 200,
  warmupIterations: 2,
};

for (const length of [2, 4, 8, 12, 16, 32]) {
  for (const escaped of [false, true]) {
    test(`${escaped ? 'escaped' : 'plain'} keys / ${length} code units`, async ({
      bench,
    }) => {
      const suffixes = escaped ? ['"', '\\', '\n', '<'] : ['x', 'x', 'x', 'x'];
      const keys = suffixes.map(
        (suffix, index) =>
          String.fromCharCode(97 + index) + 'x'.repeat(length - 2) + suffix,
      );
      const value = Array.from({ length: 20_000 }, (_, index) =>
        Object.fromEntries(keys.map((key, offset) => [key, index + offset])),
      );
      const json = toJSON(value);

      strictEqual(value.length, 20_000);
      deepStrictEqual(
        Object.keys(value[0]).map(key => key.length),
        [length, length, length, length],
      );
      deepStrictEqual(fromJSON(json), value);
      deepStrictEqual(deserialize(serialize(value)), value);

      await bench('serialize', () => serialize(value)).run(options);
      await bench('toJSON', () => toJSON(value)).run(options);
      await bench('fromJSON', () => fromJSON(json)).run(options);
    }, 30_000);
  }
}
