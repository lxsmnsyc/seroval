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

const EXAMPLE = new Map([
  [1, 2],
  [3, 4],
]);
const RECURSIVE = new Map<unknown, unknown>();
RECURSIVE.set(RECURSIVE, RECURSIVE);

const ASYNC_RECURSIVE = new Map<Promise<unknown>, Promise<unknown>>();
ASYNC_RECURSIVE.set(Promise.resolve(ASYNC_RECURSIVE), Promise.resolve(ASYNC_RECURSIVE));

describe('Map', () => {
  describe.each([
    ['serialize', serialize],
    ['serializeAsync', serializeAsync],
    ['crossSerialize', crossSerialize],
    ['crossSerializeAsync', crossSerializeAsync],
  ])('%s deferred assignments', (_name, encode) => {
    it.each(['keys', 'values'])('preserves ancestor %s and repeated objects', async (side) => {
      const source = {
        inner: { map: new Map<unknown, unknown>() },
        first: { name: 'first' },
        second: { name: 'second' },
      };
      if (side === 'keys') {
        source.inner.map.set(source, source.first);
        source.inner.map.set(source.inner, source.second);
      } else {
        source.inner.map.set(source.first, source);
        source.inner.map.set(source.second, source.inner);
      }
      const payload = await encode(source);
      // oxlint-disable-next-line eslint/no-new-func, typescript/no-implied-eval, typescript/no-unsafe-call, typescript/no-unsafe-type-assertion -- evaluates the serialized output.
      const back = new Function('$R', `return (${payload})`)([]) as typeof source;
      expect(back.inner.map.size).toBe(2);
      if (side === 'keys') {
        expect(back.inner.map.get(back)).toBe(back.first);
        expect(back.inner.map.get(back.inner)).toBe(back.second);
      } else {
        expect(back.inner.map.get(back.first)).toBe(back);
        expect(back.inner.map.get(back.second)).toBe(back.inner);
      }
    });
  });
  describe('serialize', () => {
    it('supports Map', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(EXAMPLE.get(1));
      expect(back.get(3)).toBe(EXAMPLE.get(3));
    });
    it('supports self-recursion', () => {
      const result = serialize(RECURSIVE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof RECURSIVE>(result);
      expect(back.has(back)).toBe(true);
      expect(back.get(back)).toBe(back);
    });
  });
  describe('serializeAsync', () => {
    it('supports Map', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(EXAMPLE.get(1));
      expect(back.get(3)).toBe(EXAMPLE.get(3));
    });
    it('supports self-recursion', async () => {
      const result = await serializeAsync(ASYNC_RECURSIVE);
      const back = deserialize<typeof ASYNC_RECURSIVE>(result);
      for (const [key, value] of back) {
        expect(await key).toBe(back);
        expect(await value).toBe(back);
      }
    });
  });
  describe('toJSON', () => {
    it('supports Map', () => {
      const result = toJSON(EXAMPLE);
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(EXAMPLE.get(1));
      expect(back.get(3)).toBe(EXAMPLE.get(3));
    });
    it('supports self-recursion', () => {
      const result = toJSON(RECURSIVE);
      const back = fromJSON<typeof RECURSIVE>(result);
      expect(back.has(back)).toBe(true);
      expect(back.get(back)).toBe(back);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Map', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(EXAMPLE.get(1));
      expect(back.get(3)).toBe(EXAMPLE.get(3));
    });
    it('supports self-recursion', async () => {
      const result = await toJSONAsync(ASYNC_RECURSIVE);
      const back = fromJSON<typeof ASYNC_RECURSIVE>(result);
      for (const [key, value] of back) {
        expect(await key).toBe(back);
        expect(await value).toBe(back);
      }
    });
  });
  describe('crossSerialize', () => {
    it('supports Map', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    it('supports self-recursion', () => {
      const result = crossSerialize(RECURSIVE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Map', () => {
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
    it('supports Map', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      const back = await evaluateCross<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(EXAMPLE.get(1));
      expect(back.get(3)).toBe(EXAMPLE.get(3));
    });
    it('supports self-recursion', async () => {
      const result = await crossSerializeAsync(ASYNC_RECURSIVE);
      const back = await evaluateCross<typeof ASYNC_RECURSIVE>(result);
      expect(back.size).toBe(1);
      for (const [key, value] of back) {
        expect(await key).toBe(back);
        expect(await value).toBe(back);
      }
    });
    describe('scoped', () => {
      it('supports Map', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, 'example');
        expect(back).toBeInstanceOf(Map);
        expect(back.get(1)).toBe(EXAMPLE.get(1));
        expect(back.get(3)).toBe(EXAMPLE.get(3));
      });
      it('supports self-recursion', async () => {
        const result = await crossSerializeAsync(ASYNC_RECURSIVE, {
          scopeId: 'example',
        });
        const back = await evaluateCross<typeof ASYNC_RECURSIVE>(result, 'example');
        expect(back.size).toBe(1);
        for (const [key, value] of back) {
          expect(await key).toBe(back);
          expect(await value).toBe(back);
        }
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Map', async () => {
      const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(EXAMPLE.get(1));
      expect(back.get(3)).toBe(EXAMPLE.get(3));
    });
    it('supports self-recursion', async () => {
      const back = await streamCross<typeof ASYNC_RECURSIVE>(ASYNC_RECURSIVE);
      expect(back.size).toBe(1);
      for (const [key, value] of back) {
        expect(await key).toBe(back);
        expect(await value).toBe(back);
      }
    });
    describe('scoped', () => {
      it('supports Map', async () => {
        const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), { scopeId: 'example' });
        expect(back).toBeInstanceOf(Map);
        expect(back.get(1)).toBe(EXAMPLE.get(1));
        expect(back.get(3)).toBe(EXAMPLE.get(3));
      });
      it('supports self-recursion', async () => {
        const back = await streamCross<typeof ASYNC_RECURSIVE>(ASYNC_RECURSIVE, { scopeId: 'example' });
        expect(back.size).toBe(1);
        for (const [key, value] of back) {
          expect(await key).toBe(back);
          expect(await value).toBe(back);
        }
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports Map', () => {
      const result = toCrossJSON(EXAMPLE);
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(EXAMPLE.get(1));
      expect(back.get(3)).toBe(EXAMPLE.get(3));
    });
    it('supports self-recursion', () => {
      const result = toCrossJSON(RECURSIVE);
      const back = fromCrossJSON<typeof RECURSIVE>(result, {
        refs: new Map(),
      });
      expect(back.has(back)).toBe(true);
      expect(back.get(back)).toBe(back);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Map', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(EXAMPLE.get(1));
      expect(back.get(3)).toBe(EXAMPLE.get(3));
    });
    it('supports self-recursion', async () => {
      const result = await toCrossJSONAsync(ASYNC_RECURSIVE);
      const back = fromCrossJSON<typeof ASYNC_RECURSIVE>(result, {
        refs: new Map(),
      });
      for (const [key, value] of back) {
        expect(await key).toBe(back);
        expect(await value).toBe(back);
      }
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Map', async () => {
      const back = await streamCrossJSON<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(EXAMPLE.get(1));
      expect(back.get(3)).toBe(EXAMPLE.get(3));
    });
    it('supports self-recursion', async () => {
      const back = await streamCrossJSON<typeof ASYNC_RECURSIVE>(ASYNC_RECURSIVE);
      expect(back.size).toBe(1);
      for (const [key, value] of back) {
        expect(await key).toBe(back);
        expect(await value).toBe(back);
      }
    });
  });
});
