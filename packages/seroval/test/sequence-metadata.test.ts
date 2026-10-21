import { describe, expect, it } from 'vitest';
import {
  fromCrossJSON,
  fromJSON,
  type SerovalNode,
  toCrossJSON,
  toJSON,
} from '../src';

// A sequence node's throw and done indices come from the wire. The iterator
// stops only when its index passes the done index, so a value outside the
// element list could keep it running forever.
describe('sequence node metadata', () => {
  function source(): Iterable<number> {
    return {
      *[Symbol.iterator]() {
        yield 1;
        yield 2;
      },
    };
  }

  function findSequence(node: unknown): { s: unknown; l: unknown } {
    const stack = [node];
    while (stack.length) {
      const current = stack.pop();
      if (current && typeof current === 'object') {
        if ((current as SerovalNode).t === 35) {
          return current as { s: unknown; l: unknown };
        }
        stack.push(...Object.values(current));
      }
    }
    throw new Error('missing sequence node');
  }

  const INVALID = ['x', '1', null, 1.5, -2, 3, 1e308, Number.NaN];

  it.each(INVALID)('rejects a fromJSON done index of %p', value => {
    const json = toJSON(source());
    findSequence(json).l = value;
    expect(() => fromJSON(json)).toThrow();
  });

  it.each(INVALID)('rejects a fromJSON throw index of %p', value => {
    const json = toJSON(source());
    findSequence(json).s = value;
    expect(() => fromJSON(json)).toThrow();
  });

  it.each(INVALID)('rejects a fromCrossJSON done index of %p', value => {
    const json = toCrossJSON(source());
    findSequence(json).l = value;
    expect(() => fromCrossJSON(json, { refs: new Map() })).toThrow();
  });

  it('accepts a valid sequence', () => {
    const back = fromJSON<Iterable<number>>(toJSON(source()));
    expect([...back]).toStrictEqual([1, 2]);
  });

  it('accepts a sequence that throws', () => {
    const json = toJSON({
      *[Symbol.iterator]() {
        yield 1;
        throw new Error('fail');
      },
    });
    const back = fromJSON<Iterable<number>>(json);
    expect(() => [...back]).toThrow('fail');
  });
});
