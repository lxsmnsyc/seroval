import { describe, expect, it } from 'vitest';
import { crossSerialize, deserialize, serialize } from '../src';

// The outer Map's first entry uses the sentinel placeholder. A Map inside its
// second entry must not be the one that declares the sentinel, because that
// declaration runs after the placeholder.
function createSource(): Map<unknown, unknown> {
  const shared = {};
  const map = new Map<unknown, unknown>();
  map.set(map, shared);
  map.set(1, { inner: new Map([[1, 2]]), shared });
  return map;
}

function check(back: Map<unknown, unknown>): void {
  expect(back.size).toBe(2);
  expect([...back.keys()]).toEqual([1, back]);
  const entry = back.get(1);
  if (entry == null || typeof entry !== 'object' || !('inner' in entry) || !('shared' in entry)) {
    throw new TypeError('expected the second entry to hold inner and shared');
  }
  expect(back.get(back)).toBe(entry.shared);
  expect(entry.inner).toBeInstanceOf(Map);
  expect(entry.inner instanceof Map && entry.inner.get(1)).toBe(2);
}

describe('Map sentinel order', () => {
  it('declares the sentinel before an outer entry uses it in serialize', () => {
    check(deserialize(serialize(createSource())));
  });
  it('declares the sentinel before an outer entry uses it in crossSerialize', () => {
    const source = crossSerialize(createSource());
    // oxlint-disable-next-line eslint/no-new-func, typescript/no-implied-eval, typescript/no-unsafe-call, typescript/no-unsafe-type-assertion -- evaluates the serialized output.
    check(new Function('$R', 'return ' + source)([]) as Map<unknown, unknown>);
  });
});
