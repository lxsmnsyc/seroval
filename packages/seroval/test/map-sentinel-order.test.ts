import { describe, expect, it } from 'vitest';
import { crossSerialize, deserialize, serialize } from '../src';

// The outer Map's first entry uses the sentinel placeholder. A Map inside its
// second entry must not be the one that declares the sentinel, because that
// declaration runs after the placeholder.
function createSource() {
  const shared = {};
  const map = new Map<unknown, unknown>();
  map.set(map, shared);
  map.set(1, { inner: new Map([[1, 2]]), shared });
  return { map, shared };
}

function check(back: Map<unknown, unknown>) {
  expect(back.size).toBe(2);
  expect([...back.keys()]).toEqual([1, back]);
  const entry = back.get(1) as { inner: Map<number, number>; shared: object };
  expect(back.get(back)).toBe(entry.shared);
  expect(entry.inner.get(1)).toBe(2);
}

describe('Map sentinel order', () => {
  it('declares the sentinel before an outer entry uses it in serialize', () => {
    check(deserialize(serialize(createSource().map)));
  });
  it('declares the sentinel before an outer entry uses it in crossSerialize', () => {
    const source = crossSerialize(createSource().map);
    check(new Function('$R', 'return ' + source)([]));
  });
});
