import { describe, expect, it } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
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

describe('number', () => {
  describe('serialize', () => {
    it('supports numbers', () => {
      const value = 0xdeadbeef;
      expect(serialize(value)).toBe(`${value}`);
      expect(serialize(Number.NaN)).toBe('0/0');
      expect(serialize(Number.POSITIVE_INFINITY)).toBe('1/0');
      expect(serialize(Number.NEGATIVE_INFINITY)).toBe('-1/0');
      expect(serialize(-0)).toBe('-0');
    });
  });
  describe('serializeAsync', () => {
    it('supports numbers', async () => {
      const value = 0xdeadbeef;
      expect(await serializeAsync(Promise.resolve(value))).toBe(
        `Promise.resolve(${value})`,
      );
      expect(await serializeAsync(Promise.resolve(Number.NaN))).toBe(
        'Promise.resolve(0/0)',
      );
      expect(
        await serializeAsync(Promise.resolve(Number.POSITIVE_INFINITY)),
      ).toBe('Promise.resolve(1/0)');
      expect(
        await serializeAsync(Promise.resolve(Number.NEGATIVE_INFINITY)),
      ).toBe('Promise.resolve(-1/0)');
      expect(await serializeAsync(Promise.resolve(-0))).toBe(
        'Promise.resolve(-0)',
      );
    });
  });
  describe('toJSON', () => {
    it('supports numbers', () => {
      {
        const back = fromJSON<number>(toJSON(0xdeadbeef));
        expect(back).toBe(0xdeadbeef);
      }
      {
        const back = fromJSON<number>(toJSON(Number.NaN));
        expect(back).toBe(Number.NaN);
      }
      {
        const back = fromJSON<number>(toJSON(Number.POSITIVE_INFINITY));
        expect(back).toBe(Number.POSITIVE_INFINITY);
      }
      {
        const back = fromJSON<number>(toJSON(Number.NEGATIVE_INFINITY));
        expect(back).toBe(Number.NEGATIVE_INFINITY);
      }
      {
        const back = fromJSON<number>(toJSON(-0));
        expect(back).toBe(-0);
      }
    });
  });
  describe('toJSONAsync', () => {
    it('supports numbers', async () => {
      {
        const back = await fromJSON<Promise<number>>(await toJSONAsync(Promise.resolve(0xdeadbeef)));
        expect(back).toBe(0xdeadbeef);
      }
      {
        const back = await fromJSON<Promise<number>>(await toJSONAsync(Promise.resolve(Number.NaN)));
        expect(back).toBe(Number.NaN);
      }
      {
        const back = await fromJSON<Promise<number>>(await toJSONAsync(Promise.resolve(Number.POSITIVE_INFINITY)));
        expect(back).toBe(Number.POSITIVE_INFINITY);
      }
      {
        const back = await fromJSON<Promise<number>>(await toJSONAsync(Promise.resolve(Number.NEGATIVE_INFINITY)));
        expect(back).toBe(Number.NEGATIVE_INFINITY);
      }
      {
        const back = await fromJSON<Promise<number>>(await toJSONAsync(Promise.resolve(-0)));
        expect(back).toBe(-0);
      }
    });
  });
  describe('crossSerialize', () => {
    it('supports numbers', () => {
      const value = 0xdeadbeef;
      expect(crossSerialize(value)).toMatchSnapshot();
      expect(crossSerialize(Number.NaN)).toMatchSnapshot();
      expect(crossSerialize(Number.POSITIVE_INFINITY)).toMatchSnapshot();
      expect(crossSerialize(Number.NEGATIVE_INFINITY)).toMatchSnapshot();
      expect(crossSerialize(-0)).toMatchSnapshot();
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports numbers', async () => {
      {
        const back = await evaluateCross<Promise<number>>(await crossSerializeAsync(Promise.resolve(0xdeadbeef)));
        expect(back).toBe(0xdeadbeef);
      }
      {
        const back = await evaluateCross<Promise<number>>(await crossSerializeAsync(Promise.resolve(Number.NaN)));
        expect(back).toBe(Number.NaN);
      }
      {
        const back = await evaluateCross<Promise<number>>(await crossSerializeAsync(Promise.resolve(Number.POSITIVE_INFINITY)));
        expect(back).toBe(Number.POSITIVE_INFINITY);
      }
      {
        const back = await evaluateCross<Promise<number>>(await crossSerializeAsync(Promise.resolve(Number.NEGATIVE_INFINITY)));
        expect(back).toBe(Number.NEGATIVE_INFINITY);
      }
      {
        const back = await evaluateCross<Promise<number>>(await crossSerializeAsync(Promise.resolve(-0)));
        expect(back).toBe(-0);
      }
    });
  });
  describe('crossSerializeStream', () => {
    it('supports numbers', async () => {
      const back = await streamCross<Promise<number>>(Promise.resolve(0xdeadbeef));
      expect(back).toBe(0xdeadbeef);
    });
    it('supports Number.NaN', async () => {
      const back = await streamCross<Promise<number>>(Promise.resolve(Number.NaN));
      expect(back).toBe(Number.NaN);
    });
    it('supports Number.POSITIVE_INFINITY', async () => {
      const back = await streamCross<Promise<number>>(Promise.resolve(Number.POSITIVE_INFINITY));
      expect(back).toBe(Number.POSITIVE_INFINITY);
    });
    it('supports Number.NEGATIVE_INFINITY', async () => {
      const back = await streamCross<Promise<number>>(Promise.resolve(Number.NEGATIVE_INFINITY));
      expect(back).toBe(Number.NEGATIVE_INFINITY);
    });
    it('supports -0', async () => {
      const back = await streamCross<Promise<number>>(Promise.resolve(-0));
      expect(back).toBe(-0);
    });
  });
  describe('toCrossJSON', () => {
    it('supports numbers', () => {
      {
        const back = fromCrossJSON<number>(toCrossJSON(0xdeadbeef), { refs: new Map() });
        expect(back).toBe(0xdeadbeef);
      }
      {
        const back = fromCrossJSON<number>(toCrossJSON(Number.NaN), { refs: new Map() });
        expect(back).toBe(Number.NaN);
      }
      {
        const back = fromCrossJSON<number>(toCrossJSON(Number.POSITIVE_INFINITY), { refs: new Map() });
        expect(back).toBe(Number.POSITIVE_INFINITY);
      }
      {
        const back = fromCrossJSON<number>(toCrossJSON(Number.NEGATIVE_INFINITY), { refs: new Map() });
        expect(back).toBe(Number.NEGATIVE_INFINITY);
      }
      {
        const back = fromCrossJSON<number>(toCrossJSON(-0), { refs: new Map() });
        expect(back).toBe(-0);
      }
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports numbers', async () => {
      {
        const back = await fromCrossJSON<Promise<number>>(await toCrossJSONAsync(Promise.resolve(0xdeadbeef)), { refs: new Map() });
        expect(back).toBe(0xdeadbeef);
      }
      {
        const back = await fromCrossJSON<Promise<number>>(await toCrossJSONAsync(Promise.resolve(Number.NaN)), { refs: new Map() });
        expect(back).toBe(Number.NaN);
      }
      {
        const back = await fromCrossJSON<Promise<number>>(await toCrossJSONAsync(Promise.resolve(Number.POSITIVE_INFINITY)), { refs: new Map() });
        expect(back).toBe(Number.POSITIVE_INFINITY);
      }
      {
        const back = await fromCrossJSON<Promise<number>>(await toCrossJSONAsync(Promise.resolve(Number.NEGATIVE_INFINITY)), { refs: new Map() });
        expect(back).toBe(Number.NEGATIVE_INFINITY);
      }
      {
        const back = await fromCrossJSON<Promise<number>>(await toCrossJSONAsync(Promise.resolve(-0)), { refs: new Map() });
        expect(back).toBe(-0);
      }
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports numbers', async () => {
      const back = await streamCrossJSON<Promise<number>>(Promise.resolve(0xdeadbeef));
      expect(back).toBe(0xdeadbeef);
    });
    it('supports Number.NaN', async () => {
      const back = await streamCrossJSON<Promise<number>>(Promise.resolve(Number.NaN));
      expect(back).toBe(Number.NaN);
    });
    it('supports Number.POSITIVE_INFINITY', async () => {
      const back = await streamCrossJSON<Promise<number>>(Promise.resolve(Number.POSITIVE_INFINITY));
      expect(back).toBe(Number.POSITIVE_INFINITY);
    });
    it('supports Number.NEGATIVE_INFINITY', async () => {
      const back = await streamCrossJSON<Promise<number>>(Promise.resolve(Number.NEGATIVE_INFINITY));
      expect(back).toBe(Number.NEGATIVE_INFINITY);
    });
    it('supports -0', async () => {
      const back = await streamCrossJSON<Promise<number>>(Promise.resolve(-0));
      expect(back).toBe(-0);
    });
  });
});
