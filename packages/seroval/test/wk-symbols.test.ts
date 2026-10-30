import { describe, expect, it } from 'vitest';
import {
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
import { evaluateCross, streamCross, streamCrossJSON } from './utils/cross';

const WELL_KNOWN_SYMBOLS = [
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

describe('well-known symbols', () => {
  describe('serialize', () => {
    it('supports well-known symbols', () => {
      expect(serialize(Symbol.asyncIterator)).toMatchSnapshot();
      expect(serialize(Symbol.hasInstance)).toMatchSnapshot();
      expect(serialize(Symbol.isConcatSpreadable)).toMatchSnapshot();
      expect(serialize(Symbol.iterator)).toMatchSnapshot();
      expect(serialize(Symbol.match)).toMatchSnapshot();
      expect(serialize(Symbol.matchAll)).toMatchSnapshot();
      expect(serialize(Symbol.replace)).toMatchSnapshot();
      expect(serialize(Symbol.search)).toMatchSnapshot();
      expect(serialize(Symbol.species)).toMatchSnapshot();
      expect(serialize(Symbol.split)).toMatchSnapshot();
      expect(serialize(Symbol.toPrimitive)).toMatchSnapshot();
      expect(serialize(Symbol.toStringTag)).toMatchSnapshot();
      expect(serialize(Symbol.unscopables)).toMatchSnapshot();
    });
  });
  describe('serializeAsync', () => {
    it('supports well-known symbols', async () => {
      for (const symbol of WELL_KNOWN_SYMBOLS) {
        const result = await serializeAsync(Promise.resolve(symbol));
        expect(await deserialize<Promise<symbol>>(result)).toBe(symbol);
      }
    });
  });
  describe('toJSON', () => {
    it('supports well-known symbols', () => {
      for (const symbol of WELL_KNOWN_SYMBOLS) {
        const result = toJSON(symbol);
        expect(fromJSON<symbol>(result)).toBe(symbol);
      }
    });
  });
  describe('toJSONAsync', () => {
    it('supports well-known symbols', async () => {
      for (const symbol of WELL_KNOWN_SYMBOLS) {
        const result = await toJSONAsync(Promise.resolve(symbol));
        expect(await fromJSON<Promise<symbol>>(result)).toBe(symbol);
      }
    });
  });
  describe('crossSerialize', () => {
    it('supports well-known symbols', () => {
      expect(crossSerialize(Symbol.asyncIterator)).toMatchSnapshot();
      expect(crossSerialize(Symbol.hasInstance)).toMatchSnapshot();
      expect(crossSerialize(Symbol.isConcatSpreadable)).toMatchSnapshot();
      expect(crossSerialize(Symbol.iterator)).toMatchSnapshot();
      expect(crossSerialize(Symbol.match)).toMatchSnapshot();
      expect(crossSerialize(Symbol.matchAll)).toMatchSnapshot();
      expect(crossSerialize(Symbol.replace)).toMatchSnapshot();
      expect(crossSerialize(Symbol.search)).toMatchSnapshot();
      expect(crossSerialize(Symbol.species)).toMatchSnapshot();
      expect(crossSerialize(Symbol.split)).toMatchSnapshot();
      expect(crossSerialize(Symbol.toPrimitive)).toMatchSnapshot();
      expect(crossSerialize(Symbol.toStringTag)).toMatchSnapshot();
      expect(crossSerialize(Symbol.unscopables)).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports well-known symbols', () => {
        expect(
          crossSerialize(Symbol.asyncIterator, { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Symbol.hasInstance, { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Symbol.isConcatSpreadable, { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Symbol.iterator, { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Symbol.match, { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Symbol.matchAll, { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Symbol.replace, { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Symbol.search, { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Symbol.species, { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Symbol.split, { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Symbol.toPrimitive, { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Symbol.toStringTag, { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Symbol.unscopables, { scopeId: 'example' }),
        ).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports well-known symbols', async () => {
      for (const symbol of WELL_KNOWN_SYMBOLS) {
        const result = await crossSerializeAsync(Promise.resolve(symbol));
        expect(await evaluateCross<Promise<symbol>>(result)).toBe(symbol);
      }
    });
    describe('scoped', () => {
      it('supports well-known symbols', async () => {
        for (const symbol of WELL_KNOWN_SYMBOLS) {
          const result = await crossSerializeAsync(Promise.resolve(symbol), {
            scopeId: 'example',
          });
          expect(await evaluateCross<Promise<symbol>>(result, 'example')).toBe(
            symbol,
          );
        }
      });
    });
  });
  describe('crossSerializeStream', () => {
    for (const symbol of WELL_KNOWN_SYMBOLS) {
      it(`supports ${String(symbol)}`, async () => {
        expect(await streamCross<Promise<symbol>>(Promise.resolve(symbol))).toBe(
          symbol,
        );
      });
    }
    describe('scoped', () => {
      for (const symbol of WELL_KNOWN_SYMBOLS) {
        it(`supports ${String(symbol)}`, async () => {
          const back = await streamCross<Promise<symbol>>(
            Promise.resolve(symbol),
            { scopeId: 'example' },
          );
          expect(back).toBe(symbol);
        });
      }
    });
  });
  describe('toCrossJSON', () => {
    it('supports well-known symbols', () => {
      for (const symbol of WELL_KNOWN_SYMBOLS) {
        const result = toCrossJSON(symbol);
        expect(fromCrossJSON<symbol>(result, { refs: new Map() })).toBe(symbol);
      }
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports well-known symbols', async () => {
      for (const symbol of WELL_KNOWN_SYMBOLS) {
        const result = await toCrossJSONAsync(Promise.resolve(symbol));
        const back = await fromCrossJSON<Promise<symbol>>(result, {
          refs: new Map(),
        });
        expect(back).toBe(symbol);
      }
    });
  });
  describe('toCrossJSONStream', () => {
    for (const symbol of WELL_KNOWN_SYMBOLS) {
      it(`supports ${String(symbol)}`, async () => {
        expect(
          await streamCrossJSON<Promise<symbol>>(Promise.resolve(symbol)),
        ).toBe(symbol);
      });
    }
  });
});
