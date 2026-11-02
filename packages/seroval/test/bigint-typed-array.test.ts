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

const EXAMPLE = new BigInt64Array([
  -9007199254740991n,
  9007199254740991n,
  0n,
  -1n,
]);

describe('bigint typed arrays', () => {
  describe('serialize', () => {
    it('supports bigint typed arrays', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(BigInt64Array);
      expect(back.length).toBe(EXAMPLE.length);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
      expect(back[3]).toBe(EXAMPLE[3]);
    });
  });
  describe('serializeAsync', () => {
    it('supports bigint typed arrays', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(BigInt64Array);
      expect(back.length).toBe(EXAMPLE.length);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
      expect(back[3]).toBe(EXAMPLE[3]);
    });
  });
  describe('toJSON', () => {
    it('supports bigint typed arrays', () => {
      const result = toJSON(EXAMPLE);
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(BigInt64Array);
      expect(back.length).toBe(EXAMPLE.length);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
      expect(back[3]).toBe(EXAMPLE[3]);
    });
  });
  describe('toJSONAsync', () => {
    it('supports bigint typed arrays', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(BigInt64Array);
      expect(back.length).toBe(EXAMPLE.length);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
      expect(back[3]).toBe(EXAMPLE[3]);
    });
  });
  describe('crossSerialize', () => {
    it('supports bigint typed arrays', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports bigint typed arrays', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports bigint typed arrays', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      const back = await evaluateCross<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(BigInt64Array);
      expect(back.length).toBe(EXAMPLE.length);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
      expect(back[3]).toBe(EXAMPLE[3]);
    });
    describe('scoped', () => {
      it('supports bigint typed arrays', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, 'example');
        expect(back).toBeInstanceOf(BigInt64Array);
        expect(back.length).toBe(EXAMPLE.length);
        expect(back[0]).toBe(EXAMPLE[0]);
        expect(back[1]).toBe(EXAMPLE[1]);
        expect(back[2]).toBe(EXAMPLE[2]);
        expect(back[3]).toBe(EXAMPLE[3]);
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports bigint typed arrays', async () => {
      const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back).toBeInstanceOf(BigInt64Array);
      expect(back.length).toBe(EXAMPLE.length);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
      expect(back[3]).toBe(EXAMPLE[3]);
    });
    describe('scoped', () => {
      it('supports bigint typed arrays', async () => {
        const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        expect(back).toBeInstanceOf(BigInt64Array);
        expect(back.length).toBe(EXAMPLE.length);
        expect(back[0]).toBe(EXAMPLE[0]);
        expect(back[1]).toBe(EXAMPLE[1]);
        expect(back[2]).toBe(EXAMPLE[2]);
        expect(back[3]).toBe(EXAMPLE[3]);
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports bigint typed arrays', () => {
      const result = toCrossJSON(EXAMPLE);
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(BigInt64Array);
      expect(back.length).toBe(EXAMPLE.length);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
      expect(back[3]).toBe(EXAMPLE[3]);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports bigint typed arrays', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(BigInt64Array);
      expect(back.length).toBe(EXAMPLE.length);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
      expect(back[3]).toBe(EXAMPLE[3]);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports bigint typed arrays', async () => {
      const back = await streamCrossJSON<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back).toBeInstanceOf(BigInt64Array);
      expect(back.length).toBe(EXAMPLE.length);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
      expect(back[3]).toBe(EXAMPLE[3]);
    });
  });
});
