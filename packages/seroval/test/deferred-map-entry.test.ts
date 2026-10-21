import { describe, expect, it } from 'vitest';
import { crossSerialize, deserialize, serialize } from '../src';

// A Map entry whose key or value is the Map itself is set after the Map is
// created. A self-referencing Set inside the other half of that entry must
// be added to only after the entry creates it.
function createKeyCycle(): Map<unknown, unknown> {
  const set = new Set<unknown>();
  set.add(set);
  const map = new Map<unknown, unknown>();
  map.set(map, { set });
  return map;
}

function createValueCycle(): Map<unknown, unknown> {
  const set = new Set<unknown>();
  set.add(set);
  const map = new Map<unknown, unknown>();
  map.set({ set }, map);
  return map;
}

function checkSelfSet(holder: unknown): void {
  if (holder == null || typeof holder !== 'object' || !('set' in holder)) {
    throw new TypeError('expected an object with a set');
  }
  const set = holder.set;
  expect(set).toBeInstanceOf(Set);
  expect(set instanceof Set && set.has(set)).toBe(true);
}

function checkKeyCycle(back: Map<unknown, unknown>): void {
  checkSelfSet(back.get(back));
}

function checkValueCycle(back: Map<unknown, unknown>): void {
  const [[key, value]] = back;
  expect(value).toBe(back);
  checkSelfSet(key);
}

// The other half of such an entry holds an object that a later entry also
// reads. The object must exist before that later entry runs.
function createSharedKeyCycle(): Map<unknown, unknown> {
  const shared = {};
  const map = new Map<unknown, unknown>();
  map.set(map, { shared });
  map.set({ shared }, 1);
  return map;
}

function createSharedValueCycle(): Map<unknown, unknown> {
  const shared = {};
  const map = new Map<unknown, unknown>();
  map.set({ shared }, map);
  map.set(1, { shared });
  return map;
}

function checkShared(back: Map<unknown, unknown>): void {
  const holders = [...back]
    .flat()
    .filter(
      (item): item is { shared: object } =>
        item != null && typeof item === 'object' && 'shared' in item,
    );
  expect(holders).toHaveLength(2);
  expect(holders[0].shared).toBeTypeOf('object');
  expect(holders[0].shared).toBe(holders[1].shared);
}

function crossDeserialize(source: string): Map<unknown, unknown> {
  // oxlint-disable-next-line eslint/no-new-func, typescript/no-implied-eval, typescript/no-unsafe-call, typescript/no-unsafe-type-assertion -- evaluates the serialized output.
  return new Function('$R', 'return ' + source)([]) as Map<unknown, unknown>;
}

describe('deferred Map entry', () => {
  describe('serialize', () => {
    it('creates a nested Set before adding to it when the key is the Map', () => {
      checkKeyCycle(deserialize(serialize(createKeyCycle())));
    });
    it('creates a nested Set before adding to it when the value is the Map', () => {
      checkValueCycle(deserialize(serialize(createValueCycle())));
    });
    it('creates a shared object before a later entry reads it when the key is the Map', () => {
      checkShared(deserialize(serialize(createSharedKeyCycle())));
    });
    it('creates a shared object before a later entry reads it when the value is the Map', () => {
      checkShared(deserialize(serialize(createSharedValueCycle())));
    });
  });
  describe('crossSerialize', () => {
    it('creates a nested Set before adding to it when the key is the Map', () => {
      checkKeyCycle(crossDeserialize(crossSerialize(createKeyCycle())));
    });
    it('creates a nested Set before adding to it when the value is the Map', () => {
      checkValueCycle(crossDeserialize(crossSerialize(createValueCycle())));
    });
    it('creates a shared object before a later entry reads it when the key is the Map', () => {
      checkShared(crossDeserialize(crossSerialize(createSharedKeyCycle())));
    });
    it('creates a shared object before a later entry reads it when the value is the Map', () => {
      checkShared(crossDeserialize(crossSerialize(createSharedValueCycle())));
    });
  });
});
