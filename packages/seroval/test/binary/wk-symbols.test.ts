import { describe, expect, it } from 'vitest';
import { captureSerializeError, roundtrip } from './utils';

const WELL_KNOWN = [
  Symbol.asyncIterator,
  Symbol.hasInstance,
  Symbol.isConcatSpreadable,
  Symbol.iterator,
  Symbol.match,
  Symbol.matchAll,
  Symbol.replace,
  Symbol.search,
  Symbol.species,
  Symbol.split,
  Symbol.toPrimitive,
  Symbol.toStringTag,
  Symbol.unscopables,
];

describe('binary well-known symbols', () => {
  it('supports every well-known symbol', async () => {
    const { value } = await roundtrip<symbol[]>(WELL_KNOWN);
    expect(value).toEqual(WELL_KNOWN);
    for (let i = 0; i < WELL_KNOWN.length; i++) {
      expect(value[i]).toBe(WELL_KNOWN[i]);
    }
  });

  it('supports well-known symbols as values', async () => {
    const { value } = await roundtrip<{ symbol: symbol }>({
      symbol: Symbol.toPrimitive,
    });
    expect(value.symbol).toBe(Symbol.toPrimitive);
  });

  it('supports well-known symbols inside collections', async () => {
    const { value } = await roundtrip<{
      map: Map<symbol, string>;
      set: Set<symbol>;
    }>({
      map: new Map([[Symbol.iterator, 'iterator']]),
      set: new Set([Symbol.species]),
    });
    expect(value.map.get(Symbol.iterator)).toBe('iterator');
    expect(value.set.has(Symbol.species)).toBe(true);
  });

  it('rejects arbitrary symbols', async () => {
    const error = await captureSerializeError(Symbol('custom'));
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toContain('cannot be parsed/serialized');
  });

  it('rejects registered symbols', async () => {
    const error = await captureSerializeError(Symbol.for('registered'));
    expect(error).toBeInstanceOf(Error);
  });
});
