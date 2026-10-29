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

const EXAMPLE = 9007199254740991n;

describe('boxed bigint', () => {
  describe('serialize', () => {
    it('supports boxed bigint', () => {
      expect(serialize(Object(EXAMPLE))).toMatchSnapshot();
      expect(deserialize<object>(serialize(Object(EXAMPLE))).valueOf()).toBe(
        EXAMPLE,
      );
    });
  });
  describe('serializeAsync', () => {
    it('supports boxed bigint', async () => {
      expect((await deserialize<Promise<object>>(await serializeAsync(Promise.resolve(Object(EXAMPLE))))).valueOf()).toBe(EXAMPLE);
    });
  });
  describe('toJSON', () => {
    it('supports boxed bigint', () => {
      expect(fromJSON<object>(toJSON(Object(EXAMPLE))).valueOf()).toBe(EXAMPLE);
    });
  });
  describe('toJSONAsync', () => {
    it('supports boxed bigint', async () => {
      expect((await fromJSON<Promise<object>>(await toJSONAsync(Promise.resolve(Object(EXAMPLE))))).valueOf()).toBe(EXAMPLE);
    });
  });
  describe('crossSerialize', () => {
    it('supports boxed bigint', () => {
      expect(crossSerialize(Object(EXAMPLE))).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports boxed bigint', () => {
        expect(
          crossSerialize(Object(EXAMPLE), { scopeId: 'example' }),
        ).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports boxed bigint', async () => {
      expect((await evaluateCross<Promise<object>>(await crossSerializeAsync(Promise.resolve(Object(EXAMPLE))))).valueOf()).toBe(EXAMPLE);
    });
    describe('scoped', () => {
      it('supports boxed bigint', async () => {
        expect((await evaluateCross<Promise<object>>(await crossSerializeAsync(Promise.resolve(Object(EXAMPLE)), {
            scopeId: 'example',
          }), 'example')).valueOf()).toBe(EXAMPLE);
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports boxed bigint', async () => {
      const back = await streamCross<Promise<object>>(Promise.resolve(Object(EXAMPLE)));
      expect(back.valueOf()).toBe(EXAMPLE);
    });
    describe('scoped', () => {
      it('supports boxed bigint', async () => {
        const back = await streamCross<Promise<object>>(Promise.resolve(Object(EXAMPLE)), { scopeId: 'example' });
        expect(back.valueOf()).toBe(EXAMPLE);
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports boxed bigint', () => {
      expect(
        fromCrossJSON<object>(toCrossJSON(Object(EXAMPLE)), {
          refs: new Map(),
        }).valueOf(),
      ).toBe(EXAMPLE);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports boxed bigint', async () => {
      expect((await fromCrossJSON<Promise<object>>(await toCrossJSONAsync(Promise.resolve(Object(EXAMPLE))), {
        refs: new Map(),
      })).valueOf()).toBe(EXAMPLE);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports boxed bigint', async () => {
      const back = await streamCrossJSON<Promise<object>>(Promise.resolve(Object(EXAMPLE)));
      expect(back.valueOf()).toBe(EXAMPLE);
    });
  });
});
