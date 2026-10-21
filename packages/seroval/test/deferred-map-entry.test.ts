import { describe, expect, it } from 'vitest';
import { crossSerialize, deserialize, serialize } from '../src';

// A Map entry whose key or value is the Map itself is set after the Map is
// created. A self-referencing Set inside the other half of that entry must
// be added to only after the entry creates it.
function createKeyCycle() {
  const set = new Set<unknown>();
  set.add(set);
  const map = new Map<unknown, unknown>();
  map.set(map, { set });
  return map;
}

function createValueCycle() {
  const set = new Set<unknown>();
  set.add(set);
  const map = new Map<unknown, unknown>();
  map.set({ set }, map);
  return map;
}

function checkKeyCycle(back: Map<unknown, unknown>) {
  const value = back.get(back) as { set: Set<unknown> };
  expect(value.set).toBeInstanceOf(Set);
  expect(value.set.has(value.set)).toBe(true);
}

function checkValueCycle(back: Map<unknown, unknown>) {
  const [[key, value]] = back;
  expect(value).toBe(back);
  const set = (key as { set: Set<unknown> }).set;
  expect(set).toBeInstanceOf(Set);
  expect(set.has(set)).toBe(true);
}

function crossDeserialize<T>(source: string): T {
  return new Function('$R', 'return ' + source)([]) as T;
}

describe('deferred Map entry', () => {
  describe('serialize', () => {
    it('creates a nested Set before adding to it when the key is the Map', () => {
      checkKeyCycle(deserialize(serialize(createKeyCycle())));
    });
    it('creates a nested Set before adding to it when the value is the Map', () => {
      checkValueCycle(deserialize(serialize(createValueCycle())));
    });
  });
  describe('crossSerialize', () => {
    it('creates a nested Set before adding to it when the key is the Map', () => {
      checkKeyCycle(crossDeserialize(crossSerialize(createKeyCycle())));
    });
    it('creates a nested Set before adding to it when the value is the Map', () => {
      checkValueCycle(crossDeserialize(crossSerialize(createValueCycle())));
    });
  });
});
