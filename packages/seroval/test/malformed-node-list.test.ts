import { describe, expect, it } from 'vitest';
import { fromCrossJSON, fromJSON, toCrossJSON, toJSON } from '../src';

// A node's element list must be a real array. A non-array such as
// `{ length: N }` or `{ length: 'Infinity' }` would otherwise drive allocation
// and iteration with no matching data on the wire.
describe('malformed node element lists', () => {
  function tamperedArray(length: unknown): ReturnType<typeof toJSON> {
    const json = toJSON([1]);
    (json.t as unknown as { a: unknown }).a = { length };
    return json;
  }

  it.each([2_000_000, 'Infinity', -1, 1.5, null])(
    'rejects a fromJSON array node whose `a` is not an array (length %p)',
    length => {
      expect(() => fromJSON(tamperedArray(length))).toThrow();
    },
  );

  it('rejects a fromCrossJSON array node whose `a` is not an array', () => {
    const json = toCrossJSON([1]);
    (json as unknown as { a: unknown }).a = { length: 2_000_000 };
    expect(() => fromCrossJSON(json, { refs: new Map() })).toThrow();
  });

  it('accepts a genuine array node', () => {
    expect(fromJSON<number[]>(toJSON([1, 2, 3]))).toEqual([1, 2, 3]);
  });

  it('rejects a Set node whose `a` is not an array', () => {
    const json = toJSON(new Set([1]));
    (json.t as unknown as { a: unknown }).a = { length: 2_000_000 };
    expect(() => fromJSON(json)).toThrow();
  });

  it('rejects a Map node whose entry keys are not an array', () => {
    const json = toJSON(new Map([[1, 2]]));
    (json.t as unknown as { e: { k: unknown } }).e.k = { length: 2_000_000 };
    expect(() => fromJSON(json)).toThrow();
  });
});
