import { describe, expect, it } from 'vitest';
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

const EXAMPLE = {
  example: 'valid identifier',
  '%example': 'invalid identifier',
  '0x1': 'hexadecimal',
  '0b1': 'binary',
  '0o1': 'octal',
  '1_000': 'numeric separator',
  '1.7976931348623157e+308': 'exponentiation',
  'key\\with\\backslashes': 'value\\with\\backslashes',
};

const RECURSIVE = {} as Record<string, unknown>;
RECURSIVE.a = RECURSIVE;
RECURSIVE.b = RECURSIVE;

const ITERABLE = {
  *[Symbol.iterator](): Generator<number> {
    yield 1;
    yield 2;
    yield 3;
  },
};

const ASYNC_RECURSIVE = {} as Record<string, Promise<unknown>>;
ASYNC_RECURSIVE.a = Promise.resolve(ASYNC_RECURSIVE);
ASYNC_RECURSIVE.b = Promise.resolve(ASYNC_RECURSIVE);

const ASYNC_ITERABLE = {
  async *[Symbol.asyncIterator](): AsyncGenerator<number> {
    await Promise.resolve();
    yield 1;
    yield 2;
    yield 3;
  },
};

describe('objects', () => {
  describe('serialize', () => {
    it('supports Objects', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back.constructor).toBe(Object);

      for (const key in EXAMPLE) {
        expect(key in back).toBeTruthy();
        expect(back[key as keyof typeof back]).toBe(
          EXAMPLE[key as keyof typeof EXAMPLE],
        );
      }
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
      expect(back.constructor).toBe(Object);
      expect([...back]).toMatchObject([1, 2, 3]);
    });
  });
  describe('serializeAsync', () => {
    it('supports Objects', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back.constructor).toBe(Object);
      for (const key in EXAMPLE) {
        expect(key in back).toBeTruthy();
        expect(back[key as keyof typeof back]).toBe(
          EXAMPLE[key as keyof typeof EXAMPLE],
        );
      }
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
      expect(back.constructor).toBe(Object);
      expect([...back]).toMatchObject([1, 2, 3]);
    });
    it('supports Symbol.asyncIterator', async () => {
      const result = await serializeAsync(ASYNC_ITERABLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof ASYNC_ITERABLE>(result);
      expect(back.constructor).toBe(Object);
      expect(Symbol.asyncIterator in back).toBe(true);
    });
  });
  describe('toJSON', () => {
    it('supports Objects', () => {
      const result = toJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back.constructor).toBe(Object);
      for (const key in EXAMPLE) {
        expect(key in back).toBeTruthy();
        expect(back[key as keyof typeof back]).toBe(
          EXAMPLE[key as keyof typeof EXAMPLE],
        );
      }
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
      expect(back.constructor).toBe(Object);
      expect([...back]).toMatchObject([1, 2, 3]);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Objects', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back.constructor).toBe(Object);
      for (const key in EXAMPLE) {
        expect(key in back).toBeTruthy();
        expect(back[key as keyof typeof back]).toBe(
          EXAMPLE[key as keyof typeof EXAMPLE],
        );
      }
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
      expect(back.constructor).toBe(Object);
      expect([...back]).toMatchObject([1, 2, 3]);
    });
    it('supports Symbol.asyncIterator', async () => {
      const result = await toJSONAsync(ASYNC_ITERABLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof ASYNC_ITERABLE>(result);
      expect(back.constructor).toBe(Object);
      expect(Symbol.asyncIterator in back).toBe(true);
    });
  });
  describe('crossSerialize', () => {
    it('supports Objects', () => {
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
      it('supports Objects', () => {
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
    it('supports Objects', async () => {
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
      it('supports Objects', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
      it('supports self-recursion', async () => {
        const result = await crossSerializeAsync(ASYNC_RECURSIVE, {
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
      it('supports Symbol.iterator', async () => {
        const result = await crossSerializeAsync(Promise.resolve(ITERABLE), {
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
      it('supports Symbol.asyncIterator', async () => {
        const result = await crossSerializeAsync(ASYNC_ITERABLE, {
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Objects', async () =>
      new Promise<void>((resolve, reject) => {
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
    it('supports self-recursion', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(ASYNC_RECURSIVE, {
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
    it('supports Symbol.iterator', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(ITERABLE), {
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
    it('supports Symbol.asyncIterator', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(ASYNC_ITERABLE, {
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
      it('supports Objects', async () =>
        new Promise<void>((resolve, reject) => {
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
      it('supports self-recursion', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(ASYNC_RECURSIVE, {
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
      it('supports Symbol.iterator', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(Promise.resolve(ITERABLE), {
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
      it('supports Symbol.asyncIterator', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(ASYNC_ITERABLE, {
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
    it('supports Objects', () => {
      const result = toCrossJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });

      expect(back.constructor).toBe(Object);
      for (const key in EXAMPLE) {
        expect(key in back).toBeTruthy();
        expect(back[key as keyof typeof back]).toBe(
          EXAMPLE[key as keyof typeof EXAMPLE],
        );
      }
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

      expect(back.constructor).toBe(Object);
      expect([...back]).toMatchObject([1, 2, 3]);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Objects', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });

      expect(back.constructor).toBe(Object);
      for (const key in EXAMPLE) {
        expect(key in back).toBeTruthy();
        expect(back[key as keyof typeof back]).toBe(
          EXAMPLE[key as keyof typeof EXAMPLE],
        );
      }
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
      expect(back.constructor).toBe(Object);
      expect([...back]).toMatchObject([1, 2, 3]);
    });
    it('supports Symbol.asyncIterator', async () => {
      const result = await toCrossJSONAsync(ASYNC_ITERABLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof ASYNC_ITERABLE>(result, {
        refs: new Map(),
      });
      expect(back.constructor).toBe(Object);
      expect(Symbol.asyncIterator in back).toBe(true);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Objects', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(EXAMPLE), {
          onParse(data) {
            expect(JSON.stringify(data)).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
    it('supports self-recursion', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(ASYNC_RECURSIVE, {
          onParse(data) {
            expect(JSON.stringify(data)).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
    it('supports Symbol.iterator', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(ITERABLE), {
          onParse(data) {
            expect(JSON.stringify(data)).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
    it('supports Symbol.asyncIterator', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(ASYNC_ITERABLE, {
          onParse(data) {
            expect(JSON.stringify(data)).toMatchSnapshot();
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
  describe('compat', () => {
    it('should use manual assignment instead of Object.assign', () => {
      const result = serialize(EXAMPLE, {
        disabledFeatures: Feature.ObjectAssign,
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back.constructor).toBe(Object);
      expect(back.example).toBe(EXAMPLE.example);
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
      expect(back.constructor).toBe(Object);
      expect(back.example).toBe(EXAMPLE.example);
    });
  });
  describe('with an own __proto__ property', () => {
    // `JSON.parse` creates an own enumerable `__proto__` data property
    // (not a prototype), as does any record with a `__proto__` field.
    function makeProtoObject(): Record<string, unknown> {
      return JSON.parse('{"__proto__":5,"value":42}') as Record<string, unknown>;
    }
    function expectPreserved(back: Record<string, unknown>): void {
      const descriptor = Object.getOwnPropertyDescriptor(back, '__proto__');
      expect(descriptor).toBeDefined();
      expect(descriptor?.value).toBe(5);
      expect(Object.getPrototypeOf(back)).toBe(Object.prototype);
      expect(back.value).toBe(42);
    }

    it('supports serialize', () => {
      expectPreserved(
        deserialize<Record<string, unknown>>(serialize(makeProtoObject())),
      );
    });
    it('supports serializeAsync', async () => {
      expectPreserved(
        deserialize<Record<string, unknown>>(
          await serializeAsync(makeProtoObject()),
        ),
      );
    });
    it('supports toJSON', () => {
      expectPreserved(
        fromJSON<Record<string, unknown>>(toJSON(makeProtoObject())),
      );
    });
  });
  describe('with a circular own __proto__ property', () => {
    // `parent.child` -> `child`, and `child`'s own enumerable `__proto__`
    // data property holds a back-reference to `parent`. The back-reference
    // forces `__proto__` through the deferred assignment path rather than
    // the inline object literal.
    function makeCircularProtoObject(): Record<string, unknown> {
      const parent: Record<string, unknown> = {};
      const child = JSON.parse('{"__proto__":0}') as Record<string, unknown>;
      parent.child = child;
      Object.defineProperty(child, '__proto__', {
        value: parent,
        configurable: true,
        enumerable: true,
        writable: true,
      });
      return parent;
    }
    function expectPreserved(back: Record<string, unknown>): void {
      const child = back.child as Record<string, unknown>;
      const descriptor = Object.getOwnPropertyDescriptor(child, '__proto__');
      expect(descriptor).toBeDefined();
      expect(descriptor?.value).toBe(back);
      expect(Object.getPrototypeOf(child)).toBe(Object.prototype);
    }

    it('supports serialize', () => {
      expectPreserved(
        deserialize<Record<string, unknown>>(
          serialize(makeCircularProtoObject()),
        ),
      );
    });
    it('supports serializeAsync', async () => {
      expectPreserved(
        deserialize<Record<string, unknown>>(
          await serializeAsync(makeCircularProtoObject()),
        ),
      );
    });
    it('supports toJSON', () => {
      expectPreserved(
        fromJSON<Record<string, unknown>>(toJSON(makeCircularProtoObject())),
      );
    });
  });
  describe('with a shadowed constructor property', () => {
    const SHADOWED = { constructor: 'not a constructor', value: 42 };

    it('supports serialize', () => {
      const result = serialize(SHADOWED);
      const back = deserialize<typeof SHADOWED>(result);
      expect(back.constructor).toBe('not a constructor');
      expect(back.value).toBe(42);
    });
    it('supports serializeAsync', async () => {
      const result = await serializeAsync(SHADOWED);
      const back = deserialize<typeof SHADOWED>(result);
      expect(back.constructor).toBe('not a constructor');
      expect(back.value).toBe(42);
    });
    it('supports toJSON', () => {
      const result = toJSON(SHADOWED);
      const back = fromJSON<typeof SHADOWED>(result);
      expect(back.constructor).toBe('not a constructor');
      expect(back.value).toBe(42);
    });
    it('keeps a null-prototype object null-prototype', () => {
      const shadowed = Object.create(null) as Record<string, unknown>;
      shadowed.constructor = 1;
      const back = deserialize<Record<string, unknown>>(serialize(shadowed));
      expect(Object.getPrototypeOf(back)).toBe(null);
      expect(back.constructor).toBe(1);
    });
    it('keeps a shadowed Map a Map', () => {
      const shadowed = new Map([['a', 1]]);
      (shadowed as unknown as Record<string, unknown>).constructor = 1;
      const back = deserialize<Map<string, number>>(serialize(shadowed));
      expect(back).toBeInstanceOf(Map);
      expect(back.get('a')).toBe(1);
    });
  });
});
