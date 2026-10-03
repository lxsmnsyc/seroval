import { describe, expect, it } from 'vitest';
import { deserialize, fromJSON, serialize, toJSON } from '../src';

// Serializing an iterable reads it to the end. An error from `next()` must end
// the read, or an iterator that always throws would never finish.
describe('iterables that throw', () => {
  function alwaysThrows(): Iterable<number> {
    return {
      [Symbol.iterator]() {
        return {
          next(): IteratorResult<number> {
            throw new Error('fail');
          },
        };
      },
    };
  }

  function throwsAfterOne(): Iterable<number> {
    return {
      *[Symbol.iterator]() {
        yield 1;
        throw new Error('fail');
      },
    };
  }

  function check(back: Iterable<number>, before: number[]): void {
    const iterator = back[Symbol.iterator]();
    for (const value of before) {
      expect(iterator.next()).toStrictEqual({ done: false, value });
    }
    expect(() => iterator.next()).toThrow('fail');
    expect(iterator.next()).toStrictEqual({ done: true, value: undefined });
  }

  it('serializes an iterator whose next() always throws', () => {
    check(deserialize(serialize(alwaysThrows())), []);
  });

  it('converts an iterator whose next() always throws to JSON', () => {
    check(fromJSON(toJSON(alwaysThrows())), []);
  });

  it('serializes an iterator that throws after a value', () => {
    check(deserialize(serialize(throwsAfterOne())), [1]);
  });

  it('converts an iterator that throws after a value to JSON', () => {
    check(fromJSON(toJSON(throwsAfterOne())), [1]);
  });
});
