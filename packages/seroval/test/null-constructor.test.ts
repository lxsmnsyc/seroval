import { describe, expect, it } from 'vitest';
import {
  Feature,
  compileJSON,
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
import { drain, evaluateCross, streamCross, streamCrossJSON } from './utils/cross';

function createNullObject<T extends object>(properties: T): T {
  const target: unknown = Object.create(null);
  if (typeof target !== 'object' || target === null) {
    throw new Error('Expected an object');
  }
  return Object.assign(target, properties);
}

const EXAMPLE = createNullObject({
  example: 'valid identifier',
  '%example': 'invalid identifier',
  '0x1': 'hexadecimal',
  '0b1': 'binary',
  '0o1': 'octal',
  '1_000': 'numeric separator',
  '1.7976931348623157e+308': 'exponentiation',
});

const RECURSIVE = createNullObject<Record<string, unknown>>({});
RECURSIVE.a = RECURSIVE;
RECURSIVE.b = RECURSIVE;

const ITERABLE: Iterable<number> = createNullObject({
  *[Symbol.iterator](): Generator<number> {
    yield 1;
    yield 2;
    yield 3;
  },
});

const ASYNC_RECURSIVE = createNullObject<Record<string, Promise<unknown>>>({});
ASYNC_RECURSIVE.a = Promise.resolve(ASYNC_RECURSIVE);
ASYNC_RECURSIVE.b = Promise.resolve(ASYNC_RECURSIVE);

const ASYNC_ITERABLE: AsyncIterable<number> = createNullObject({
  async *[Symbol.asyncIterator](): AsyncGenerator<number> {
    await Promise.resolve();
    yield 1;
    yield 2;
    yield 3;
  },
});

describe('null-constructor', () => {
  describe('serialize', () => {
    it('supports Object.create(null)', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.example).toBe(EXAMPLE.example);
    });
    it('supports self-recursion', () => {
      const result = serialize(RECURSIVE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof RECURSIVE>(result);
      expect(back.a).toBe(back);
      expect(back.b).toBe(back);
    });
    it('supports Symbol.iterator', () => {
      const result = serialize(ITERABLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof ITERABLE>(result);
      expect(back.constructor).toBeUndefined();
      expect([...back]).toMatchObject([1, 2, 3]);
    });
  });
  describe('serializeAsync', () => {
    it('supports Object.create(null)', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.example).toBe(EXAMPLE.example);
    });
    it('supports self-recursion', async () => {
      const result = await serializeAsync(ASYNC_RECURSIVE);
      const back = deserialize<typeof ASYNC_RECURSIVE>(result);
      expect(await back.a).toBe(back);
      expect(await back.b).toBe(back);
    });
    it('supports Symbol.iterator', async () => {
      const result = await serializeAsync(Promise.resolve(ITERABLE));
      const back = await deserialize<Promise<typeof ITERABLE>>(result);
      expect(back.constructor).toBeUndefined();
      expect([...back]).toMatchObject([1, 2, 3]);
    });
    it('supports Symbol.asyncIterator', async () => {
      const result = await serializeAsync(ASYNC_ITERABLE);
      const back = deserialize<typeof ASYNC_ITERABLE>(result);
      expect(back.constructor).toBeUndefined();
      expect(Symbol.asyncIterator in back).toBe(true);
    });
  });
  describe('toJSON', () => {
    it('supports Object.create(null)', () => {
      const result = toJSON(EXAMPLE);
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.example).toBe(EXAMPLE.example);
    });
    it('supports self-recursion', () => {
      const result = toJSON(RECURSIVE);
      const back = fromJSON<typeof RECURSIVE>(result);
      expect(back.a).toBe(back);
      expect(back.b).toBe(back);
    });
    it('supports Symbol.iterator', () => {
      const result = toJSON(ITERABLE);
      const back = fromJSON<typeof ITERABLE>(result);
      expect(back.constructor).toBeUndefined();
      expect([...back]).toMatchObject([1, 2, 3]);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Object.create(null)', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.example).toBe(EXAMPLE.example);
    });
    it('supports self-recursion', async () => {
      const result = await toJSONAsync(ASYNC_RECURSIVE);
      const back = fromJSON<typeof ASYNC_RECURSIVE>(result);
      expect(await back.a).toBe(back);
      expect(await back.b).toBe(back);
    });
    it('supports Symbol.iterator', async () => {
      const result = await toJSONAsync(Promise.resolve(ITERABLE));
      const back = await fromJSON<Promise<typeof ITERABLE>>(result);
      expect(back.constructor).toBeUndefined();
      expect([...back]).toMatchObject([1, 2, 3]);
    });
    it('supports Symbol.asyncIterator', async () => {
      const result = await toJSONAsync(ASYNC_ITERABLE);
      const back = fromJSON<typeof ASYNC_ITERABLE>(result);
      expect(back.constructor).toBeUndefined();
      expect(Symbol.asyncIterator in back).toBe(true);
    });
  });
  describe('crossSerialize', () => {
    it('supports Object.create(null)', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    it('supports self-recursion', () => {
      const result = crossSerialize(RECURSIVE);
      expect(result).toMatchSnapshot();
    });
    it('supports Symbol.iterator', () => {
      const result = crossSerialize(ITERABLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Object.create(null)', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
      it('supports self-recursion', () => {
        const result = crossSerialize(RECURSIVE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
      it('supports Symbol.iterator', () => {
        const result = crossSerialize(ITERABLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Object.create(null)', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      const back = await evaluateCross<Promise<typeof EXAMPLE>>(result);
      expect(Object.getPrototypeOf(back)).toBeNull();
      expect(back.constructor).toBeUndefined();
      expect(back.example).toBe(EXAMPLE.example);
    });
    it('supports self-recursion', async () => {
      const result = await crossSerializeAsync(ASYNC_RECURSIVE);
      const back = evaluateCross<typeof ASYNC_RECURSIVE>(result);
      expect(Object.getPrototypeOf(back)).toBeNull();
      expect(await back.a).toBe(back);
      expect(await back.b).toBe(back);
    });
    it('supports Symbol.iterator', async () => {
      const result = await crossSerializeAsync(Promise.resolve(ITERABLE));
      const back = await evaluateCross<Promise<typeof ITERABLE>>(result);
      expect(Object.getPrototypeOf(back)).toBeNull();
      expect(back.constructor).toBeUndefined();
      expect([...back]).toMatchObject([1, 2, 3]);
    });
    it('supports Symbol.asyncIterator', async () => {
      const result = await crossSerializeAsync(ASYNC_ITERABLE);
      const back = evaluateCross<typeof ASYNC_ITERABLE>(result);
      expect(Object.getPrototypeOf(back)).toBeNull();
      expect(back.constructor).toBeUndefined();
      expect(Symbol.asyncIterator in back).toBe(true);
      expect(await drain(back)).toEqual([1, 2, 3]);
    });
    describe('scoped', () => {
      it('supports Object.create(null)', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, 'example');
        expect(Object.getPrototypeOf(back)).toBeNull();
        expect(back.constructor).toBeUndefined();
        expect(back.example).toBe(EXAMPLE.example);
      });
      it('supports self-recursion', async () => {
        const result = await crossSerializeAsync(ASYNC_RECURSIVE, {
          scopeId: 'example',
        });
        const back = evaluateCross<typeof ASYNC_RECURSIVE>(result, 'example');
        expect(Object.getPrototypeOf(back)).toBeNull();
        expect(await back.a).toBe(back);
        expect(await back.b).toBe(back);
      });
      it('supports Symbol.iterator', async () => {
        const result = await crossSerializeAsync(Promise.resolve(ITERABLE), {
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<typeof ITERABLE>>(result, 'example');
        expect(Object.getPrototypeOf(back)).toBeNull();
        expect(back.constructor).toBeUndefined();
        expect([...back]).toMatchObject([1, 2, 3]);
      });
      it('supports Symbol.asyncIterator', async () => {
        const result = await crossSerializeAsync(ASYNC_ITERABLE, {
          scopeId: 'example',
        });
        const back = evaluateCross<typeof ASYNC_ITERABLE>(result, 'example');
        expect(Object.getPrototypeOf(back)).toBeNull();
        expect(back.constructor).toBeUndefined();
        expect(Symbol.asyncIterator in back).toBe(true);
        expect(await drain(back)).toEqual([1, 2, 3]);
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Object.create(null)', async () => {
      const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(Object.getPrototypeOf(back)).toBeNull();
      expect(back.constructor).toBeUndefined();
      expect(back.example).toBe(EXAMPLE.example);
    });
    it('supports self-recursion', async () => {
      const back = await streamCross<typeof ASYNC_RECURSIVE>(ASYNC_RECURSIVE);
      expect(Object.getPrototypeOf(back)).toBeNull();
      expect(await back.a).toBe(back);
      expect(await back.b).toBe(back);
    });
    it('supports Symbol.iterator', async () => {
      const back = await streamCross<Promise<typeof ITERABLE>>(Promise.resolve(ITERABLE));
      expect(Object.getPrototypeOf(back)).toBeNull();
      expect(back.constructor).toBeUndefined();
      expect([...back]).toMatchObject([1, 2, 3]);
    });
    it('supports Symbol.asyncIterator', async () => {
      const back = await streamCross<typeof ASYNC_ITERABLE>(ASYNC_ITERABLE);
      expect(Object.getPrototypeOf(back)).toBeNull();
      expect(back.constructor).toBeUndefined();
      expect(Symbol.asyncIterator in back).toBe(true);
      expect(await drain(back)).toEqual([1, 2, 3]);
    });
    describe('scoped', () => {
      it('supports Object.create(null)', async () => {
        const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        expect(Object.getPrototypeOf(back)).toBeNull();
        expect(back.constructor).toBeUndefined();
        expect(back.example).toBe(EXAMPLE.example);
      });
      it('supports self-recursion', async () => {
        const back = await streamCross<typeof ASYNC_RECURSIVE>(ASYNC_RECURSIVE, {
          scopeId: 'example',
        });
        expect(Object.getPrototypeOf(back)).toBeNull();
        expect(await back.a).toBe(back);
        expect(await back.b).toBe(back);
      });
      it('supports Symbol.iterator', async () => {
        const back = await streamCross<Promise<typeof ITERABLE>>(Promise.resolve(ITERABLE), {
          scopeId: 'example',
        });
        expect(Object.getPrototypeOf(back)).toBeNull();
        expect(back.constructor).toBeUndefined();
        expect([...back]).toMatchObject([1, 2, 3]);
      });
      it('supports Symbol.asyncIterator', async () => {
        const back = await streamCross<typeof ASYNC_ITERABLE>(ASYNC_ITERABLE, {
          scopeId: 'example',
        });
        expect(Object.getPrototypeOf(back)).toBeNull();
        expect(back.constructor).toBeUndefined();
        expect(Symbol.asyncIterator in back).toBe(true);
        expect(await drain(back)).toEqual([1, 2, 3]);
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports Object.create(null)', () => {
      const result = toCrossJSON(EXAMPLE);
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });

      expect(back.constructor).toBeUndefined();
      expect(back.example).toBe(EXAMPLE.example);
    });
    it('supports self-recursion', () => {
      const result = toCrossJSON(RECURSIVE);
      const back = fromCrossJSON<typeof RECURSIVE>(result, {
        refs: new Map(),
      });

      expect(back.a).toBe(back);
      expect(back.b).toBe(back);
    });
    it('supports Symbol.iterator', () => {
      const result = toCrossJSON(ITERABLE);
      const back = fromCrossJSON<typeof ITERABLE>(result, {
        refs: new Map(),
      });

      expect(back.constructor).toBeUndefined();
      expect([...back]).toMatchObject([1, 2, 3]);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Object.create(null)', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });

      expect(back.constructor).toBeUndefined();
      expect(back.example).toBe(EXAMPLE.example);
    });
    it('supports self-recursion', async () => {
      const result = await toCrossJSONAsync(ASYNC_RECURSIVE);
      const back = fromCrossJSON<typeof ASYNC_RECURSIVE>(result, {
        refs: new Map(),
      });

      expect(await back.a).toBe(back);
      expect(await back.b).toBe(back);
    });
    it('supports Symbol.iterator', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(ITERABLE));
      const back = await fromCrossJSON<Promise<typeof ITERABLE>>(result, {
        refs: new Map(),
      });
      expect(back.constructor).toBeUndefined();
      expect([...back]).toMatchObject([1, 2, 3]);
    });
    it('supports Symbol.asyncIterator', async () => {
      const result = await toCrossJSONAsync(ASYNC_ITERABLE);
      const back = fromCrossJSON<typeof ASYNC_ITERABLE>(result, {
        refs: new Map(),
      });
      expect(back.constructor).toBeUndefined();
      expect(Symbol.asyncIterator in back).toBe(true);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Object.create(null)', async () => {
      const back = await streamCrossJSON<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(Object.getPrototypeOf(back)).toBeNull();
      expect(back.constructor).toBeUndefined();
      expect(back.example).toBe(EXAMPLE.example);
    });
    it('supports self-recursion', async () => {
      const back = await streamCrossJSON<typeof ASYNC_RECURSIVE>(ASYNC_RECURSIVE);
      expect(Object.getPrototypeOf(back)).toBeNull();
      expect(await back.a).toBe(back);
      expect(await back.b).toBe(back);
    });
    it('supports Symbol.iterator', async () => {
      const back = await streamCrossJSON<Promise<typeof ITERABLE>>(Promise.resolve(ITERABLE));
      expect(Object.getPrototypeOf(back)).toBeNull();
      expect(back.constructor).toBeUndefined();
      expect([...back]).toMatchObject([1, 2, 3]);
    });
    it('supports Symbol.asyncIterator', async () => {
      const back = await streamCrossJSON<typeof ASYNC_ITERABLE>(ASYNC_ITERABLE);
      expect(Object.getPrototypeOf(back)).toBeNull();
      expect(back.constructor).toBeUndefined();
      expect(Symbol.asyncIterator in back).toBe(true);
      expect(await drain(back)).toEqual([1, 2, 3]);
    });
  });
  describe('compat', () => {
    it('should use manual assignment instead of Object.assign', () => {
      const result = serialize(EXAMPLE, {
        disabledFeatures: Feature.ObjectAssign,
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.example).toBe(EXAMPLE.example);
    });
  });
  describe('compat#toJSON', () => {
    it('should use manual assignment instead of Object.assign', () => {
      const result = toJSON(EXAMPLE, {
        disabledFeatures: Feature.ObjectAssign,
      });
      expect(compileJSON(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.example).toBe(EXAMPLE.example);
    });
  });
});
