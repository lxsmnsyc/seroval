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
import { evaluateCross, streamCross } from './utils/cross';

const EXAMPLE = new Set([1, 2, 3]);

const RECURSIVE = new Set<unknown>();
RECURSIVE.add(RECURSIVE);

describe('Set', () => {
  describe('serialize', () => {
    it('supports Set', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Set);
      expect(back.has(1)).toBe(EXAMPLE.has(1));
      expect(back.has(2)).toBe(EXAMPLE.has(2));
      expect(back.has(3)).toBe(EXAMPLE.has(3));
    });
    it('supports self-recursion', () => {
      const result = serialize(RECURSIVE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof RECURSIVE>(result);
      expect(back.has(back)).toBe(true);
    });
  });
  describe('serializeAsync', () => {
    it('supports Set', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Set);
      expect(back.has(1)).toBe(EXAMPLE.has(1));
      expect(back.has(2)).toBe(EXAMPLE.has(2));
      expect(back.has(3)).toBe(EXAMPLE.has(3));
    });
    it('supports self-recursion', async () => {
      const example: Set<Promise<unknown>> = new Set();
      example.add(Promise.resolve(example));
      const result = await serializeAsync(example);
      const back = deserialize<Set<Promise<unknown>>>(result);
      for (const key of back) {
        expect(await key).toBe(back);
      }
    });
  });
  describe('toJSON', () => {
    it('supports Set', () => {
      const result = toJSON(EXAMPLE);
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Set);
      expect(back.has(1)).toBe(EXAMPLE.has(1));
      expect(back.has(2)).toBe(EXAMPLE.has(2));
      expect(back.has(3)).toBe(EXAMPLE.has(3));
    });
    it('supports self-recursion', () => {
      const result = toJSON(RECURSIVE);
      const back = fromJSON<typeof RECURSIVE>(result);
      expect(back.has(back)).toBe(true);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Set', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Set);
      expect(back.has(1)).toBe(EXAMPLE.has(1));
      expect(back.has(2)).toBe(EXAMPLE.has(2));
      expect(back.has(3)).toBe(EXAMPLE.has(3));
    });
    it('supports self-recursion', async () => {
      const example: Set<Promise<unknown>> = new Set();
      example.add(Promise.resolve(example));
      const result = await toJSONAsync(example);
      const back = fromJSON<Set<Promise<unknown>>>(result);
      for (const key of back) {
        expect(await key).toBe(back);
      }
    });
  });
  describe('crossSerialize', () => {
    it('supports Set', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    it('supports self-recursion', () => {
      const result = crossSerialize(RECURSIVE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Set', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
      it('supports self-recursion', () => {
        const result = crossSerialize(RECURSIVE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Set', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      const back = await evaluateCross<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Set);
      expect(back.has(1)).toBe(EXAMPLE.has(1));
      expect(back.has(2)).toBe(EXAMPLE.has(2));
      expect(back.has(3)).toBe(EXAMPLE.has(3));
    });
    it('supports self-recursion', async () => {
      const example: Set<Promise<unknown>> = new Set();
      example.add(Promise.resolve(example));
      const result = await crossSerializeAsync(example);
      const back = await evaluateCross<Set<Promise<unknown>>>(result);
      expect(back.size).toBe(1);
      for (const key of back) {
        expect(await key).toBe(back);
      }
    });
    describe('scoped', () => {
      it('supports Set', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, 'example');
        expect(back).toBeInstanceOf(Set);
        expect(back.has(1)).toBe(EXAMPLE.has(1));
        expect(back.has(2)).toBe(EXAMPLE.has(2));
        expect(back.has(3)).toBe(EXAMPLE.has(3));
      });
      it('supports self-recursion', async () => {
        const example: Set<Promise<unknown>> = new Set();
        example.add(Promise.resolve(example));
        const result = await crossSerializeAsync(example, {
          scopeId: 'example',
        });
        const back = await evaluateCross<Set<Promise<unknown>>>(result, 'example');
        expect(back.size).toBe(1);
        for (const key of back) {
          expect(await key).toBe(back);
        }
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Set', async () => {
      const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back).toBeInstanceOf(Set);
      expect(back.has(1)).toBe(EXAMPLE.has(1));
      expect(back.has(2)).toBe(EXAMPLE.has(2));
      expect(back.has(3)).toBe(EXAMPLE.has(3));
    });
    it('supports self-recursion', async () => {
      const example: Set<Promise<unknown>> = new Set();
      example.add(Promise.resolve(example));
      const back = await streamCross<Set<Promise<unknown>>>(example);
      expect(back.size).toBe(1);
      for (const key of back) {
        expect(await key).toBe(back);
      }
    });
    describe('scoped', () => {
      it('supports Set', async () => {
        const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), { scopeId: 'example' });
        expect(back).toBeInstanceOf(Set);
        expect(back.has(1)).toBe(EXAMPLE.has(1));
        expect(back.has(2)).toBe(EXAMPLE.has(2));
        expect(back.has(3)).toBe(EXAMPLE.has(3));
      });
      it('supports self-recursion', async () => {
        const example: Set<Promise<unknown>> = new Set();
        example.add(Promise.resolve(example));
        const back = await streamCross<Set<Promise<unknown>>>(example, { scopeId: 'example' });
        expect(back.size).toBe(1);
        for (const key of back) {
          expect(await key).toBe(back);
        }
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports Set', () => {
      const result = toCrossJSON(EXAMPLE);
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Set);
      expect(back.has(1)).toBe(EXAMPLE.has(1));
      expect(back.has(2)).toBe(EXAMPLE.has(2));
      expect(back.has(3)).toBe(EXAMPLE.has(3));
    });
    it('supports self-recursion', () => {
      const result = toCrossJSON(RECURSIVE);
      const back = fromCrossJSON<typeof RECURSIVE>(result, {
        refs: new Map(),
      });
      expect(back.has(back)).toBe(true);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Set', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Set);
      expect(back.has(1)).toBe(EXAMPLE.has(1));
      expect(back.has(2)).toBe(EXAMPLE.has(2));
      expect(back.has(3)).toBe(EXAMPLE.has(3));
    });
    it('supports self-recursion', async () => {
      const example: Set<Promise<unknown>> = new Set();
      example.add(Promise.resolve(example));
      const result = await toCrossJSONAsync(example);
      const back = fromCrossJSON<Set<Promise<unknown>>>(result, {
        refs: new Map(),
      });
      for (const key of back) {
        expect(await key).toBe(back);
      }
    });
  });
});
