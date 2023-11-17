import { describe, it, expect } from 'vitest';
import {
  Feature,
  compileJSON,
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSON,
  toJSONAsync,
} from '../src';

const EXAMPLE = Object.assign(Object.create(null), { hello: 'world' }) as { hello: string };

const RECURSIVE = Object.create(null) as Record<string, unknown>;
RECURSIVE.a = RECURSIVE;
RECURSIVE.b = RECURSIVE;

const ITERABLE = Object.assign(Object.create(null), {
  * [Symbol.iterator]() {
    yield 1;
    yield 2;
    yield 3;
  },
}) as Iterable<number>;

const ASYNC_RECURSIVE = Object.create(null) as Record<string, Promise<unknown>>;
ASYNC_RECURSIVE.a = Promise.resolve(ASYNC_RECURSIVE);
ASYNC_RECURSIVE.b = Promise.resolve(ASYNC_RECURSIVE);

const ASYNC_ITERABLE = Object.assign(Object.create(null), {
  async* [Symbol.asyncIterator]() {
    await Promise.resolve();
    yield 1;
    yield 2;
    yield 3;
  },
}) as AsyncIterable<number>;

describe('null-constructor', () => {
  describe('serialize', () => {
    it('supports Object.create(null)', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.hello).toBe(EXAMPLE.hello);
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
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.hello).toBe(EXAMPLE.hello);
    });
    it('supports self-recursion', async () => {
      const result = await serializeAsync(ASYNC_RECURSIVE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof ASYNC_RECURSIVE>(result);
      expect(await back.a).toBe(back);
      expect(await back.b).toBe(back);
    });
    it('supports Symbol.iterator', async () => {
      const result = await serializeAsync(Promise.resolve(ITERABLE));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof ITERABLE>>(result);
      expect(back.constructor).toBeUndefined();
      expect([...back]).toMatchObject([1, 2, 3]);
    });
    it('supports Symbol.asyncIterator', async () => {
      const result = await serializeAsync(ASYNC_ITERABLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof ASYNC_ITERABLE>(result);
      expect(back.constructor).toBeUndefined();
      expect(Symbol.asyncIterator in back).toBe(true);
    });
  });
  describe('toJSON', () => {
    it('supports Object.create(null)', () => {
      const result = toJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.hello).toBe(EXAMPLE.hello);
    });
    it('supports self-recursion', () => {
      const result = toJSON(RECURSIVE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof RECURSIVE>(result);
      expect(back.a).toBe(back);
      expect(back.b).toBe(back);
    });
    it('supports Symbol.iterator', () => {
      const result = toJSON(ITERABLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof ITERABLE>(result);
      expect(back.constructor).toBeUndefined();
      expect([...back]).toMatchObject([1, 2, 3]);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Object.create(null)', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.hello).toBe(EXAMPLE.hello);
    });
    it('supports self-recursion', async () => {
      const result = await toJSONAsync(ASYNC_RECURSIVE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof ASYNC_RECURSIVE>(result);
      expect(await back.a).toBe(back);
      expect(await back.b).toBe(back);
    });
    it('supports Symbol.iterator', async () => {
      const result = await toJSONAsync(Promise.resolve(ITERABLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof ITERABLE>>(result);
      expect(back.constructor).toBeUndefined();
      expect([...back]).toMatchObject([1, 2, 3]);
    });
    it('supports Symbol.asyncIterator', async () => {
      const result = await toJSONAsync(ASYNC_ITERABLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof ASYNC_ITERABLE>(result);
      expect(back.constructor).toBeUndefined();
      expect(Symbol.asyncIterator in back).toBe(true);
    });
  });
  describe('crossSerialize', () => {
    it('supports Object.create(null)', () => {
      const example = ({ hello: 'world' }) as { hello: string };
      Object.freeze(example);
      const result = crossSerialize(example);
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
      expect(result).toMatchSnapshot();
    });
    it('supports self-recursion', async () => {
      const result = await crossSerializeAsync(ASYNC_RECURSIVE);
      expect(result).toMatchSnapshot();
    });
    it('supports Symbol.iterator', async () => {
      const result = await crossSerializeAsync(Promise.resolve(ITERABLE));
      expect(result).toMatchSnapshot();
    });
    it('supports Symbol.asyncIterator', async () => {
      const result = await crossSerializeAsync(ASYNC_ITERABLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Object.create(null)', async () => {
        const result = await crossSerializeAsync(
          Promise.resolve(EXAMPLE),
          { scopeId: 'example' },
        );
        expect(result).toMatchSnapshot();
      });
      it('supports self-recursion', async () => {
        const result = await crossSerializeAsync(ASYNC_RECURSIVE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
      it('supports Symbol.iterator', async () => {
        const result = await crossSerializeAsync(
          Promise.resolve(ITERABLE),
          { scopeId: 'example' },
        );
        expect(result).toMatchSnapshot();
      });
      it('supports Symbol.asyncIterator', async () => {
        const result = await crossSerializeAsync(ASYNC_ITERABLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Object.create(null)', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(EXAMPLE), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports self-recursion', async () => new Promise<void>((done) => {
      crossSerializeStream(ASYNC_RECURSIVE, {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.iterator', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(ITERABLE), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.asyncIterator', async () => new Promise<void>((done) => {
      crossSerializeStream(ASYNC_ITERABLE, {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    describe('scoped', () => {
      it('supports Object.create(null)', async () => new Promise<void>((done) => {
        crossSerializeStream(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            done();
          },
        });
      }));
      it('supports self-recursion', async () => new Promise<void>((done) => {
        crossSerializeStream(ASYNC_RECURSIVE, {
          scopeId: 'example',
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            done();
          },
        });
      }));
      it('supports Symbol.iterator', async () => new Promise<void>((done) => {
        crossSerializeStream(Promise.resolve(ITERABLE), {
          scopeId: 'example',
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            done();
          },
        });
      }));
      it('supports Symbol.asyncIterator', async () => new Promise<void>((done) => {
        crossSerializeStream(ASYNC_ITERABLE, {
          scopeId: 'example',
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            done();
          },
        });
      }));
    });
  });
  describe('toCrossJSON', () => {
    it('supports Object.create(null)', () => {
      const result = toCrossJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });

      expect(back.constructor).toBeUndefined();
      expect(back.hello).toBe(EXAMPLE.hello);
    });
    it('supports self-recursion', () => {
      const result = toCrossJSON(RECURSIVE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof RECURSIVE>(result, {
        refs: new Map(),
      });

      expect(back.a).toBe(back);
      expect(back.b).toBe(back);
    });
    it('supports Symbol.iterator', () => {
      const result = toCrossJSON(ITERABLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });

      expect(back.constructor).toBeUndefined();
      expect(back.hello).toBe(EXAMPLE.hello);
    });
    it('supports self-recursion', async () => {
      const result = await toCrossJSONAsync(ASYNC_RECURSIVE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof ASYNC_RECURSIVE>(result, {
        refs: new Map(),
      });

      expect(await back.a).toBe(back);
      expect(await back.b).toBe(back);
    });
    it('supports Symbol.iterator', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(ITERABLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<Promise<typeof ITERABLE>>(result, {
        refs: new Map(),
      });
      expect(back.constructor).toBeUndefined();
      expect([...back]).toMatchObject([1, 2, 3]);
    });
    it('supports Symbol.asyncIterator', async () => {
      const result = await toCrossJSONAsync(ASYNC_ITERABLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof ASYNC_ITERABLE>(result, {
        refs: new Map(),
      });
      expect(back.constructor).toBeUndefined();
      expect(Symbol.asyncIterator in back).toBe(true);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Object.create(null)', async () => new Promise<void>((done) => {
      toCrossJSONStream(Promise.resolve(EXAMPLE), {
        onParse(data) {
          expect(JSON.stringify(data)).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports self-recursion', async () => new Promise<void>((done) => {
      toCrossJSONStream(ASYNC_RECURSIVE, {
        onParse(data) {
          expect(JSON.stringify(data)).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.iterator', async () => new Promise<void>((done) => {
      toCrossJSONStream(Promise.resolve(ITERABLE), {
        onParse(data) {
          expect(JSON.stringify(data)).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.asyncIterator', async () => new Promise<void>((done) => {
      toCrossJSONStream(ASYNC_ITERABLE, {
        onParse(data) {
          expect(JSON.stringify(data)).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
  });
  describe('compat', () => {
    it('should use manual assignment instead of Object.assign', () => {
      const result = serialize(EXAMPLE, {
        disabledFeatures: Feature.ObjectAssign,
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.hello).toBe(EXAMPLE.hello);
    });
  });
  describe('compat#toJSON', () => {
    it('should use manual assignment instead of Object.assign', () => {
      const result = toJSON(EXAMPLE, {
        disabledFeatures: Feature.ObjectAssign,
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      expect(compileJSON(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.hello).toBe(EXAMPLE.hello);
    });
  });
});
