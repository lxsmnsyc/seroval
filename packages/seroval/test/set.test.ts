/* eslint-disable no-await-in-loop */
import { describe, it, expect } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  Feature,
  fromCrossJSON,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toJSON,
  toJSONAsync,
} from '../src';

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
      expect(result).toMatchSnapshot();
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
      expect(result).toMatchSnapshot();
      const back = deserialize<Set<Promise<unknown>>>(result);
      for (const key of back) {
        expect(await key).toBe(back);
      }
    });
  });
  describe('toJSON', () => {
    it('supports Set', () => {
      const result = toJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Set);
      expect(back.has(1)).toBe(EXAMPLE.has(1));
      expect(back.has(2)).toBe(EXAMPLE.has(2));
      expect(back.has(3)).toBe(EXAMPLE.has(3));
    });
    it('supports self-recursion', () => {
      const result = toJSON(RECURSIVE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof RECURSIVE>(result);
      expect(back.has(back)).toBe(true);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Set', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(result).toMatchSnapshot();
    });
    it('supports self-recursion', async () => {
      const example: Set<Promise<unknown>> = new Set();
      example.add(Promise.resolve(example));
      const result = await crossSerializeAsync(example);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Set', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
      it('supports self-recursion', async () => {
        const example: Set<Promise<unknown>> = new Set();
        example.add(Promise.resolve(example));
        const result = await crossSerializeAsync(example, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Set', async () => new Promise<void>((resolve, reject) => {
      crossSerializeStream(Promise.resolve(EXAMPLE), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          resolve();
        },
        onError(error) {
          reject(error);
        },
      });
    }));
    it('supports self-recursion', async () => new Promise<void>((resolve, reject) => {
      const example: Set<Promise<unknown>> = new Set();
      example.add(Promise.resolve(example));
      crossSerializeStream(example, {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          resolve();
        },
        onError(error) {
          reject(error);
        },
      });
    }));
    describe('scoped', () => {
      it('supports Set', async () => new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
      it('supports self-recursion', async () => new Promise<void>((resolve, reject) => {
        const example: Set<Promise<unknown>> = new Set();
        example.add(Promise.resolve(example));
        crossSerializeStream(example, {
          scopeId: 'example',
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
    });
  });
  describe('toCrossJSON', () => {
    it('supports Set', () => {
      const result = toCrossJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof RECURSIVE>(result, {
        refs: new Map(),
      });
      expect(back.has(back)).toBe(true);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Set', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<Set<Promise<unknown>>>(result, {
        refs: new Map(),
      });
      for (const key of back) {
        expect(await key).toBe(back);
      }
    });
  });
  describe('compat', () => {
    it('should fallback to Symbol.iterator', () => {
      expect(serialize(EXAMPLE, {
        disabledFeatures: Feature.Set,
      })).toMatchSnapshot();
    });
    it('should throw an error for unsupported target', () => {
      expect(() => serialize(EXAMPLE, {
        disabledFeatures: Feature.Set | Feature.Symbol,
      })).toThrowErrorMatchingSnapshot();
    });
  });
  describe('compat#toJSON', () => {
    it('should fallback to Symbol.iterator', () => {
      expect(JSON.stringify(toJSON(EXAMPLE, {
        disabledFeatures: Feature.Set,
      }))).toMatchSnapshot();
    });
    it('should throw an error for unsupported target', () => {
      expect(() => toJSON(EXAMPLE, {
        disabledFeatures: Feature.Set | Feature.Symbol,
      })).toThrowErrorMatchingSnapshot();
    });
  });
});
